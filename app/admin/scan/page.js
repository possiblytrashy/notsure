"use client";
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { Ticket, CheckCircle2, XCircle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdvancedScanner() {
  const router = useRouter();
  const [status, setStatus] = useState({ 
    type: 'ready', 
    message: 'Ready to Scan', 
    color: '#666', 
    details: 'Align the ticket QR code in the frame' 
  });
  const [isScanning, setIsScanning] = useState(true);

  const verifyTicket = async (decodedText) => {
    // If we already stopped scanning for a result, ignore further reads
    if (!isScanning) return;
    
    setIsScanning(false);
    setStatus({ type: 'loading', message: 'Verifying...', color: '#0ea5e9', details: 'Checking Ousted Database...' });

    // --- SMART PARSING LOGIC ---
    // If the QR is 'https://ousted.com/verify/REF_123', this gets 'REF_123'
    // If the QR is just 'REF_123', it still gets 'REF_123'
    let ticketRef = decodedText.trim();
    if (ticketRef.includes('/')) {
      const parts = ticketRef.split('/');
      ticketRef = parts[parts.length - 1] || parts[parts.length - 2];
    }

    try {
      // 1. Fetch ticket and the related event title
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
          id, 
          is_scanned, 
          updated_at, 
          guest_name, 
          tier_name,
          events ( title )
        `)
        .eq('reference', ticketRef)
        .maybeSingle();

      if (error) throw error;

      // 2. Case: Ticket doesn't exist
      if (!ticket) {
        setStatus({ 
          type: 'error', 
          message: 'INVALID TICKET', 
          color: '#ef4444', 
          details: `Ref: ${ticketRef} not found in system.` 
        });
        return;
      }

      // 3. Case: Ticket already scanned
      if (ticket.is_scanned) {
        const scanTime = new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setStatus({ 
          type: 'warning', 
          message: 'ALREADY USED', 
          color: '#f59e0b', 
          details: `Scanned at ${scanTime}. Reject Entry.` 
        });
        return;
      }

      // 4. Case: Valid Ticket -> Mark as Scanned
      const { error: updateErr } = await supabase
        .from('tickets')
        .update({ 
          is_scanned: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', ticket.id);

      if (updateErr) throw updateErr;

      setStatus({ 
        type: 'success', 
        message: 'ENTRY GRANTED', 
        color: '#22c55e', 
        details: `${ticket.events?.title || 'Event'} — ${ticket.guest_name} (${ticket.tier_name})` 
      });

    } catch (err) {
      console.error(err);
      setStatus({ 
        type: 'error', 
        message: 'SYSTEM ERROR', 
        color: '#000', 
        details: 'Check internet or database permissions.' 
      });
    }
  };

  useEffect(() => {
    if (!isScanning) return;

    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 20, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true
    });

    scanner.render(verifyTicket, (err) => {
      // Quietly handle scan misses (common in library)
    });

    return () => {
      scanner.clear().catch(e => console.error("Scanner cleanup error", e));
    };
  }, [isScanning]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backBtn}><ArrowLeft size={20}/> Exit</button>
        <h2 style={{margin: 0, fontWeight: 900, fontSize: '18px'}}>Gate Check-in</h2>
        <div style={{width: '60px'}}></div> 
      </div>

      <div style={{...styles.statusCard, background: status.color}}>
        <div style={styles.statusIconBox}>
          {status.type === 'ready' && <Ticket size={40} />}
          {status.type === 'loading' && <RefreshCw size={40} className="animate-spin" />}
          {status.type === 'success' && <CheckCircle2 size={40} />}
          {status.type === 'warning' && <AlertCircle size={40} />}
          {status.type === 'error' && <XCircle size={40} />}
        </div>
        <h1 style={styles.statusTitle}>{status.message}</h1>
        <p style={styles.statusDetails}>{status.details}</p>
        
        {!isScanning && (
          <button onClick={() => setIsScanning(true)} style={styles.nextBtn}>SCAN NEXT GUEST</button>
        )}
      </div>

      <div style={styles.scannerContainer}>
        {isScanning ? (
          <div id="reader"></div>
        ) : (
          <div style={styles.pausedBox}>
            <div style={{opacity: 0.5, marginBottom: '10px'}}><Ticket size={48}/></div>
            SCANNER PAUSED
          </div>
        )}
      </div>
      
      <p style={styles.footerNote}>Ensure you have a stable data connection for real-time validation.</p>
    </div>
  );
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  backBtn: { background: '#f4f4f5', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  statusCard: { padding: '40px 20px', borderRadius: '40px', color: '#fff', marginBottom: '25px', transition: 'all 0.3s ease', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  statusIconBox: { marginBottom: '15px', display: 'flex', justifyContent: 'center' },
  statusTitle: { margin: '0 0 10px', fontSize: '32px', fontWeight: 950, letterSpacing: '-1px' },
  statusDetails: { margin: 0, fontSize: '15px', fontWeight: 600, opacity: 0.9, lineHeight: 1.4 },
  nextBtn: { marginTop: '25px', width: '100%', padding: '18px', borderRadius: '20px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer', fontSize: '16px' },
  scannerContainer: { borderRadius: '40px', overflow: 'hidden', border: '8px solid #000', background: '#000', aspectRatio: '1/1', position: 'relative' },
  pausedBox: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#1e293b', fontWeight: 800, fontSize: '14px' },
  footerNote: { marginTop: '20px', fontSize: '12px', color: '#94a3b8', fontWeight: 500 }
};
