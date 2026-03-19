"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Camera,
  History as HistoryIcon, UserCheck, MapPin, Search,
  Filter, Tag, ShieldCheck, ShieldX, AlertTriangle, Loader2
} from 'lucide-react';


function NFCButton({ onScan, eventId }) {
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState('');

  const startNFC = async () => {
    if (reading) return;
    setReading(true); setErr('');
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan();
      ndef.onreadingerror = () => { setErr('NFC read error — try again'); setReading(false); };
      ndef.onreading = ({ message }) => {
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding || 'utf-8');
            const data = decoder.decode(record.data);
            onScan(data);
            setReading(false);
            return;
          }
          if (record.recordType === 'url') {
            const decoder = new TextDecoder();
            onScan(decoder.decode(record.data));
            setReading(false);
            return;
          }
        }
        setErr('No readable ticket data on NFC tag');
        setReading(false);
      };
    } catch (e) {
      setErr('NFC not available: ' + e.message);
      setReading(false);
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={startNFC} disabled={reading} style={{ width: '100%', padding: '13px', background: reading ? '#1e40af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: reading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>📱</span>
        {reading ? 'Tap NFC ticket to phone...' : 'Scan via NFC Tag'}
      </button>
      {err && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ef4444', fontWeight: 700, textAlign: 'center' }}>{err}</p>}
    </div>
  );
}

export default function GateScanner() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventSearch, setEventSearch] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [scanHistory, setScanHistory] = useState([]);
  const [isScanning, setIsScanning] = useState(true);
  const [status, setStatus] = useState({ type: 'ready', reason: null, message: 'Ready to Scan', sub: 'Position QR in frame', event_name: '', tier: '', guest: '' });
  const scannerRef = useRef(null);

  useEffect(() => {
    supabase.from('events').select('id,title,date').order('date', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data); });
  }, []);

  const filteredEvents = useMemo(() => events.filter(e => e.title?.toLowerCase().includes(eventSearch.toLowerCase())), [events, eventSearch]);

  // ── VERIFY VIA SERVER API ─────────────────────────────────────
  const verifyQR = async (rawData, isManual = false) => {
    if (!isScanning && !isManual) return;
    setIsScanning(false);
    setStatus({ type: 'loading', message: 'Verifying...', sub: rawData.substring(0, 30), event_name: '', tier: '', guest: '' });

    try {
      const res = await fetch('/api/scanner/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_data: rawData.trim(),
          selected_event_id: selectedEvent?.id || null,
          scanner_id: 'gate-web'
        })
      });
      const d = await res.json();

      const base = { event_name: d.event_name || '', tier: d.tier || '', guest: d.guest_name || '' };

      if (d.valid) {
        setScanHistory(prev => [{
          guest: d.guest_name, tier: d.tier, event: d.event_name, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        }, ...prev].slice(0, 8));
        setStatus({ ...base, type: 'success', reason: 'ACCESS_GRANTED', message: 'ACCESS GRANTED', sub: d.guest_name });
        if (d.signature_warning) {
          setTimeout(() => setStatus(s => ({ ...s, sub: `${d.guest_name} (legacy QR — no signature)` })), 300);
        }
      } else if (d.reason === 'FORGED_QR') {
        setStatus({ ...base, type: 'forged', reason: 'FORGED_QR', message: 'FORGED QR DETECTED', sub: 'Do not allow entry. Alert security.' });
      } else if (d.reason === 'ALREADY_USED') {
        setStatus({ ...base, type: 'warning', reason: 'ALREADY_USED', message: 'TICKET ALREADY USED', sub: d.message });
      } else if (d.reason === 'WRONG_EVENT') {
        setStatus({ ...base, type: 'wrong', reason: 'WRONG_EVENT', message: 'WRONG EVENT', sub: `Valid for: "${d.event_name}"` });
      } else {
        setStatus({ ...base, type: 'error', reason: d.reason, message: d.reason?.replace(/_/g, ' ') || 'INVALID', sub: d.message });
      }
    } catch {
      setStatus({ type: 'error', message: 'NETWORK ERROR', sub: 'Check internet connection', event_name: '', tier: '', guest: '' });
    }
  };

  // ── QR SCANNER INIT ───────────────────────────────────────────
  useEffect(() => {
    if (!isScanning) return;
    let scanner = null;
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scanner = new Html5QrcodeScanner('reader', { fps: 15, qrbox: 260 }, false);
      scanner.render((decoded) => verifyQR(decoded), () => {});
      scannerRef.current = scanner;
    });
    return () => { scanner?.clear().catch(() => {}); };
  }, [isScanning, selectedEvent]);

  // ── COLORS & ICONS ────────────────────────────────────────────
  const statusConfig = {
    ready:   { bg: '#0f172a', icon: <Camera size={52} />,             accent: '#334155' },
    loading: { bg: '#0c1a2e', icon: <Loader2 size={52} style={{ animation: 'spin .8s linear infinite' }} />, accent: '#0ea5e9' },
    success: { bg: '#052e16', icon: <CheckCircle2 size={52} />,       accent: '#22c55e' },
    warning: { bg: '#1c1708', icon: <AlertCircle size={52} />,        accent: '#f59e0b' },
    error:   { bg: '#1a0505', icon: <XCircle size={52} />,            accent: '#ef4444' },
    wrong:   { bg: '#1a0c00', icon: <AlertTriangle size={52} />,      accent: '#f97316' },
    forged:  { bg: '#1a0000', icon: <ShieldX size={52} />,            accent: '#dc2626' },
  };
  const cfg = statusConfig[status.type] || statusConfig.ready;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '15px 14px 80px', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0, letterSpacing: '-1px' }}>Gate Portal</h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>OUSTED · Secure Entry Scanner</p>
        </div>
        <div style={{ background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={12} color="#22c55e" />
          <span style={{ fontSize: 9, fontWeight: 900, color: '#22c55e', letterSpacing: '1.5px' }}>SECURED</span>
        </div>
      </div>

      {/* Event selector */}
      {!selectedEvent ? (
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginBottom: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px' }}>SELECT EVENT (OPTIONAL)</p>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '0 12px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 10 }}>
            <Search size={13} color="#94a3b8" />
            <input style={{ flex: 1, border: 'none', padding: '10px 8px', outline: 'none', fontSize: 13, background: 'transparent' }} placeholder="Search events..." value={eventSearch} onChange={e => setEventSearch(e.target.value)} />
          </div>
          <div style={{ maxHeight: 130, overflowY: 'auto' }}>
            {filteredEvents.map(e => (
              <div key={e.id} onClick={() => setSelectedEvent(e)} style={{ padding: '10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                <span>{e.title}</span><Filter size={12} color="#38bdf8" />
              </div>
            ))}
            <div onClick={() => setSelectedEvent({ id: null, title: 'Any Event' })} style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}>
              → Accept tickets for ANY event
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#0f172a', color: '#fff', padding: '13px 15px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} color="#38bdf8" />
            <span style={{ fontWeight: 800, fontSize: 14 }}>{selectedEvent.title}</span>
          </div>
          <button onClick={() => setSelectedEvent(null)} style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Change</button>
        </div>
      )}

      {/* Manual entry */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, color: '#94a3b8' }} />
        <input
          style={{ width: '100%', padding: '13px 14px 13px 42px', borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#fff' }}
          placeholder="Manual ticket reference or ID..."
          value={manualRef}
          onChange={e => setManualRef(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifyQR(manualRef, true)}
        />
        {manualRef && <button onClick={() => verifyQR(manualRef, true)} style={{ position: 'absolute', right: 10, background: '#000', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>CHECK</button>}
      </div>

      {/* NFC button — Web NFC API (Android Chrome only) */}
      {typeof window !== 'undefined' && 'NDEFReader' in window && (
        <NFCButton onScan={verifyQR} eventId={selectedEvent?.id} />
      )}

      {/* Status card */}
      <div style={{ background: cfg.bg, border: `2px solid ${cfg.accent}33`, borderRadius: 28, padding: '36px 20px 28px', color: '#fff', textAlign: 'center', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 120, height: 120, background: `${cfg.accent}22`, borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

        {/* Tier badge */}
        {status.tier && (
          <div style={{ position: 'absolute', top: 15, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: `${cfg.accent}22`, border: `1px solid ${cfg.accent}44`, borderRadius: 20, padding: '3px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={10} color={cfg.accent} />
              <span style={{ fontSize: 9, fontWeight: 900, color: cfg.accent, letterSpacing: '1.5px' }}>{status.tier.toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* ⭐ EVENT NAME — always shown prominently when available */}
        {status.event_name && (
          <div style={{ marginBottom: 12, marginTop: status.tier ? 14 : 0 }}>
            <p style={{ margin: 0, fontSize: 11, color: `${cfg.accent}80`, fontWeight: 900, letterSpacing: '1.5px', marginBottom: 3 }}>EVENT</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: cfg.accent, letterSpacing: '-.3px' }}>{status.event_name}</p>
          </div>
        )}

        <div style={{ marginBottom: 12, color: cfg.accent }}>{cfg.icon}</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 950, letterSpacing: '-1px', color: cfg.accent }}>{status.message}</h1>
        <p style={{ margin: '0 0 4px', opacity: .85, fontSize: 16, fontWeight: 700 }}>{status.sub}</p>

        {/* Forged QR warning box */}
        {status.reason === 'FORGED_QR' && (
          <div style={{ marginTop: 16, background: 'rgba(220,38,38,.15)', border: '1px solid rgba(220,38,38,.4)', borderRadius: 14, padding: '10px 14px' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#fca5a5' }}>🚨 This QR code was not issued by OUSTED. The cryptographic signature is invalid. Deny entry and alert security if necessary.</p>
          </div>
        )}

        {!isScanning && (
          <button onClick={() => { setIsScanning(true); setManualRef(''); }} style={{ marginTop: 20, width: '100%', padding: '14px', background: '#fff', color: '#000', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
            ↩ READY FOR NEXT SCAN
          </button>
        )}
      </div>

      {/* Scanner */}
      {isScanning && <div style={{ borderRadius: 22, overflow: 'hidden', border: '4px solid #000', marginBottom: 14 }}><div id="reader" /></div>}

      {/* History */}
      <div style={{ background: '#fff', borderRadius: 20, padding: 15, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 900, color: '#94a3b8', marginBottom: 12, letterSpacing: '1.5px' }}>
          <HistoryIcon size={13} />RECENT CHECK-INS ({scanHistory.length})
        </div>
        {scanHistory.length === 0
          ? <p style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 13, margin: '16px 0', fontWeight: 600 }}>No check-ins yet</p>
          : scanHistory.map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', padding: '11px 13px', borderRadius: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.guest}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#0ea5e9' }}>{item.tier}</span> · {item.event} · {item.time}
                </p>
              </div>
              <UserCheck size={16} color="#22c55e" style={{ flexShrink: 0, marginLeft: 10 }} />
            </div>
          ))}
      </div>
    </div>
  );
}
