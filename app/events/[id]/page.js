"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, MapPin, Calendar, ShieldCheck, Loader2, User, Mail, CheckCircle2, Download, Clock, Share2, AlertCircle, Navigation, Car, Heart, Users, Zap, Star, Award, TrendingUp, Bell, X, Plus, Minus, Phone } from 'lucide-react';

const LuxuryMap = dynamic(() => import('../../../components/LuxuryMap'), { ssr: false, loading: () => <div style={{ height:'100%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center' }}><Loader2 className="animate-spin"/></div> });

const formatDate = (d) => { if (!d) return 'Date TBA'; return new Date(d).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}); };
const formatTime = (t) => t ? t.substring(0,5) : 'Time TBA';

// ── SCARCITY BADGE ─────────────────────────────────────────────────────────
function ScarcityBadge({ sold, max }) {
  if (!max || max === 0) return null;
  const pct = Math.round((sold / max) * 100);
  const rem = Math.max(0, max - sold);
  if (pct < 20) return null;
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
  const msg = pct >= 90 ? `⚠️ Only ${rem} left!` : pct >= 70 ? `⚡ ${rem} remaining — selling fast` : `✓ ${rem} available`;
  return (
    <div style={{ background: pct >= 90 ? '#fef2f2' : pct >= 70 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${color}33`, borderRadius: '12px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <div style={{ width: '6px', height: '6px', background: color, borderRadius: '50%', animation: pct >= 80 ? 'pulse 1s infinite' : 'none' }} />
      <span style={{ fontSize: '12px', fontWeight: 800, color }}>{msg}</span>
      <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginLeft: '8px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}

// ── LIVE ACTIVITY FEED ─────────────────────────────────────────────────────
function LiveActivity({ purchases, viewers }) {
  if (!purchases?.length && !viewers) return null;
  return (
    <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '14px 16px', border: '1px solid #f1f5f9', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: purchases?.length ? '12px' : 0 }}>
        <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a' }}>{viewers > 1 ? `${viewers} people viewing this right now` : 'Live'}</span>
      </div>
      {purchases?.slice(0, 2).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderTop: i === 0 ? '1px solid #f1f5f9' : 'none' }}>
          <div style={{ width: '28px', height: '28px', background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>
            {p.name[0]}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700 }}>{p.name} bought a {p.tier} ticket</p>
            <p style={{ margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{p.minutesAgo} min ago</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── WAITLIST FORM ──────────────────────────────────────────────────────────
function WaitlistModal({ event, tier, onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(null);

  const join = async () => {
    if (!email.includes('@')) return alert('Valid email required');
    setLoading(true);
    try {
      const res = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: event.id, tier_id: tier.id, email, name }) });
      const data = await res.json();
      if (data.success) setPosition(data.position);
      else alert(data.error || 'Failed to join waitlist');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(8px)', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '30px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 40px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: '22px' }}>Join Waitlist</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        {position ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 20px', display: 'block' }} />
            <h4 style={{ fontWeight: 900, fontSize: '20px' }}>You're #{position}!</h4>
            <p style={{ color: '#64748b', fontWeight: 600 }}>We'll email you instantly if a spot opens up.</p>
            <button onClick={onClose} style={{ marginTop: '20px', background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', width: '100%' }}>DONE</button>
          </div>
        ) : (
          <>
            <p style={{ color: '#64748b', fontWeight: 600, fontSize: '14px', marginBottom: '20px' }}>This tier is sold out. Join the waitlist and we'll notify you first if a ticket becomes available.</p>
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <User size={16} color="#94a3b8" /><input value={name} onChange={e => setName(e.target.value)} placeholder="Your Name" style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600 }} />
            </div>
            <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Mail size={16} color="#94a3b8" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600 }} />
            </div>
            <button onClick={join} disabled={loading} style={{ width: '100%', background: '#000', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'JOINING...' : 'JOIN WAITLIST'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN EVENT PAGE ─────────────────────────────────────────────────────────
export default function EventPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [currentImg, setCurrentImg] = useState(0);
  const [selectedTier, setSelectedTier] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [soldCounts, setSoldCounts] = useState({});
  const [reseller, setReseller] = useState(null);
  const [isResellerMode, setIsResellerMode] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [socialProof, setSocialProof] = useState(null);
  const [sessionToken] = useState(() => Math.random().toString(36).slice(2));
  const [showWaitlist, setShowWaitlist] = useState(null);
  const [wishlist, setWishlist] = useState(new Set());
  const [isWished, setIsWished] = useState(false);

  const activeTier = useMemo(() => event?.ticket_tiers?.find(t => t.id === selectedTier), [event, selectedTier]);

  // Load event
  useEffect(() => {
    async function init() {
      try {
        const { data: eventData, error } = await supabase.from('events').select(`*,organizers:organizer_profile_id(business_name,paystack_subaccount_code),ticket_tiers(*)`).eq('id', id).single();
        if (error) throw error;
        if (eventData.is_deleted) { setEvent('DELETED'); return; }

        const { data: ticketData } = await supabase.from('tickets').select('tier_id').eq('event_id', id).eq('status', 'valid');
        const counts = {};
        ticketData?.forEach(t => { counts[t.tier_id] = (counts[t.tier_id] || 0) + 1; });
        setSoldCounts(counts);
        setEvent(eventData);

        const sortedTiers = eventData.ticket_tiers?.sort((a,b)=>a.price-b.price);
        if (sortedTiers?.length) setSelectedTier(sortedTiers[0].id);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) { setUser(currentUser); setGuestEmail(currentUser.email); setGuestName(currentUser.user_metadata?.full_name || ''); }
      } catch (err) { console.error(err); setEvent(null); }
      finally { setFetching(false); }
    }
    if (id) init();
  }, [id]);

  // Check wishlist
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('ousted_wishlist') || '[]'); setIsWished(s.includes(id)); } catch {}
  }, [id]);

  // Social proof polling
  useEffect(() => {
    if (!id) return;
    const fetchProof = () => fetch(`/api/social-proof?event_id=${id}&session=${sessionToken}`).then(r => r.ok ? r.json() : null).then(d => { if (d) setSocialProof(d); }).catch(() => {});
    fetchProof();
    const interval = setInterval(fetchProof, 20000);
    return () => clearInterval(interval);
  }, [id, sessionToken]);

  // Poll for ticket after payment
  useEffect(() => {
    if (!paymentSuccess?.reference) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from('tickets').select('*').eq('reference', paymentSuccess.reference).single();
      if (data) { setTicket(data); clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [paymentSuccess]);

  // Reseller tracking
  useEffect(() => {
    if (!refCode || !id) return;
    const validate = async () => {
      const { data } = await supabase.from('event_resellers').select(`*,resellers!reseller_id(id,paystack_subaccount_code)`).eq('unique_code', refCode).eq('event_id', id).single();
      if (data) { setReseller(data); setIsResellerMode(true); await supabase.rpc('increment_reseller_clicks', { link_id: data.id }); }
    };
    localStorage.setItem('active_reseller_code', refCode);
    validate();
  }, [refCode, id]);

  // Auto-verify on return from Paystack — resilient with retries
  useEffect(() => {
    if (!event || event === 'DELETED') return;
    const verify = async () => {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('reference') || params.get('trxref');
      const ps = params.get('payment');
      if (!ref || ps !== 'success') return;
      setIsProcessing(true);
      window.history.replaceState({}, '', `/events/${id}`);

      // Retry up to 5 times with backoff (webhook may be slightly delayed)
      let attempts = 0;
      const maxAttempts = 5;
      const attemptVerify = async () => {
        try {
          const res = await fetch(`/api/checkout/verify?reference=${encodeURIComponent(ref)}`);
          const data = await res.json();

          if (data.ticket_ready && data.ticket) {
            setPaymentSuccess({
              reference: ref,
              customer: data.ticket.guest_email || guestName || 'Guest',
              tier: data.ticket.tier_name || activeTier?.name || 'Ticket'
            });
            setIsProcessing(false);
            return;
          }

          if (data.status === 'processing' || data.status === 'paid') {
            // Webhook in flight — retry with backoff
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(attemptVerify, 2000 * attempts);
            } else {
              // Show partial success — payment confirmed but ticket still processing
              setPaymentSuccess({ reference: ref, customer: guestEmail || 'Guest', tier: 'Processing...', pending: true });
              setIsProcessing(false);
            }
            return;
          }

          // Not confirmed
          setIsProcessing(false);
          alert(`Payment not confirmed. If you were charged, contact support with reference: ${ref}`);
        } catch {
          attempts++;
          if (attempts < maxAttempts) setTimeout(attemptVerify, 3000);
          else { setIsProcessing(false); alert(`Verification error. Save this reference: ${ref}`); }
        }
      };
      await attemptVerify();
    };
    verify();
  }, [id, event]);

  // Real-time sold counts
  useEffect(() => {
    const channel = supabase.channel('rt_tickets').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets', filter: `event_id=eq.${id}` }, (payload) => {
      setSoldCounts(prev => ({ ...prev, [payload.new.tier_id]: (prev[payload.new.tier_id] || 0) + 1 }));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Pricing: organizer keeps full price. 5% platform fee added on top. Reseller adds 10% on top.
  const getDisplayPrice = (price) => {
    if (!price) return 0;
    const base = Number(price);
    const platformFee = base * 0.05;
    const resellerMarkup = isResellerMode ? base * 0.10 : 0;
    return (base + platformFee + resellerMarkup).toFixed(2);
  };
  const getPlatformFee = (price) => price ? (Number(price) * 0.05).toFixed(2) : '0.00';
  const getResellerMarkup = (price) => isResellerMode && price ? (Number(price) * 0.10).toFixed(2) : null;

  const handleRide = useCallback((type) => {
    if (!event?.lat || !event?.lng) { alert('Location coordinates not available.'); return; }
    const lat = event.lat, lng = event.lng, label = encodeURIComponent(event.location || event.title);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const urls = {
      maps: isIOS ? `maps://?daddr=${lat},${lng}&q=${label}` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      uber: `uber://?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${label}`,
      uberWeb: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}`,
      bolt: `bolt://riderequest?destination_latitude=${lat}&destination_longitude=${lng}`,
      boltWeb: `https://bolt.eu/`,
      yango: `yango://route?end-lat=${lat}&end-lon=${lng}`,
      yangoWeb: `https://yango.com/`
    };
    if (type === 'maps') { window.location.href = urls.maps; return; }
    window.location.href = urls[type];
    setTimeout(() => { if (!document.hidden) window.open(urls[`${type}Web`], '_blank'); }, 2000);
  }, [event]);

  const handlePurchase = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!guestEmail || !guestEmail.includes('@')) { alert('Please enter a valid email address.'); return; }
    if (!selectedTier) { alert('Please select a ticket tier.'); return; }
    setIsProcessing(true);
    try {
      const res = await fetch('/api/checkout/secure-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id, tier_id: selectedTier, email: guestEmail.trim().toLowerCase(), guest_name: guestName.trim() || 'Guest', reseller_code: refCode || 'DIRECT', quantity: quantity || 1 })
      });
      const data = await res.json();
      if (!res.ok || !data.authorization_url) { alert(`Error: ${data.error || 'Payment initialization failed'}`); setIsProcessing(false); return; }
      window.location.href = data.authorization_url;
    } catch (err) { console.error(err); alert('An error occurred. Please try again.'); setIsProcessing(false); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: event?.title, text: `Check out ${event?.title}!`, url }); } catch {} }
    else { navigator.clipboard.writeText(url); alert('Link copied!'); }
  };

  const toggleWishlist = () => {
    try {
      const s = JSON.parse(localStorage.getItem('ousted_wishlist') || '[]');
      const next = isWished ? s.filter(x => x !== id) : [...s, id];
      localStorage.setItem('ousted_wishlist', JSON.stringify(next));
      setIsWished(!isWished);
    } catch {}
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (fetching) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <Loader2 className="animate-spin" size={40} color="#000" />
      <p style={{ fontWeight: 800, marginTop: '20px', letterSpacing: '2px', fontSize: '12px', color: '#94a3b8' }}>AUTHENTICATING...</p>
    </div>
  );

  if (event === 'DELETED' || !event) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', gap: '20px' }}>
      <AlertCircle size={48} color="#ef4444" />
      <h2 style={{ margin: 0, fontWeight: 900 }}>EVENT UNAVAILABLE</h2>
      <button onClick={() => router.push('/')} style={{ background: '#000', color: '#fff', border: 'none', padding: '16px 32px', borderRadius: '16px', fontWeight: 900, cursor: 'pointer' }}>RETURN HOME</button>
    </div>
  );

  // ── SUCCESS TICKET VIEW ──────────────────────────────────────────────────
  if (paymentSuccess) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(paymentSuccess.reference)}&qzone=2&format=png`;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}} @keyframes successPop{0%{transform:scale(0.5);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>
        <div style={{ maxWidth: '460px', width: '100%', background: '#fff', borderRadius: '40px', padding: '48px', boxShadow: '0 40px 80px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', animation: 'successPop 0.5s ease' }}>
              <CheckCircle2 size={40} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 950, letterSpacing: '-1px', margin: '0 0 8px' }}>ACCESS GRANTED</h2>
            <p style={{ color: '#64748b', fontWeight: 600, margin: '0 0 28px' }}>Your ticket is confirmed and ready</p>

            <div style={{ background: '#000', borderRadius: '24px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', textAlign: 'left', marginBottom: '28px', color: '#fff' }}>
              {[['ATTENDEE', paymentSuccess.customer], ['TIER', paymentSuccess.tier], ['EVENT', event.title?.substring(0, 20)], ['DATE', formatDate(event.date).substring(0, 15)]].map(([l, v]) => (
                <div key={l}><div style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', marginBottom: '4px' }}>{l}</div><div style={{ fontSize: '13px', fontWeight: 700 }}>{v}</div></div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <img src={qrUrl} alt="Ticket QR" style={{ width: '180px', height: '180px', borderRadius: '20px', border: '1px solid #f1f5f9', padding: '10px' }} onError={e => e.target.style.display = 'none'} />
              <p style={{ marginTop: '12px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>SECURE REF: {paymentSuccess.reference}</p>
            </div>

            {event.lat && event.lng && (
              <>
                <div style={{ height: '280px', borderRadius: '24px', overflow: 'hidden', marginBottom: '16px', border: '1px solid #f1f5f9', position: 'relative' }}>
                  <LuxuryMap lat={event.lat} lng={event.lng} />
                  <div style={{ position: 'absolute', bottom: '15px', left: '15px', right: '15px', background: '#fff', padding: '10px 14px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 999 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '11px' }}>{event.location}</p>
                    <button onClick={() => handleRide('maps')} style={{ background: '#000', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Navigation size={11} /> GO</button>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '20px', marginBottom: '24px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}><Car size={16} color="#000" /><span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>TRAVEL CONCIERGE</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {['uber', 'bolt', 'yango'].map(app => (
                      <button key={app} onClick={() => handleRide(app)} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>{app.charAt(0).toUpperCase() + app.slice(1)}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: '#f1f5f9', color: '#000', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}><Download size={16} /> SAVE</button>
              <button onClick={() => window.location.reload()} style={{ flex: 1, background: '#000', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', fontSize: '13px' }}>DONE</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sortedTiers = [...(event.ticket_tiers || [])].sort((a, b) => a.price - b.price);
  const totalPrice = activeTier ? (Number(getDisplayPrice(activeTier.price)) * quantity).toFixed(2) : 0;

  // ── MAIN RENDER ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '20px 16px 100px', fontFamily: '"Inter",sans-serif' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:1024px){.cg{grid-template-columns:1fr!important;gap:40px!important}.mf{height:420px!important}.sb{position:relative!important;top:0!important}}
        @media(max-width:480px){.mf{height:320px!important}}
      `}</style>

      {showWaitlist && <WaitlistModal event={event} tier={showWaitlist} onClose={() => setShowWaitlist(null)} />}

      {/* NAV */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px', animation: 'fadeIn 0.4s ease' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid #f1f5f9', padding: '10px 18px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', backdropFilter: 'blur(10px)' }}>
          <ChevronLeft size={18} /> BACK
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={toggleWishlist} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'transform 0.2s', transform: isWished ? 'scale(1.15)' : 'scale(1)' }}>
            <Heart size={17} fill={isWished ? '#e73c7e' : 'none'} color={isWished ? '#e73c7e' : '#000'} />
          </button>
          <button onClick={handleShare} style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            <Share2 size={17} />
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="cg" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '55px', animation: 'fadeIn 0.5s ease' }}>
        {/* GALLERY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <div className="mf" style={{ width: '100%', borderRadius: '36px', overflow: 'hidden', height: '640px', background: '#f1f5f9', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.06)' }}>
            <img src={event.images?.[currentImg] || 'https://via.placeholder.com/800'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={event.title} />
            {event.images?.length > 1 && (
              <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px' }}>
                <button style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }} onClick={() => setCurrentImg(p => (p === 0 ? event.images.length - 1 : p - 1))}>
                  <ChevronLeft size={18} />
                </button>
                <button style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backdropFilter: 'blur(10px)' }} onClick={() => setCurrentImg(p => (p === event.images.length - 1 ? 0 : p + 1))}>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>

          {event.images?.length > 1 && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
              {event.images.map((img, i) => (
                <div key={i} onClick={() => setCurrentImg(i)} style={{ width: '72px', height: '72px', borderRadius: '14px', border: `3px solid ${currentImg === i ? '#000' : 'transparent'}`, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.2s' }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`View ${i+1}`} />
                </div>
              ))}
            </div>
          )}

          <div style={{ background: 'rgba(255,255,255,0.8)', padding: '36px', borderRadius: '28px', border: '1px solid #f1f5f9', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '2px', marginBottom: '18px', textTransform: 'uppercase' }}>ABOUT THIS EXPERIENCE</h3>
            <p style={{ fontSize: '16px', lineHeight: '1.8', color: '#334155', margin: 0 }}>{event.description}</p>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="sb" style={{ position: 'sticky', top: '40px', display: 'flex', flexDirection: 'column', gap: '22px', alignSelf: 'flex-start' }}>
          <div style={{ borderLeft: '4px solid #000', paddingLeft: '18px' }}>
            <span style={{ background: '#000', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, display: 'inline-block', marginBottom: '12px' }}>{event.category || 'LUXURY EXPERIENCE'}</span>
            <h1 style={{ fontSize: '42px', fontWeight: 950, letterSpacing: '-2px', margin: 0, lineHeight: 0.9 }}>{event.title}</h1>
            {isResellerMode && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: '#0284c7', marginTop: '8px' }}><Zap size={12} /> RESELLER LINK</span>}
          </div>

          {/* SPECS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[{ icon: Calendar, color: '#0ea5e9', label: 'DATE', value: formatDate(event.date) },
              { icon: Clock, color: '#f43f5e', label: 'TIME', value: formatTime(event.time) }].map(({ icon: Icon, color, label, value }) => (
              <div key={label} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', background: 'rgba(255,255,255,0.8)', borderRadius: '18px', border: '1px solid #f1f5f9', backdropFilter: 'blur(10px)' }}>
                <Icon size={18} color={color} />
                <div><p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', margin: 0, letterSpacing: '1px' }}>{label}</p><p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{value}</p></div>
              </div>
            ))}
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '12px', alignItems: 'center', padding: '14px', background: 'rgba(255,255,255,0.8)', borderRadius: '18px', border: '1px solid #f1f5f9', backdropFilter: 'blur(10px)' }}>
              <MapPin size={18} color="#10b981" />
              <div><p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', margin: 0, letterSpacing: '1px' }}>LOCATION</p><p style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{event.location || 'Venue TBA'}</p></div>
            </div>
          </div>

          {/* SOCIAL PROOF */}
          {socialProof && <LiveActivity purchases={socialProof.recentPurchases} viewers={socialProof.liveViewers} />}

          {/* CHECKOUT CARD */}
          <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '30px', padding: '32px', boxShadow: '0 30px 60px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', backdropFilter: 'blur(10px)' }}>
            <form onSubmit={handlePurchase}>
              <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '16px', color: '#0f172a' }}>1. YOUR DETAILS</h3>
              <div style={{ background: '#f1f5f9', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <User size={16} color="#94a3b8" /><input style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600 }} placeholder="Full Name" value={guestName} onChange={e => setGuestName(e.target.value)} />
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
                <Mail size={16} color="#94a3b8" /><input type="email" style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600 }} placeholder="Email Address" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} required />
              </div>

              <h3 style={{ fontSize: '13px', fontWeight: 900, marginBottom: '14px', color: '#0f172a' }}>2. CHOOSE YOUR TIER</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {sortedTiers.map((tier) => {
                  const sold = soldCounts[tier.id] || 0;
                  const soldOut = tier.max_quantity > 0 && sold >= tier.max_quantity;
                  const display = getDisplayPrice(tier.price);
                  const pct = tier.max_quantity > 0 ? Math.round((sold / tier.max_quantity) * 100) : 0;
                  const isSelected = selectedTier === tier.id;
                  return (
                    <div key={tier.id}>
                      <div
                        onClick={() => !soldOut && setSelectedTier(tier.id)}
                        style={{ padding: '18px', borderRadius: '20px', border: `2px solid ${isSelected ? '#000' : '#f1f5f9'}`, background: isSelected ? '#f8fafc' : (soldOut ? '#f8fafc' : '#fff'), cursor: soldOut ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: soldOut ? 0.6 : 1, transition: 'all 0.2s' }}>
                        <div>
                          <p style={{ fontWeight: 800, fontSize: '15px', margin: '0 0 3px' }}>{tier.name}{soldOut && <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700 }}> · SOLD OUT</span>}</p>
                          {tier.description && <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{tier.description}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '17px', fontWeight: 950, color: '#000' }}>GHS {display}</div>
                          {isResellerMode
                            ? <div style={{ fontSize: '10px', color: '#94a3b8' }}>Base GHS {tier.price} + 10% reseller + 5% fee</div>
                            : <div style={{ fontSize: '10px', color: '#94a3b8' }}>GHS {tier.price} + GHS {getPlatformFee(tier.price)} service fee</div>
                          }
                        </div>
                      </div>
                      {!soldOut && pct >= 40 && <ScarcityBadge sold={sold} max={tier.max_quantity} />}
                      {soldOut && (
                        <button type="button" onClick={() => setShowWaitlist(tier)} style={{ width: '100%', marginTop: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Bell size={13} /> JOIN WAITLIST
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* PRICE SUMMARY */}
              {activeTier && (
                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px 18px', marginBottom: '18px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#64748b' }}>Organizer price × {quantity}</span>
                    <span style={{ fontSize:'14px', fontWeight:800 }}>GHS {(Number(activeTier.price)*quantity).toFixed(2)}</span>
                  </div>
                  {isResellerMode && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:'#64748b' }}>Reseller fee (10%)</span>
                      <span style={{ fontSize:'14px', fontWeight:800 }}>GHS {(Number(activeTier.price)*0.10*quantity).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#64748b' }}>Platform fee (5%)</span>
                    <span style={{ fontSize:'14px', fontWeight:800 }}>GHS {(Number(activeTier.price)*0.05*quantity).toFixed(2)}</span>
                  </div>
                  <div style={{ height:'1px', background:'#e2e8f0', marginBottom:'10px' }}/>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#000' }}>TOTAL</span>
                    <span style={{ fontSize: '20px', fontWeight: 950, color: '#000' }}>GHS {totalPrice}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing || !selectedTier}
                style={{ width: '100%', background: isProcessing || !selectedTier ? '#cbd5e1' : '#000', color: '#fff', padding: '20px', borderRadius: '20px', border: 'none', fontWeight: 900, fontSize: '16px', cursor: isProcessing || !selectedTier ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', transition: 'all 0.2s', letterSpacing: '0.5px' }}>
                {isProcessing ? <><Loader2 className="animate-spin" size={20} /> PROCESSING...</> : 'SECURE MY TICKET →'}
              </button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontSize: '11px', color: '#94a3b8', marginTop: '16px', fontWeight: 600 }}>
              <ShieldCheck size={14} />
              <span>256-bit encrypted · Powered by Paystack · Instant delivery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
