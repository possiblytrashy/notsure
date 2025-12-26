"use client";
import { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { 
  Ticket, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, ArrowLeft, Lock, Unlock, Camera, 
  History as HistoryIcon, UserCheck 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdvancedScanner() {
  const router = useRouter();
  
  // --- 1. SECURITY & SESSION STATE ---
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const STAFF_PIN = "1234"; // 👈 Change this to your preferred 4-digit code

  // --- 2. SCANNER STATUS STATE ---
  const [status, setStatus] = useState({ 
    type: 'ready', 
    message: 'Ready to Scan', 
    color: '#1e293b', 
    details: 'Hold ticket steady' 
  });
  const [isScanning, setIsScanning] = useState(true);

  // --- 3. PIN INPUT LOGIC ---
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

  // --- 4. VERIFICATION LOGIC (UPGRADED) ---
  const verifyTicket = async (decodedText) => {
    if (!isScanning || isLocked) return;
    
    setIsScanning(false);
    setStatus({ type: 'loading', message: 'Verifying...', color: '#0ea5e9', details: 'Querying Supabase...' });

    // Clean reference from URL or raw text
    let ticketRef = decodedText.trim();
    if (ticketRef.includes('/')) {
      const parts = ticketRef.split('/').filter(Boolean);
      ticketRef = parts[parts.length - 1];
    }

    try {
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select(`*, events(title)`)
        .eq('reference', ticketRef)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!ticket) {
        setStatus({ type: 'error', message: 'NOT FOUND', color: '#ef4444', details: `Ref: ${ticketRef} not found.` });
        return;
      }

      if (ticket.is_scanned) {
        const scanTime = new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setStatus({ type: 'warning', message: 'ALREADY USED', color: '#f59e0b', details: `Used at ${scanTime}.` });
        return;
      }

      // Mark as Scanned
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ is_scanned: true, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // SUCCESS - Add to history
      const newScan = {
        name: ticket.guest_name,
        event: ticket.events?.title,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tier: ticket.tier_name
      };
      setScanHistory(prev => [newScan, ...prev].slice(0, 5)); // Keep last 5

      setStatus({ 
        type: 'success', 
        message: 'ENTRY GRANTED', 
        color: '#22c55e', 
        details: `${ticket.guest_name} — ${ticket.tier_name}` 
      });

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'SYSTEM ERROR', color: '#000', details: 'Check internet connection.' });
    }
  };

  // --- 5. SCANNER LIFECYCLE ---
  useEffect(() => {
    if (isLocked || !isScanning) return;

    const scanner = new Html5QrcodeScanner('reader', { 
      fps: 15, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    });

    scanner.render(verifyTicket, (err) => {});

    return () => {
      scanner.clear().catch(e => {});
    };
  }, [isScanning, isLocked]);

  // --- 6. RENDER LOCK SCREEN ---
  if (isLocked) {
    return (
      <div style={styles.lockContainer}>
        <div style={styles.lockCard}>
          <div style={styles.lockIconBox}><Lock size={40} color="#64748b" /></div>
          <h2 style={{fontWeight: 950, marginBottom: '5px', color: '#fff'}}>Staff Entry</h2>
          <p style={{fontSize: '14px', color: '#94a3b8', marginBottom: '30px'}}>Enter PIN to activate scanner</p>
          
          <div style={styles.pinDisplay}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={styles.pinDot(pin.length > i)}></div>
            ))}
          </div>

          <div style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map((btn) => (
              <button 
                key={btn} 
                style={styles.keyBtn} 
                onClick={() => {
                  if (btn === 'C') setPin('');
                  else if (btn === '←') setPin(pin.slice(0, -1));
                  else handlePinInput(btn.toString());
                }}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- 7. RENDER SCANNER UI ---
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => setIsLocked(true)} style={styles.backBtn}><Lock size={16}/> Lock</button>
        <h2 style={{margin: 0, fontWeight: 950, fontSize: '18px'}}>Gate Control</h2>
        <div style={{width: '60px'}}></div> 
      </div>

      <div style={{...styles.statusCard, background: status.color}}>
        <div style={styles.statusIconBox}>
          {status.type === 'ready' && <Camera size={48} />}
          {status.type === 'loading' && <RefreshCw size={48} className="animate-spin" />}
          {status.type === 'success' && <CheckCircle2 size={48} />}
          {status.type === 'warning' && <AlertCircle size={48} />}
          {status.type === 'error' && <XCircle size={48} />}
        </div>
        <h1 style={styles.statusTitle}>{status.message}</h1>
        <p style={styles.statusDetails}>{status.details}</p>
        {!isScanning && <button onClick={() => setIsScanning(true)} style={styles.nextBtn}>CONTINUE SCANNING</button>}
      </div>

      <div style={styles.scannerContainer}>
        <div id="reader"></div>
      </div>

      {/* --- HISTORY SECTION --- */}
      <div style={styles.historySection}>
        <div style={styles.historyHeader}>
          <HistoryIcon size={18} />
          <span>RECENT CHECK-INS</span>
        </div>
        {scanHistory.length === 0 ? (
          <p style={styles.emptyHistory}>No scans yet this session.</p>
        ) : (
          <div style={styles.historyList}>
            {scanHistory.map((item, idx) => (
              <div key={idx} style={styles.historyItem}>
                <div style={styles.historyInfo}>
                  <p style={styles.historyName}>{item.name}</p>
                  <p style={styles.historyMeta}>{item.tier} • {item.time}</p>
                </div>
                <UserCheck size={18} color="#22c55e" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- CONSOLIDATED STYLES ---
const styles = {
  // Lock Screen
  lockContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '20px', fontFamily: 'sans-serif' },
  lockCard: { width: '100%', maxWidth: '350px', textAlign: 'center' },
  lockIconBox: { width: '80px', height: '80px', borderRadius: '30px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  pinDisplay: { display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' },
  pinDot: (filled) => ({ width: '15px', height: '15px', borderRadius: '50%', background: filled ? '#38bdf8' : '#334155', transition: '0.2s' }),
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
  keyBtn: { padding: '20px', borderRadius: '20px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '20px', fontWeight: 700, cursor: 'pointer' },
  
  // Main Scanner
  container: { maxWidth: '480px', margin: '0 auto', padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  backBtn: { background: '#f4f4f5', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  statusCard: { padding: '40px 20px', borderRadius: '40px', color: '#fff', marginBottom: '25px', transition: 'all 0.3s ease', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  statusIconBox: { marginBottom: '15px', display: 'flex', justifyContent: 'center' },
  statusTitle: { margin: '0 0 10px', fontSize: '32px', fontWeight: 950, letterSpacing: '-1px' },
  statusDetails: { margin: 0, fontSize: '15px', fontWeight: 600, opacity: 0.9 },
  nextBtn: { marginTop: '20px', width: '100%', padding: '18px', borderRadius: '20px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer', fontSize: '16px' },
  scannerContainer: { borderRadius: '40px', overflow: 'hidden', border: '8px solid #000', background: '#000', aspectRatio: '1/1', marginBottom: '30px' },

  // History Section
  historySection: { textAlign: 'left', background: '#f8fafc', padding: '25px', borderRadius: '30px', border: '1px solid #f1f5f9' },
  historyHeader: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px', marginBottom: '15px' },
  historyList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  historyItem: { background: '#fff', padding: '15px', borderRadius: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' },
  historyInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  historyName: { margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' },
  historyMeta: { margin: 0, fontSize: '11px', fontWeight: 600, color: '#94a3b8' },
  emptyHistory: { fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: '10px 0' }
};
