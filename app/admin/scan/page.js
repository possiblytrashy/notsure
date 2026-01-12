"use client";
import { useState, useEffect, useMemo } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, 
  Lock, Camera, History as HistoryIcon, UserCheck, 
  MapPin, Search, Filter, Tag, Info
} from 'lucide-react';

export default function AdvancedScanner() {
  // --- 1. STATE MANAGEMENT ---
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null); 
  const [eventSearch, setEventSearch] = useState('');
  const [manualTicketSearch, setManualTicketSearch] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [isScanning, setIsScanning] = useState(true);
  const [status, setStatus] = useState({ 
    type: 'ready', message: 'Ready to Scan', color: '#1e293b', details: 'Position QR code in frame', eventName: '', tier: '' 
  });

  const STAFF_PIN = "1234"; 

  // --- 2. INITIALIZATION ---
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

  const handlePinInput = (value) => {
    const newPin = pin + value;
    if (newPin.length <= 4) setPin(newPin);
    if (newPin === STAFF_PIN) {
        setTimeout(() => setIsLocked(false), 300);
    } else if (newPin.length === 4) {
        setPin('');
        alert("Invalid PIN");
    }
  };

  // --- 3. VERIFICATION LOGIC ---
  const verifyTicket = async (decodedText, isManual = false) => {
    if (!isScanning && !isManual) return;
    if (isLocked) return;

    setIsScanning(false);
    let ticketRef = "";
    let qrEventId = "";

    if (decodedText.includes('REF:') && decodedText.includes('|')) {
      const segments = decodedText.split('|');
      ticketRef = segments[0].replace('REF:', '').trim();
      qrEventId = segments[1].replace('EVT:', '').trim();
    } else {
      ticketRef = decodedText.trim();
    }

    setStatus({ type: 'loading', message: 'Verifying...', color: '#0ea5e9', details: `Ref: ${ticketRef}`, tier: '' });

    try {
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select(`id, guest_name, tier_name, is_scanned, status, event_id, updated_at, events(title)`)
        .eq('reference', ticketRef)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!ticket) {
        setStatus({ type: 'error', message: 'NOT FOUND', color: '#ef4444', details: 'No record matches this reference.', tier: '' });
        return;
      }

      const eventTitle = ticket.events?.title || 'Event';
      const ticketTier = ticket.tier_name || 'Standard Entry';

      // Security Check: Event Match
      if (selectedEvent && ticket.event_id !== selectedEvent.id) {
        setStatus({ 
            type: 'error', message: 'WRONG EVENT', color: '#000', 
            details: `Valid for: ${eventTitle}`,
            eventName: 'GATE DENIED',
            tier: ticketTier
        });
        return;
      }

      // Security Check: QR Data Integrity
      if (qrEventId && ticket.event_id !== qrEventId) {
        setStatus({ type: 'error', message: 'QR TAMPERED', color: '#7f1d1d', details: 'Event ID mismatch.', tier: ticketTier });
        return;
      }

      // Payment Status Check
      if (ticket.status !== 'valid' && ticket.status !== 'success') {
        setStatus({ type: 'error', message: 'INVALID STATUS', color: '#f59e0b', details: `Ticket is ${ticket.status}`, tier: ticketTier });
        return;
      }

      // Already Scanned Check
      if (ticket.is_scanned) {
        setStatus({ 
          type: 'warning', message: 'USED TICKET', color: '#64748b', 
          details: `In: ${new Date(ticket.updated_at).toLocaleTimeString()}`, 
          eventName: eventTitle,
          tier: ticketTier
        });
        return;
      }

      // Success Path
      const { data: updatedTicket, error: updateError } = await supabase
  .from('tickets')
  .update({
    is_scanned: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', ticket.id)
  .eq('is_scanned', false)   // 🔒 LOCK
  .select()
  .maybeSingle();

if (updateError) throw updateError;

// If no row was updated → already scanned
if (!updatedTicket) {
  setStatus({ 
    type: 'warning',
    message: 'USED TICKET',
    color: '#64748b',
    details: 'This ticket was already scanned',
    eventName: eventTitle,
    tier: ticketTier
  });
  return;
}


      setScanHistory(prev => [{
        name: ticket.guest_name, event: eventTitle, tier: ticketTier, time: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 5));

      setStatus({ 
        type: 'success', message: 'ACCESS GRANTED', color: '#22c55e', 
        details: ticket.guest_name, 
        eventName: eventTitle,
        tier: ticketTier 
      });

    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'SYSTEM ERROR', color: '#000', details: 'Check internet connection.', tier: '' });
    }
  };

  useEffect(() => {
    if (isLocked || !isScanning) return;
    const scanner = new Html5QrcodeScanner('reader', { fps: 15, qrbox: 250 });
    scanner.render(verifyTicket, () => {});
    return () => scanner.clear().catch(() => {});
  }, [isScanning, isLocked, selectedEvent]);

  if (isLocked) {
    return (
      <div style={styles.lockContainer}>
        <div style={styles.lockCard}>
          <div style={styles.lockIconBox}><Lock size={40} color="#64748b" /></div>
          <h2 style={{fontWeight: 900, color: '#fff', marginBottom: '30px'}}>Scanner Locked</h2>
          <div style={styles.pinDisplay}>
            {[...Array(4)].map((_, i) => <div key={i} style={styles.pinDot(pin.length > i)}></div>)}
          </div>
          <div style={styles.keypad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(btn => (
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
      {/* EVENT SELECTOR SECTION */}
      <div style={styles.topSection}>
        <div style={styles.headerRow}>
          <h2 style={{fontWeight: 950, margin: 0, fontSize: '20px'}}>Gate Portal</h2>
          <button onClick={() => setIsLocked(true)} style={styles.lockCircle}><Lock size={16}/></button>
        </div>

        {!selectedEvent ? (
          <div style={styles.eventPicker}>
            <p style={styles.label}>Select Gate Event:</p>
            <div style={styles.searchBox}>
              <Search size={16} color="#94a3b8" />
              <input 
                style={styles.input} 
                placeholder="Search..." 
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
              />
            </div>
            <div style={styles.eventList}>
              {filteredEvents.map(e => (
                <div key={e.id} style={styles.eventItem} onClick={() => setSelectedEvent(e)}>
                  <span>{e.title}</span>
                  <Filter size={14} color="#38bdf8" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={styles.activeEventCard}>
            <div style={styles.activeEventInfo}>
              <MapPin size={16} color="#38bdf8" />
              <span style={{fontWeight: 800}}>{selectedEvent.title}</span>
            </div>
            <button style={styles.changeBtn} onClick={() => setSelectedEvent(null)}>Change Event</button>
          </div>
        )}
      </div>

      {/* MANUAL SEARCH */}
      <div style={styles.searchWrapper}>
        <Search size={18} style={styles.searchIcon} />
        <input 
          style={styles.searchInput} 
          placeholder="Manual Ticket ID Entry" 
          value={manualTicketSearch}
          onChange={(e) => setManualTicketSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && verifyTicket(manualTicketSearch, true)}
        />
        {manualTicketSearch && (
          <button style={styles.searchGo} onClick={() => verifyTicket(manualTicketSearch, true)}>CHECK</button>
        )}
      </div>

      {/* RESULT STATUS CARD */}
      <div style={{...styles.statusCard, background: status.color}}>
        {/* TICKET TIER DISPLAY - HIGH VISIBILITY */}
        {status.tier && (
          <div style={styles.tierContainer}>
            <Tag size={14} />
            <span style={styles.tierText}>{status.tier.toUpperCase()}</span>
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
        
        {!isScanning && (
          <button onClick={() => {setIsScanning(true); setManualTicketSearch('');}} style={styles.nextBtn}>
            READY FOR NEXT SCAN
          </button>
        )}
      </div>

      <div style={styles.scannerContainer}><div id="reader"></div></div>

      {/* CHECK-IN HISTORY */}
      <div style={styles.historySection}>
        <div style={styles.historyHeader}><HistoryIcon size={16} /> <span>RECENT GUESTS</span></div>
        {scanHistory.length === 0 && <p style={{textAlign: 'center', color: '#94a3b8', fontSize: '13px'}}>No recent check-ins.</p>}
        {scanHistory.map((item, idx) => (
          <div key={idx} style={styles.historyItem}>
            <div style={{flex: 1}}>
              <p style={styles.historyName}>{item.name}</p>
              <div style={styles.historyMetaRow}>
                 <span style={styles.historyTier}>{item.tier}</span>
                 <span>• {item.time}</span>
              </div>
            </div>
            <UserCheck size={18} color="#22c55e" />
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '15px', fontFamily: 'system-ui, -apple-system, sans-serif' },
  lockContainer: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' },
  lockCard: { width: '100%', maxWidth: '320px', textAlign: 'center' },
  lockIconBox: { width: '70px', height: '70px', background: '#1e293b', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' },
  pinDisplay: { display: 'flex', justifyContent: 'center', gap: '12px', margin: '30px 0' },
  pinDot: (filled) => ({ width: '14px', height: '14px', borderRadius: '50%', background: filled ? '#38bdf8' : '#334155', transition: '0.2s' }),
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  keyBtn: { padding: '18px', borderRadius: '18px', border: 'none', background: '#1e293b', color: '#fff', fontSize: '18px', fontWeight: 'bold' },
  
  topSection: { marginBottom: '20px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  lockCircle: { background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  eventPicker: { background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' },
  label: { margin: '0 0 10px', fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
  searchBox: { display: 'flex', alignItems: 'center', background: '#fff', padding: '0 12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '10px' },
  input: { flex: 1, border: 'none', padding: '10px', outline: 'none', fontSize: '14px' },
  eventList: { maxHeight: '120px', overflowY: 'auto' },
  eventItem: { padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  
  activeEventCard: { background: '#1e293b', color: '#fff', padding: '15px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  activeEventInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  changeBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '10px', fontSize: '12px' },

  searchWrapper: { position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '15px' },
  searchIcon: { position: 'absolute', left: '15px', color: '#94a3b8' },
  searchInput: { width: '100%', padding: '15px 15px 15px 45px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', background: '#f8fafc' },
  searchGo: { position: 'absolute', right: '10px', background: '#000', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '900' },

  statusCard: { position: 'relative', padding: '40px 20px', borderRadius: '30px', color: '#fff', textAlign: 'center', marginBottom: '15px', overflow: 'hidden' },
  tierContainer: { position: 'absolute', top: '20px', left: '0', right: '0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' },
  tierText: { fontSize: '12px', fontWeight: '900', letterSpacing: '1px' },
  statusTitle: { margin: '10px 0 5px', fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px' },
  statusDetails: { margin: 0, opacity: 0.9, fontSize: '16px', fontWeight: '600' },
  nextBtn: { marginTop: '20px', width: '100%', padding: '14px', background: '#fff', color: '#000', border: 'none', borderRadius: '14px', fontWeight: '900', fontSize: '14px' },
  
  scannerContainer: { borderRadius: '25px', overflow: 'hidden', border: '5px solid #000', marginBottom: '20px' },
  historySection: { background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' },
  historyHeader: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '10px' },
  historyItem: { background: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' },
  historyName: { margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' },
  historyMetaRow: { fontSize: '11px', color: '#64748b', display: 'flex', gap: '4px' },
  historyTier: { color: '#0ea5e9', fontWeight: '800' }
};
