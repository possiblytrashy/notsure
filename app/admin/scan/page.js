"use client";
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { 
  Ticket, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, Lock, Camera, History as HistoryIcon, 
  UserCheck, MapPin 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdvancedScanner() {
  const router = useRouter();
  
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const STAFF_PIN = "1234"; 

  const [status, setStatus] = useState({ 
    type: 'ready', 
    message: 'Ready to Scan', 
    color: '#1e293b', 
    details: 'Position QR code in frame',
    eventName: '' 
  });
  const [isScanning, setIsScanning] = useState(true);

  const handlePinInput = (value) => {
    const newPin = pin + value;
    if (newPin.length <= 4) setPin(newPin);
    
    if (newPin === STAFF_PIN) {
      setTimeout(() => setIsLocked(false), 300);
    } else if (newPin.length === 4) {
      setPin('');
      alert("Incorrect Staff PIN");
    }
  };

  const verifyTicket = async (decodedText) => {
    if (!isScanning || isLocked) return;
    
    setIsScanning(false);
    setStatus({ 
      type: 'loading', 
      message: 'Verifying...', 
      color: '#0ea5e9', 
      details: 'Checking Database...',
      eventName: '' 
    });

    // Extract reference from potential URL or raw text
    let ticketRef = decodedText.trim();
    if (ticketRef.includes('/')) {
      const parts = ticketRef.split('/').filter(Boolean);
      ticketRef = parts[parts.length - 1];
    }

    try {
      // MATCHED TO YOUR TABLE SCHEMA:
      // Uses 'reference' for lookup and joins 'events' via event_id fkey
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select(`
          id,
          guest_name,
          tier_name,
          is_scanned,
          status,
          updated_at,
          events (
            title
          )
        `)
        .eq('reference', ticketRef)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // 1. Check if ticket exists
      if (!ticket) {
        setStatus({ 
          type: 'error', 
          message: 'INVALID TICKET', 
          color: '#ef4444', 
          details: `Ref: ${ticketRef} not found in system.` 
        });
        return;
      }

      // 2. Check if payment was successful (status check)
      if (ticket.status !== 'valid') {
        setStatus({ 
          type: 'error', 
          message: 'PAYMENT PENDING', 
          color: '#f59e0b', 
          details: `Ticket status is "${ticket.status}". Entry denied.` 
        });
        return;
      }

      const eventTitle = ticket.events?.title || 'Unknown Event';

      // 3. Check if already scanned
      if (ticket.is_scanned) {
        const scanTime = new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setStatus({ 
            type: 'warning', 
            message: 'ALREADY USED', 
            color: '#f59e0b', 
            details: `Scanned at ${scanTime}.`,
            eventName: eventTitle 
        });
        return;
      }

      // 4. Update the record (Mark as scanned)
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          is_scanned: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // Update Local History
      setScanHistory(prev => [{
        name: ticket.guest_name || 'Guest',
        event: eventTitle,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tier: ticket.tier_name || 'Regular'
      }, ...prev].slice(0, 5));

      setStatus({ 
        type: 'success', 
        message: 'ENTRY GRANTED', 
        color: '#22c55e', 
        details: `${ticket.guest_name} — ${ticket.tier_name}`,
        eventName: eventTitle 
      });

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'SCAN ERROR', color: '#000', details: 'Database connection failed.' });
    }
  };

  useEffect(() => {
    if (isLocked || !isScanning) return;
    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 
    });
    scanner.render(verifyTicket, (err) => {});
    return () => { scanner.clear().catch(e => {}); };
  }, [isScanning, isLocked]);

  if (isLocked) {
    return (
      <div style={styles.lockContainer}>
        <div style={styles.lockCard}>
          <div style={styles.lockIconBox}><Lock size={40} color="#64748b" /></div>
          <h2 style={{fontWeight: 950, marginBottom: '5px', color: '#fff'}}>Staff Entry</h2>
          <p style={{fontSize: '14px', color: '#94a3b8', marginBottom: '30px'}}>Enter PIN to activate scanner</p>
          <div style={styles.pinDisplay}>
            {[...Array(4)].map((_, i) => ( <div key={i} style={styles.pinDot(pin.length > i)}></div> ))}
          </div>
          <div style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((btn) => (
              <button key={btn} style={styles.keyBtn} onClick={() => {
                if (btn === 'C') setPin('');
                else if (btn === '←') setPin(pin.slice(0, -1));
                else handlePinInput(btn.toString());
              }}>{btn}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => setIsLocked(true)} style={styles.backBtn}><Lock size={16}/> Lock</button>
        <h2 style={{margin: 0, fontWeight: 950, fontSize: '18px'}}>Gate Control</h2>
        <div style={{width: '60px'}}></div> 
      </div>

      <div style={{...styles.statusCard, background: status.color}}>
        {status.eventName && (
            <div style={styles.eventBadge}>
                <MapPin size={12} /> {status.eventName.toUpperCase()}
            </div>
        )}
        <div style={styles.statusIconBox}>
          {status.type === 'ready' && <Camera size={48} />}
          {status.type === 'loading' && <RefreshCw size={48} className="animate-spin" />}
          {status.type === 'success' && <CheckCircle2 size={48} />}
          {status.type === 'warning' && <AlertCircle size={48} />}
          {status.type === 'error' && <XCircle size={48} />}
        </div>
        <h1 style={styles.statusTitle}>{status.message}</h1>
        <p style={styles.statusDetails}>{status.details}</p>
        {!isScanning && <button onClick={() => setIsScanning(true)} style={styles.nextBtn}>SCAN NEXT GUEST</button>}
      </div>

      <div style={styles.scannerContainer}><div id="reader"></div></div>

      <div style={styles.historySection}>
        <div style={styles.historyHeader}><HistoryIcon size={18} /><span>RECENT SESSIONS</span></div>
        {scanHistory.length === 0 ? (
          <p style={styles.emptyHistory}>No check-ins yet.</p>
        ) : (
          <div style={styles.historyList}>
            {scanHistory.map((item, idx) => (
              <div key={idx} style={styles.historyItem}>
                <div style={styles.historyInfo}>
                  <p style={styles.historyName}>{item.name}</p>
                  <p style={styles.historyMeta}>{item.event} • {item.tier}</p>
                </div>
                <div style={{textAlign: 'right'}}>
                    <p style={{...styles.historyMeta, color: '#22c55e'}}>{item.time}</p>
                    <UserCheck size={16} color="#22c55e" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  lockContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '20px' },
  lockCard: { width: '100%', maxWidth: '350px', textAlign: 'center' },
  lockIconBox: { width: '80px', height: '80px', borderRadius: '30px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  pinDisplay: { display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' },
  pinDot: (filled) => ({ width: '15px', height: '15px', borderRadius: '50%', background: filled ? '#38bdf8' : '#334155', transition: '0.2s' }),
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
  keyBtn: { padding: '20px', borderRadius: '20px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '20px', fontWeight: 700, cursor: 'pointer' },
  container: { maxWidth: '480px', margin: '0 auto', padding: '20px', textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  backBtn: { background: '#f4f4f5', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  statusCard: { position: 'relative', padding: '40px 20px', borderRadius: '40px', color: '#fff', marginBottom: '25px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden' },
  eventBadge: { position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '5px' },
  statusIconBox: { marginBottom: '15px', display: 'flex', justifyContent: 'center' },
  statusTitle: { margin: '0 0 10px', fontSize: '28px', fontWeight: 950, letterSpacing: '-1px' },
  statusDetails: { margin: 0, fontSize: '15px', fontWeight: 600, opacity: 0.9 },
  nextBtn: { marginTop: '20px', width: '100%', padding: '16px', borderRadius: '18px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer' },
  scannerContainer: { borderRadius: '40px', overflow: 'hidden', border: '8px solid #000', background: '#000', aspectRatio: '1/1', marginBottom: '30px' },
  historySection: { textAlign: 'left', background: '#f8fafc', padding: '25px', borderRadius: '30px', border: '1px solid #f1f5f9' },
  historyHeader: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900, color: '#94a3b8', marginBottom: '15px' },
  historyList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  historyItem: { background: '#fff', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' },
  historyInfo: { display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' },
  historyName: { margin: 0, fontSize: '14px', fontWeight: 800 },
  historyMeta: { margin: 0, fontSize: '11px', fontWeight: 600, color: '#94a3b8' },
  emptyHistory: { fontSize: '13px', color: '#94a3b8', textAlign: 'center' }
};
