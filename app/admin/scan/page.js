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
    if (!isScanning) return;
    
    setIsScanning(false);
    setStatus({ type: 'loading', message: 'Verifying...', color: '#0ea5e9', details: 'Accessing Ousted Database...' });

    // Clean URL if present: Extracts 'REF123' from 'https://site.com/ticket/REF123'
    const ticketRef = decodedText.includes('/') ? decodedText.split('/').pop().trim() : decodedText.trim();

    try {
      // Query searching the 'reference' column specifically (matches your Dashboard Sales table)
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, events(title)')
        .eq('reference', ticketRef)
        .maybeSingle();

      if (error) throw error;

      if (!ticket) {
        setStatus({ 
          type: 'error', 
          message: 'INVALID TICKET', 
          color: '#ef4444', 
          details: `Reference: ${ticketRef} not found.` 
        });
      } else if (ticket.is_scanned) {
        setStatus({ 
          type: 'warning', 
          message: 'ALREADY USED', 
          color: '#f59e0b', 
          details: `Previously scanned on ${new Date(ticket.updated_at).toLocaleDateString()}` 
        });
      } else {
        // Update database using the ticket's internal ID
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
          message: 'VALID TICKET', 
          color: '#22c55e', 
          details: `${ticket.events.title} — ${ticket.guest_name}` 
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'SCANNER ERROR', color: '#000', details: 'Check internet connection.' });
    }
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 15, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    });

    scanner.render(verifyTicket, (err) => {});
    return () => scanner.clear().catch(() => {});
  }, [isScanning]);

  return (
    <div style={container}>
      <div style={header}>
        <button onClick={() => router.back()} style={backBtn}><ArrowLeft size={20}/> Exit</button>
        <h2 style={{margin: 0, fontWeight: 900}}>Ousted Scanner</h2>
        <div style={{width: '60px'}}></div> 
      </div>

      <div style={{...statusCard, background: status.color}}>
        <div style={statusIconBox}>
          {status.type === 'ready' && <Ticket size={32} />}
          {status.type === 'loading' && <RefreshCw size={32} className="animate-spin" />}
          {status.type === 'success' && <CheckCircle2 size={32} />}
          {status.type === 'warning' && <AlertCircle size={32} />}
          {status.type === 'error' && <XCircle size={32} />}
        </div>
        <h1 style={statusTitle}>{status.message}</h1>
        <p style={statusDetails}>{status.details}</p>
        
        {!isScanning && (
          <button onClick={() => setIsScanning(true)} style={nextBtn}>SCAN NEXT</button>
        )}
      </div>

      <div style={scannerContainer}>
        {isScanning ? (
          <div id="reader"></div>
        ) : (
          <div style={pausedBox}>Verification Result Displayed Above</div>
        )}
      </div>
    </div>
  );
}

// Minimalist Styles to prevent interference
const container = { maxWidth: '480px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const backBtn = { background: '#f4f4f5', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const statusCard = { padding: '40px 20px', borderRadius: '40px', color: '#fff', marginBottom: '20px', transition: 'all 0.3s ease' };
const statusIconBox = { marginBottom: '10px', display: 'flex', justifyContent: 'center' };
const statusTitle = { margin: '0 0 5px', fontSize: '28px', fontWeight: 900 };
const statusDetails = { margin: 0, fontSize: '13px', opacity: 0.8 };
const nextBtn = { marginTop: '20px', width: '100%', padding: '16px', borderRadius: '15px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer' };
const scannerContainer = { borderRadius: '35px', overflow: 'hidden', border: '6px solid #000', background: '#000', aspectRatio: '1/1' };
const pausedBox = { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#eee', fontWeight: 700, fontSize: '14px' };
