"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode'; // Switched to the core logic for better control
import { supabase } from '../../../lib/supabase';
import { 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Lock, Camera, History as HistoryIcon, UserCheck, 
  MapPin, Search, Filter, Tag, Power
} from 'lucide-react';

export default function AdvancedScanner() {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null); 
  const [eventSearch, setEventSearch] = useState('');
  const [manualTicketSearch, setManualTicketSearch] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState({ 
    type: 'ready', message: 'Ready to Scan', color: '#1e293b', details: 'Camera inactive', tier: '' 
  });

  const scannerRef = useRef(null);
  const STAFF_PIN = "1234"; 

  // --- 1. LOAD EVENTS ---
  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from('events').select('id, title').order('created_at', { ascending: false });
      if (data) setEvents(data);
    }
    loadEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => e.title.toLowerCase().includes(eventSearch.toLowerCase()));
  }, [events, eventSearch]);

  // --- 2. CAMERA ENGINE ---
  const startScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }

      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = { fps: 20, qrbox: { width: 250, height: 250 } };

      await html5QrCode.start(
        { facingMode: "environment" }, // Forces back camera
        config,
        (decodedText) => verifyTicket(decodedText)
      );

      setIsScanning(true);
      setStatus({ type: 'ready', message: 'SCANNING LIVE', color: '#1e293b', details: 'Point at QR Code', tier: '' });
    } catch (err) {
      console.error("Camera Error:", err);
      setStatus({ type: 'error', message: 'CAMERA ERROR', color: '#7f1d1d', details: 'Ensure camera permissions are on.', tier: '' });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  // --- 3. VERIFICATION LOGIC ---
  const verifyTicket = async (decodedText) => {
    // Immediately stop scanning to prevent double-reads
    await stopScanner();
    
    let ticketRef = decodedText.trim();
    // Handle cases where the QR might be the full URL
    if (ticketRef.includes('reference=')) {
        ticketRef = new URLSearchParams(ticketRef.split('?')[1]).get('reference');
    }

    setStatus({ type: 'loading', message: 'VERIFYING', color: '#0ea5e9', details: `REF: ${ticketRef}`, tier: '' });

    try {
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select(`id, guest_name, tier_name, is_scanned, status, event_id, updated_at, events(title)`)
        .eq('reference', ticketRef)
        .maybeSingle();

      if (fetchError || !ticket) {
        setStatus({ type: 'error', message: 'NOT FOUND', color: '#ef4444', details: 'Invalid Reference', tier: '' });
        return;
      }

      const ticketTier = ticket.tier_name || 'Standard';

      // Event Match Check
      if (selectedEvent && ticket.event_id !== selectedEvent.id) {
        setStatus({ type: 'error', message: 'WRONG EVENT', color: '#000', details: `Valid for: ${ticket.events?.title}`, tier: ticketTier });
        return;
      }

      // Security: Is Scanned Check
      if (ticket.is_scanned) {
        setStatus({ 
          type: 'warning', message: 'ALREADY USED', color: '#64748b', 
          details: `In: ${new Date(ticket.updated_at).toLocaleTimeString()}`, 
          tier: ticketTier 
        });
        return;
      }

      // Final Check: Payment Success
      if (ticket.status !== 'success' && ticket.status !== 'valid') {
        setStatus({ type: 'error', message: 'UNPAID', color: '#f59e0b', details: `Status: ${ticket.status}`, tier: ticketTier });
        return;
      }

      // Update Database
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ is_scanned: true, updated_at: new Date().toISOString() })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      setScanHistory(prev => [{ name: ticket.guest_name, tier: ticketTier, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
      setStatus({ type: 'success', message: 'ACCESS GRANTED', color: '#22c55e', details: ticket.guest_name, tier: ticketTier });

    } catch (err) {
      setStatus({ type: 'error', message: 'SYSTEM ERROR', color: '#000', details: 'Check Connection', tier: '' });
    }
  };

  // --- UI COMPONENTS ---
  if (isLocked) {
    return (
      <div style={styles.lockContainer}>
        <div style={styles.lockCard}>
          <div style={styles.lockIconBox}><Lock size={40} color="#38bdf8" /></div>
          <h2 style={{fontWeight: 900, color: '#fff'}}>Gate Authorization</h2>
          <p style={{color: '#64748b', fontSize: '13px', marginBottom: '30px'}}>Enter Staff PIN to access camera</p>
          <div style={styles.pinDisplay}>
            {[...Array(4)].map((_, i) => <div key={i} style={styles.pinDot(pin.length > i)}></div>)}
          </div>
          <div style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
              <button key={btn} style={styles.keyBtn} onClick={() => {
                if (btn === 'C') setPin('');
                else if (btn === '←') setPin(pin.slice(0, -1));
                else {
                    const p = pin + btn;
                    if (p.length <= 4) setPin(p);
                    if (p === STAFF_PIN) setTimeout(() => setIsLocked(false), 300);
                }
              }}>{btn}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
            <h2 style={{fontWeight: 950, margin: 0, fontSize: '22px'}}>GATE PORTAL</h2>
            <p style={{fontSize: '11px', color: '#64748b', fontWeight: 800}}>{isScanning ? '● CAMERA ACTIVE' : '○ CAMERA IDLE'}</p>
        </div>
        <button onClick={() => setIsLocked(true)} style={styles.lockCircle}><Power size={18} color="#ef4444" /></button>
      </div>

      {!selectedEvent ? (
        <div style={styles.eventPicker}>
          <div style={styles.searchBox}>
            <Search size={16} color="#94a3b8" />
            <input style={styles.input} placeholder="Select event to start..." value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} />
          </div>
          <div style={styles.eventList}>
            {filteredEvents.map(e => (
              <div key={e.id} style={styles.eventItem} onClick={() => { setSelectedEvent(e); setTimeout(startScanner, 100); }}>
                <span>{e.title}</span>
                <Filter size={14} color="#38bdf8" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={styles.activeEventCard}>
          <div style={styles.activeEventInfo}><MapPin size={16} color="#38bdf8" /> <span>{selectedEvent.title}</span></div>
          <button style={styles.changeBtn} onClick={() => { stopScanner(); setSelectedEvent(null); }}>Change</button>
        </div>
      )}

      {/* STATUS DISPLAY */}
      <div style={{...styles.statusCard, background: status.color}}>
        {status.tier && <div style={styles.tierTag}><Tag size={10} /> {status.tier}</div>}
        <div style={styles.statusIcon}>
            {status.type === 'ready' && <Camera size={40} />}
            {status.type === 'loading' && <RefreshCw size={40} className="animate-spin" />}
            {status.type === 'success' && <CheckCircle2 size={40} />}
            {status.type === 'error' && <XCircle size={40} />}
            {status.type === 'warning' && <AlertCircle size={40} />}
        </div>
        <h2 style={styles.statusMsg}>{status.message}</h2>
        <p style={styles.statusDet}>{status.details}</p>
        
        {!isScanning && selectedEvent && (
            <button onClick={startScanner} style={styles.actionBtn}>ACTIVATE CAMERA</button>
        )}
      </div>

      {/* CAMERA VIEWPORT - No Image Upload UI */}
      <div style={styles.scannerBox}>
        <div id="reader" style={{ width: '100%' }}></div>
        {!isScanning && <div style={styles.scannerOverlay}>Camera Paused</div>}
      </div>

      {/* RECENT GUESTS */}
      <div style={styles.historySection}>
        <div style={styles.historyHeader}><HistoryIcon size={14} /> RECENT CHECK-INS</div>
        {scanHistory.map((item, i) => (
          <div key={i} style={styles.historyItem}>
            <div>
                <p style={{margin: 0, fontWeight: 800, fontSize: '14px'}}>{item.name}</p>
                <p style={{margin: 0, fontSize: '11px', color: '#64748b'}}>{item.tier} • {item.time}</p>
            </div>
            <UserCheck size={18} color="#22c55e" />
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '440px', margin: '0 auto', padding: '20px', fontFamily: 'Inter, sans-serif' },
  lockContainer: { height: '100vh', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  lockCard: { width: '100%', textAlign: 'center' },
  lockIconBox: { width: '64px', height: '64px', background: '#0f172a', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', border: '1px solid #1e293b' },
  pinDisplay: { display: 'flex', justifyContent: 'center', gap: '15px', margin: '20px 0' },
  pinDot: (filled) => ({ width: '15px', height: '15px', borderRadius: '50%', background: filled ? '#38bdf8' : '#1e293b' }),
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
  keyBtn: { padding: '20px', background: '#0f172a', border: 'none', color: '#fff', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold' },
  
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  lockCircle: { width: '45px', height: '45px', borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  eventPicker: { background: '#f8fafc', padding: '15px', borderRadius: '24px', border: '1px solid #e2e8f0', marginBottom: '15px' },
  searchBox: { display: 'flex', alignItems: 'center', background: '#fff', padding: '10px 15px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '10px' },
  input: { flex: 1, border: 'none', outline: 'none', fontSize: '14px', marginLeft: '10px' },
  eventList: { maxHeight: '150px', overflowY: 'auto' },
  eventItem: { padding: '12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: '13px' },
  
  activeEventCard: { background: '#0f172a', color: '#fff', padding: '15px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  activeEventInfo: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800 },
  changeBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '5px 12px', borderRadius: '10px', fontSize: '11px' },

  statusCard: { padding: '30px 20px', borderRadius: '30px', color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden', marginBottom: '20px' },
  tierTag: { position: 'absolute', top: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 900, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '5px' },
  statusIcon: { marginBottom: '10px' },
  statusMsg: { margin: '0', fontSize: '24px', fontWeight: 900 },
  statusDet: { margin: '5px 0 0', opacity: 0.8, fontSize: '14px', fontWeight: 600 },
  actionBtn: { marginTop: '15px', width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, fontSize: '13px' },

  scannerBox: { borderRadius: '30px', overflow: 'hidden', background: '#000', border: '6px solid #000', position: 'relative', minHeight: '300px' },
  scannerOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 },

  historySection: { marginTop: '20px' },
  historyHeader: { fontSize: '11px', fontWeight: 900, color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' },
  historyItem: { background: '#f8fafc', padding: '12px 15px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }
};
