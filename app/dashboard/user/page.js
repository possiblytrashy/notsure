"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, QrCode, Navigation, Share2, Copy, Check, Search, X, Plus, ArrowRight, RefreshCcw, Loader2, ShieldCheck, AlertTriangle, MapPin, ChevronRight } from 'lucide-react';

function PaymentBanner({ reference, onDone }) {
  const [state, setState] = useState('polling');
  const [msg, setMsg] = useState('Confirming your payment...');
  const [payType, setPayType] = useState(null); // 'TICKET' | 'VOTE' | null

  useEffect(() => {
    if (!reference) return;
    let alive = true, attempt = 0;
    const poll = async () => {
      if (!alive) return;
      try {
        const r = await fetch(`/api/payment/status?reference=${encodeURIComponent(reference)}`);
        const d = await r.json();
        if (d.type) setPayType(d.type);
        setMsg(d.message || 'Verifying...');
        if (d.status === 'confirmed') { setState('confirmed'); setTimeout(onDone, 2000); return; }
        if (d.status === 'failed') { setState('failed'); return; }
      } catch {}
      attempt++;
      if (attempt < 9) setTimeout(poll, Math.min(1500 * attempt, 7000));
      else setState('slow');
    };
    poll();
    return () => { alive = false; };
  }, [reference, onDone]);

  const palette = { polling: '#f59e0b', confirmed: '#22c55e', failed: '#ef4444', slow: '#94a3b8' };
  const col = palette[state] || '#f59e0b';

  // Confirmed message depends on payment type
  const confirmedMsg = payType === 'VOTE'
    ? '🗳️ Votes confirmed! Results will update shortly.'
    : '🎉 Ticket confirmed! Appearing in your vault...';

  const slowMsg = payType === 'VOTE'
    ? 'Payment received — votes being recorded. Ref: ' + reference
    : 'Payment received — ticket arriving shortly. Ref: ' + reference;

  return (
    <div style={{ background: `${col}0d`, border: `1px solid ${col}33`, borderRadius: 20, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeUp .3s ease' }}>
      {state === 'polling' ? <Loader2 size={15} color={col} style={{ animation: 'spin 1s linear infinite', flexShrink: 0, marginTop: 2 }} /> : state === 'confirmed' ? <Check size={15} color={col} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={15} color={col} style={{ flexShrink: 0, marginTop: 2 }} />}
      <div>
        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 800, color: col }}>
          {state === 'confirmed' ? confirmedMsg : msg}
        </p>
        {state === 'polling' && <p style={{ margin: 0, fontSize: 11, color: '#555', fontWeight: 600 }}>Keep this page open while we confirm with Paystack</p>}
        {state === 'slow' && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555', fontWeight: 600 }}>{slowMsg}</p>}
        {state === 'failed' && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef444480', fontWeight: 600 }}>Issue with payment. Contact support with ref: {reference}</p>}
      </div>
    </div>
  );
}

function TicketCard({ ticket, onQR, onNav, onShare }) {
  const ev = ticket.events || {};
  const tier = ticket.ticket_tiers?.name || ticket.tier_name || 'GENERAL';
  const isPast = ev.date ? new Date(ev.date) < new Date() : false;
  const isScanned = ticket.is_scanned;
  const statusColor = isScanned ? '#64748b' : isPast ? '#475569' : '#22c55e';
  const statusLabel = isScanned ? 'USED' : isPast ? 'PAST' : 'VALID';

  return (
    <div style={{ borderRadius: 28, overflow: 'hidden', marginBottom: 20, opacity: isPast ? 0.55 : 1, boxShadow: isPast ? 'none' : '0 20px 60px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.06)' }}>
      {/* Hero */}
      <div style={{ height: 155, position: 'relative', overflow: 'hidden', background: ev.image_url ? `url(${ev.image_url}) center/cover` : 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' }}>
        {ev.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(175deg,rgba(0,0,0,.05) 0%,rgba(0,0,0,.88) 100%)' }} />}
        <div style={{ position: 'absolute', top: 13, left: 13, background: 'linear-gradient(135deg,#CDA434,#a07820)', color: '#000', fontSize: 8, fontWeight: 900, padding: '3px 11px', borderRadius: 20, letterSpacing: '1.5px', boxShadow: '0 2px 10px rgba(205,164,52,.5)' }}>{tier.toUpperCase()}</div>
        <div style={{ position: 'absolute', top: 13, right: 13, background: `${statusColor}22`, backdropFilter: 'blur(10px)', border: `1px solid ${statusColor}44`, color: statusColor, fontSize: 8, fontWeight: 900, padding: '4px 11px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: '1px' }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, animation: !isPast && !isScanned ? 'pulse 2s infinite' : 'none' }} />{statusLabel}
        </div>
        <div style={{ position: 'absolute', bottom: 13, left: 14, right: 14 }}>
          <h3 style={{ color: '#fff', fontSize: 19, fontWeight: 950, margin: 0, letterSpacing: '-.5px', lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,.8)' }}>{ev.title || 'Event'}</h3>
        </div>
      </div>
      {/* Perforated tear */}
      <div style={{ position: 'relative', background: '#111', height: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: -9, width: 18, height: 18, borderRadius: '50%', background: '#050505' }} />
        <div style={{ flex: 1, margin: '0 14px', borderTop: '2px dashed rgba(255,255,255,.07)' }} />
        <div style={{ position: 'absolute', right: -9, width: 18, height: 18, borderRadius: '50%', background: '#050505' }} />
      </div>
      {/* Body */}
      <div style={{ background: '#111', padding: '15px 15px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 13 }}>
          {[['📅 DATE', ev.date ? new Date(ev.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA'], ['📍 VENUE', ev.location || 'TBA'], ['🎫 REF', (ticket.ticket_number || ticket.reference || '—').substring(0, 14)], ['💳 PAID', `${ticket.currency || 'GHS'} ${Number(ticket.base_amount || ticket.amount || 0).toFixed(2)}`]].map(([l, v]) => (
            <div key={l}><p style={{ margin: '0 0 2px', fontSize: 8, color: '#444', fontWeight: 900, letterSpacing: '1.5px' }}>{l}</p><p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p></div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onQR(ticket)} style={{ flex: 1, background: '#fff', color: '#000', border: 'none', padding: '13px 0', borderRadius: 14, fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><QrCode size={14} /> SHOW QR</button>
          {ev.lat && ev.lng && <button onClick={() => onNav(ticket)} style={iconBtn}><Navigation size={15} /></button>}
          <button onClick={() => onShare(ticket)} style={iconBtn}><Share2 size={15} /></button>
        </div>
      </div>
    </div>
  );
}

function QRModal({ ticket, userEmail, onClose }) {
  const [copied, setCopied] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const ev = ticket.events || {};
  const copy = () => { navigator.clipboard.writeText(ticket.reference); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  useEffect(() => {
    // Fetch server-signed QR data — prevents any forgery
    fetch(`/api/tickets/qr-data?ref=${encodeURIComponent(ticket.reference)}&email=${encodeURIComponent(userEmail || ticket.guest_email || '')}`)
      .then(r => r.json())
      .then(d => { setQrData(d.qr_data || ticket.reference); setQrLoading(false); })
      .catch(() => { setQrData(ticket.reference); setQrLoading(false); });
  }, [ticket.reference, userEmail, ticket.guest_email]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.97)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeUp .25s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 340 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,.07)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', fontSize: 9, fontWeight: 900, padding: '3px 13px', borderRadius: 20, letterSpacing: '2px', marginBottom: 10 }}>{(ticket.ticket_tiers?.name || 'TICKET').toUpperCase()}</div>
          <h3 style={{ color: '#fff', fontWeight: 950, fontSize: 22, margin: '0 0 4px', letterSpacing: '-.5px' }}>{ev.title}</h3>
          <p style={{ color: '#555', fontSize: 12, fontWeight: 600, margin: 0 }}>{ev.date ? new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}{ev.location ? ` · ${ev.location}` : ''}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 24, padding: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 0 60px rgba(205,164,52,.2)', minHeight: 264 }}>
          {qrLoading
            ? <div style={{ width: 44, height: 44, border: '3px solid #eee', borderTop: '3px solid #CDA434', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            : <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000&qzone=2`} alt="QR" style={{ width: 220, height: 220, display: 'block' }} />
          }
        </div>
        <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 16, padding: '13px 15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div><p style={{ margin: '0 0 3px', fontSize: 8, color: '#444', fontWeight: 900, letterSpacing: '2px' }}>REFERENCE</p><p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>{ticket.reference}</p></div>
          <button onClick={copy} style={{ background: copied ? '#22c55e20' : 'rgba(255,255,255,.07)', border: `1px solid ${copied ? '#22c55e44' : 'rgba(255,255,255,.1)'}`, color: copied ? '#22c55e' : '#fff', width: 36, height: 36, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#444', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><ShieldCheck size={11} color="#22c55e" /> Cryptographically signed · Cannot be forged</p>
      </div>
    </div>
  );
}

function TransportSheet({ ticket, onClose }) {
  const ev = ticket.events || {};
  const lat = ev.lat, lng = ev.lng;
  const name = encodeURIComponent(ev.location || ev.title || 'Venue');
  const apps = [
    { label: 'Uber', emoji: '🚗', deep: `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${name}`, web: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}` },
    { label: 'Bolt', emoji: '⚡', deep: `bolt://riderequest?destination_latitude=${lat}&destination_longitude=${lng}`, web: 'https://bolt.eu/' },
    { label: 'Yango', emoji: '🟡', deep: `yango://route?end-lat=${lat}&end-lon=${lng}`, web: 'https://yango.com/' },
    { label: 'Lyft', emoji: '🩷', deep: `lyft://ridetype?id=lyft&destination[latitude]=${lat}&destination[longitude]=${lng}`, web: 'https://www.lyft.com/' },
    { label: 'Google Maps', emoji: '🗺️', deep: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, web: null },
    { label: 'Apple Maps', emoji: '🍎', deep: `maps://?daddr=${lat},${lng}`, web: `https://maps.apple.com/?daddr=${lat},${lng}` },
  ];
  const open = (app) => { if (!app.web) { window.open(app.deep, '_blank'); return; } window.location.href = app.deep; setTimeout(() => window.open(app.web, '_blank'), 1800); };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', width: '100%', borderRadius: '28px 28px 0 0', padding: '20px 18px 48px', border: '1px solid rgba(255,255,255,.08)', animation: 'slideUp .3s ease' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}><MapPin size={14} color="#CDA434" /><h3 style={{ color: '#fff', fontWeight: 950, fontSize: 18, margin: 0 }}>Get to {ev.location || 'the venue'}</h3></div>
        <p style={{ color: '#444', fontSize: 12, fontWeight: 600, margin: '0 0 20px 24px' }}>{ev.title}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {apps.map(app => <button key={app.label} onClick={() => open(app)} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 20, padding: '18px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 26 }}>{app.emoji}</span><span style={{ color: '#bbb', fontSize: 10, fontWeight: 800 }}>{app.label}</span></button>)}
        </div>
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isReseller, setIsReseller] = useState(false);
  const [resellerEarnings, setResellerEarnings] = useState(null);
  const [qrTicket, setQrTicket] = useState(null);
  const [navTicket, setNavTicket] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [pendingRef, setPendingRef] = useState(null);

  const loadTickets = useCallback(async (u) => {
    const { data } = await supabase.from('tickets').select('*, events!event_id(id,title,date,time,location,lat,lng,image_url), ticket_tiers:tier_id(name)').eq('guest_email', u.email).order('created_at', { ascending: false });
    setTickets(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);
      if (typeof window !== 'undefined') {
        const p = new URLSearchParams(window.location.search);
        const ref = p.get('reference') || p.get('trxref');
        if (ref) { setPendingRef(ref); window.history.replaceState({}, '', '/dashboard/user'); }
      }
      await Promise.all([loadTickets(u), (async () => {
        const { data: r } = await supabase.from('resellers').select('id,is_active,total_earned').eq('user_id', u.id).maybeSingle();
        if (r?.is_active) { setIsReseller(true); setResellerEarnings(r.total_earned || 0); }
      })()]);
    })();
  }, [router, loadTickets]);

  const refresh = async () => { if (!user || refreshing) return; setRefreshing(true); await loadTickets(user); };
  const handleShare = (t) => { const text = `🎟️ I'm going to ${t.events?.title}!`; navigator.share ? navigator.share({ title: t.events?.title, text }) : navigator.clipboard.writeText(text); };

  const now = new Date();
  const filtered = tickets.filter(t => {
    const d = t.events?.date ? new Date(t.events.date) : null;
    const mF = filter === 'all' ? true : filter === 'upcoming' ? (!d || d >= now) : (d && d < now);
    const mS = !search || t.events?.title?.toLowerCase().includes(search.toLowerCase()) || (t.ticket_number || '').toLowerCase().includes(search.toLowerCase()) || (t.reference || '').toLowerCase().includes(search.toLowerCase());
    return mF && mS;
  });

  const upcoming = tickets.filter(t => !t.events?.date || new Date(t.events.date) >= now);
  const nextEvent = [...upcoming].sort((a, b) => new Date(a.events?.date) - new Date(b.events?.date))[0];
  const daysUntil = nextEvent?.events?.date ? Math.ceil((new Date(nextEvent.events.date) - now) / 86400000) : null;
  const spent = tickets.reduce((a, t) => a + Number(t.base_amount || t.amount || 0), 0);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 48, height: 48, border: '2px solid rgba(205,164,52,.15)', borderTop: '2px solid #CDA434', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <p style={{ marginTop: 18, fontSize: 9, letterSpacing: 4, color: '#2a2a2a', fontWeight: 900 }}>LOADING YOUR VAULT</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
        *{box-sizing:border-box}
      `}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,5,5,.93)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '12px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🎟</div>
            <div><h1 style={{ fontSize: 15, fontWeight: 950, letterSpacing: '-.3px', margin: 0, lineHeight: 1 }}>MY VAULT</h1><p style={{ margin: '2px 0 0', fontSize: 10, color: '#444', fontWeight: 700 }}>{user?.email?.split('@')[0]}</p></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={refresh} style={btnSm}><RefreshCcw size={13} style={{ animation: refreshing ? 'spin .8s linear infinite' : 'none' }} /></button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={btnSm}><LogOut size={13} /></button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 15px 100px' }}>
        {pendingRef && <PaymentBanner reference={pendingRef} onDone={() => { setPendingRef(null); loadTickets(user); }} />}

        {/* Next event hero */}
        {nextEvent && daysUntil !== null && (
          <div style={{ background: nextEvent.events?.image_url ? `linear-gradient(170deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,.92) 100%),url(${nextEvent.events.image_url}) center/cover` : 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', borderRadius: 24, padding: '22px 20px', marginBottom: 18, animation: 'fadeUp .5s ease' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#22c55e18', border: '1px solid #22c55e30', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: '#22c55e', letterSpacing: '1.5px' }}>NEXT EVENT</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 950, margin: '0 0 5px', letterSpacing: '-.5px', lineHeight: 1.2 }}>{nextEvent.events?.title}</h2>
            {nextEvent.events?.location && <p style={{ margin: '0 0 14px', fontSize: 12, color: '#888', fontWeight: 700 }}>📍 {nextEvent.events.location}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', borderRadius: 14, padding: '10px 18px' }}>
                <p style={{ margin: 0, fontSize: 9, fontWeight: 900, color: 'rgba(0,0,0,.5)', letterSpacing: '1.5px' }}>IN</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 950, color: '#000', letterSpacing: '-1px' }}>{daysUntil === 0 ? 'TODAY' : `${daysUntil}d`}</p>
              </div>
              <button onClick={() => setQrTicket(nextEvent)} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', color: '#fff', borderRadius: 14, padding: '12px 18px', cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <QrCode size={14} /> SHOW TICKET
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18, animation: 'fadeUp .5s ease .08s both' }}>
          {[['🎟️', tickets.length, 'TICKETS'], ['📅', upcoming.length, 'UPCOMING'], [`GHS ${spent.toFixed(0)}`, null, 'TOTAL SPENT']].map(([emoji, num, label]) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 20, padding: '14px 10px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: num !== null ? 20 : 13, fontWeight: 950, letterSpacing: '-1px' }}>{num !== null ? num : emoji}</p>
              {num !== null && <p style={{ margin: '0 0 2px', fontSize: 12, color: '#777' }}>{emoji}</p>}
              <p style={{ margin: 0, fontSize: 8, color: '#444', fontWeight: 900, letterSpacing: '1.5px' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Reseller */}
        {isReseller ? (
          <div onClick={() => router.push('/reseller/dashboard')} style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', borderRadius: 22, padding: '18px 20px', marginBottom: 18, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeUp .5s ease .12s both', boxShadow: '0 12px 40px rgba(205,164,52,.25)' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 9, color: 'rgba(0,0,0,.45)', fontWeight: 900, letterSpacing: '2px' }}>YOUR RESELLER EARNINGS</p>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 950, color: '#000', letterSpacing: '-1.5px' }}>GHS {Number(resellerEarnings || 0).toFixed(2)}</p>
            </div>
            <ChevronRight size={18} color="rgba(0,0,0,.4)" />
          </div>
        ) : (
          <div onClick={() => router.push('/reseller/onboard')} style={{ background: 'rgba(205,164,52,.06)', border: '1px solid rgba(205,164,52,.14)', borderRadius: 22, padding: '15px 18px', marginBottom: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp .5s ease .12s both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, background: 'rgba(205,164,52,.1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💰</div>
              <div><p style={{ margin: 0, fontWeight: 900, color: '#CDA434', fontSize: 14 }}>Earn as a Reseller</p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#555', fontWeight: 600 }}>10% commission on every ticket you sell</p></div>
            </div>
            <ArrowRight size={15} color="#CDA434" />
          </div>
        )}

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '10px 14px', marginBottom: 11 }}>
          <Search size={13} color="#444" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets or events..." style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0 }}><X size={13} /></button>}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[['upcoming', '📅 Upcoming'], ['past', '⏰ Past'], ['all', '🎟 All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: filter === v ? '#fff' : 'rgba(255,255,255,.05)', color: filter === v ? '#000' : '#555', fontSize: 11, fontWeight: 900, cursor: 'pointer', transition: 'all .15s' }}>{l}</button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#333', fontWeight: 700, alignSelf: 'center' }}>{filtered.length}</span>
        </div>

        {/* Tickets list */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🎟️</div>
            <h3 style={{ color: '#333', fontWeight: 900, margin: '0 0 8px' }}>{filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : 'No tickets yet'}</h3>
            <p style={{ color: '#2a2a2a', fontSize: 13, margin: '0 0 20px', fontWeight: 600 }}>Your tickets appear here after purchase</p>
            <button onClick={() => router.push('/')} style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', border: 'none', padding: '13px 28px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>BROWSE EVENTS →</button>
          </div>
        ) : (
          <>
            {filtered.map(t => <TicketCard key={t.id} ticket={t} onQR={setQrTicket} onNav={setNavTicket} onShare={handleShare} />)}
            <button onClick={() => router.push('/')} style={{ width: '100%', padding: 14, background: 'none', border: '1px dashed rgba(255,255,255,.07)', borderRadius: 18, color: '#333', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Plus size={12} /> Browse more events
            </button>
          </>
        )}
      </div>

      {qrTicket && <QRModal ticket={qrTicket} userEmail={user?.email} onClose={() => setQrTicket(null)} />}
      {navTicket && <TransportSheet ticket={navTicket} onClose={() => setNavTicket(null)} />}
    </div>
  );
}
const iconBtn = { width: 46, height: 46, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const btnSm = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', color: '#fff', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
