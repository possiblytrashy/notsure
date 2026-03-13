"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import {
  LogOut, Copy, Check, TrendingUp, Zap, Share2,
  Link as LinkIcon, Plus, Search, X, ExternalLink,
  RefreshCcw, ChevronRight, ArrowLeft, Eye, Ticket,
  DollarSign, BarChart3, Calendar, Clock, ShieldCheck,
  ChevronDown, ArrowUpRight, Globe
} from 'lucide-react';

/* ── COPY BUTTON ── */
function CopyBtn({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); };
  return (
    <button onClick={copy} style={{ background: done ? '#22c55e20' : 'rgba(255,255,255,.07)', border: `1px solid ${done ? '#22c55e44' : 'rgba(255,255,255,.1)'}`, color: done ? '#22c55e' : '#aaa', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s', flexShrink: 0 }}>
      {done ? <Check size={12} /> : <Copy size={12} />}{done ? 'COPIED' : (label || 'COPY')}
    </button>
  );
}

/* ── SHARE SHEET ── */
function ShareSheet({ link, onClose }) {
  if (!link) return null;
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${link.event_id}?ref=${link.unique_code}`;
  const text = `🎟️ Get your ticket for ${link.event_title || 'this event'}! Use my link for a seamless checkout:`;

  const channels = [
    { label: 'WhatsApp', emoji: '💬', href: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}` },
    { label: 'X / Twitter', emoji: '🐦', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: 'Telegram', emoji: '✈️', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: 'Facebook', emoji: '📘', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', width: '100%', borderRadius: '28px 28px 0 0', padding: '20px 18px 48px', border: '1px solid rgba(255,255,255,.08)', animation: 'slideUp .3s ease' }}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,.12)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ color: '#fff', fontWeight: 950, fontSize: 18, margin: '0 0 4px' }}>Share & Earn</h3>
        <p style={{ color: '#555', fontSize: 12, fontWeight: 600, margin: '0 0 20px' }}>Every purchase through your link earns you 10%</p>
        {/* URL bar */}
        <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</p>
          <CopyBtn text={url} />
        </div>
        {/* Channel grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {channels.map(ch => (
            <a key={ch.label} href={ch.href} target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '16px 8px', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>{ch.emoji}</span>
              <span style={{ color: '#bbb', fontSize: 10, fontWeight: 800 }}>{ch.label}</span>
            </a>
          ))}
        </div>
        {/* Native share */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <button onClick={() => navigator.share({ title: link.event_title, text, url })} style={{ width: '100%', marginTop: 14, padding: '14px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Share2 size={15} /> Share via system
          </button>
        )}
      </div>
    </div>
  );
}

/* ── LINK CARD ── */
function LinkCard({ link, onShare }) {
  const [expanded, setExpanded] = useState(false);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/events/${link.event_id}?ref=${link.unique_code}`;
  const convRate = link.clicks > 0 ? Math.round((link.tickets_sold / link.clicks) * 100) : 0;

  return (
    <div style={{ background: '#111', borderRadius: 22, overflow: 'hidden', marginBottom: 14, border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 8px 30px rgba(0,0,0,.5)' }}>
      {/* Header */}
      <div style={{ padding: '18px 17px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: link.is_active !== false ? '#22c55e' : '#ef4444', animation: link.is_active !== false ? 'pulse 2s infinite' : 'none' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: link.is_active !== false ? '#22c55e' : '#ef4444', letterSpacing: '1.5px' }}>{link.is_active !== false ? 'ACTIVE' : 'PAUSED'}</span>
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 950, letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.event_title || 'Event'}</h3>
            <p style={{ margin: 0, fontSize: 11, color: '#555', fontWeight: 700, fontFamily: 'monospace' }}>/{link.unique_code}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
            <p style={{ margin: '0 0 2px', fontSize: 9, color: '#444', fontWeight: 900, letterSpacing: '1.5px' }}>EARNED</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 950, color: '#CDA434', letterSpacing: '-1px' }}>GHS {Number(link.total_earned || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[['👆 CLICKS', link.clicks || 0], ['🎟 SOLD', link.tickets_sold || 0], [`📈 CVR`, `${convRate}%`]].map(([l, v]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 3px', fontSize: 8, color: '#444', fontWeight: 900, letterSpacing: '1px' }}>{l}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 950, color: '#fff' }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded URL */}
      {expanded && (
        <div style={{ padding: '0 17px 14px', animation: 'fadeUp .2s ease' }}>
          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: '11px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</p>
            <CopyBtn text={url} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {[
          { icon: <Share2 size={14} />, label: 'SHARE', action: () => onShare(link), highlight: true },
          { icon: <Copy size={14} />, label: 'LINK', action: () => setExpanded(e => !e) },
          { icon: <ExternalLink size={14} />, label: 'VIEW', action: () => window.open(`/events/${link.event_id}`, '_blank') },
        ].map(({ icon, label, action, highlight }) => (
          <button key={label} onClick={action} style={{ flex: 1, background: highlight ? 'rgba(205,164,52,.08)' : 'none', border: 'none', borderRight: '1px solid rgba(255,255,255,.06)', color: highlight ? '#CDA434' : '#555', padding: '13px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, letterSpacing: '1px' }}>
            {icon}{label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── MAIN ── */
export default function ResellerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [reseller, setReseller] = useState(null);
  const [links, setLinks] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'add'
  const [creatingId, setCreatingId] = useState(null);
  const [searchEvents, setSearchEvents] = useState('');
  const [tab, setTab] = useState('active');

  const load = useCallback(async (u) => {
    const { data: r } = await supabase.from('resellers').select('*').eq('user_id', u.id).maybeSingle();
    if (!r?.is_active) { router.push('/reseller/onboard'); return; }
    setReseller(r);

    const { data: myLinks } = await supabase
      .from('event_resellers')
      .select('*, events:event_id(id,title,date,image_url,location)')
      .eq('reseller_id', r.id)
      .order('created_at', { ascending: false });

    setLinks((myLinks || []).map(l => ({ ...l, event_title: l.events?.title, event_date: l.events?.date, event_image: l.events?.image_url })));

    const { data: evs } = await supabase.from('events').select('id,title,date,location,allows_resellers').eq('allows_resellers', true).eq('status', 'active').order('date', { ascending: true });
    setAllEvents(evs || []);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);
      await load(u);
    })();
  }, [router, load]);

  const createLink = async (eventId) => {
    if (!reseller || creatingId) return;
    setCreatingId(eventId);
    try {
      const res = await fetch('/api/reseller/create-my-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, reseller_id: reseller.id })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load(user);
      setView('dashboard');
    } catch (err) {
      alert(err.message || 'Failed to create link');
    }
    setCreatingId(null);
  };

  // Computed stats
  const totalClicks = links.reduce((a, l) => a + (l.clicks || 0), 0);
  const totalSold = links.reduce((a, l) => a + (l.tickets_sold || 0), 0);
  const totalEarned = links.reduce((a, l) => a + Number(l.total_earned || 0), 0);
  const totalPending = Number(reseller?.pending_payout || 0);
  const convRate = totalClicks > 0 ? Math.round((totalSold / totalClicks) * 100) : 0;

  const activeLinks = links.filter(l => l.is_active !== false);
  const filteredEvents = allEvents.filter(e => !links.find(l => l.event_id === e.id) && e.title?.toLowerCase().includes(searchEvents.toLowerCase()));

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 44, height: 44, border: '2px solid rgba(205,164,52,.15)', borderTop: '2px solid #CDA434', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: 9, letterSpacing: 4, color: '#2a2a2a', fontWeight: 900 }}>LOADING</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── ADD EVENTS VIEW ── */
  if (view === 'add') return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}`}</style>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,5,5,.93)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '12px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setView('dashboard')} style={btnSm}><ArrowLeft size={15} /></button>
          <h2 style={{ fontSize: 16, fontWeight: 950, margin: 0 }}>Add Events to Sell</h2>
        </div>
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 15px 80px' }}>
        <div style={{ background: 'rgba(205,164,52,.07)', border: '1px solid rgba(205,164,52,.14)', borderRadius: 18, padding: '13px 16px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Zap size={16} color="#CDA434" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#CDA434' }}>You earn 10% on every ticket sold through your link. No cap.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '10px 14px', marginBottom: 16 }}>
          <Search size={13} color="#444" />
          <input value={searchEvents} onChange={e => setSearchEvents(e.target.value)} placeholder="Search events..." style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontWeight: 600, flex: 1 }} />
        </div>
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
            <p style={{ color: '#444', fontWeight: 700 }}>{searchEvents ? 'No events match your search' : 'No new events available to add right now'}</p>
          </div>
        ) : filteredEvents.map(ev => (
          <div key={ev.id} style={{ background: '#111', borderRadius: 20, padding: '16px 17px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</h4>
              <p style={{ margin: 0, fontSize: 11, color: '#555', fontWeight: 700 }}>{ev.date ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}{ev.location ? ` · ${ev.location}` : ''}</p>
            </div>
            <button onClick={() => createLink(ev.id)} disabled={!!creatingId} style={{ background: creatingId === ev.id ? '#333' : 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', border: 'none', padding: '10px 16px', borderRadius: 12, fontWeight: 900, fontSize: 11, cursor: creatingId ? 'not-allowed' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {creatingId === ev.id ? <><div style={{ width: 12, height: 12, border: '2px solid #555', borderTop: '2px solid #888', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />CREATING</> : <><Plus size={12} />ADD</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── MAIN DASHBOARD VIEW ── */
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
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>💰</div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 950, letterSpacing: '-.3px', margin: 0, lineHeight: 1 }}>RESELLER HQ</h1>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#444', fontWeight: 700 }}>{user?.email?.split('@')[0]}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setRefreshing(true); load(user); }} style={btnSm}><RefreshCcw size={13} style={{ animation: refreshing ? 'spin .8s linear infinite' : 'none' }} /></button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={btnSm}><LogOut size={13} /></button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 15px 100px' }}>

        {/* Earnings hero card */}
        <div style={{ background: 'linear-gradient(135deg,#1a1200 0%,#2a1e00 50%,#1a1200 100%)', border: '1px solid rgba(205,164,52,.2)', borderRadius: 26, padding: '24px 22px', marginBottom: 18, animation: 'fadeUp .5s ease', boxShadow: '0 16px 48px rgba(205,164,52,.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 9, color: 'rgba(205,164,52,.5)', fontWeight: 900, letterSpacing: '2px' }}>TOTAL EARNED</p>
              <p style={{ margin: 0, fontSize: 40, fontWeight: 950, color: '#CDA434', letterSpacing: '-2px', lineHeight: 1 }}>GHS {totalEarned.toFixed(2)}</p>
            </div>
            <div style={{ background: '#22c55e15', border: '1px solid #22c55e30', borderRadius: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 900, color: '#22c55e' }}>ACTIVE</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[['🖱️', totalClicks, 'CLICKS'], ['🎟️', totalSold, 'SOLD'], [`${convRate}%`, null, 'CONV.'], [`${links.length}`, null, 'EVENTS']].map(([emoji, num, label]) => (
              <div key={label} style={{ background: 'rgba(205,164,52,.06)', border: '1px solid rgba(205,164,52,.1)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 3px', fontSize: num !== null ? 18 : 14, fontWeight: 950, color: '#CDA434', letterSpacing: '-0.5px' }}>{num !== null ? num : emoji}</p>
                {num !== null && <p style={{ margin: '0 0 1px', fontSize: 11, color: '#555' }}>{emoji}</p>}
                <p style={{ margin: 0, fontSize: 7, color: 'rgba(205,164,52,.4)', fontWeight: 900, letterSpacing: '1.5px' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Payout row */}
        {totalPending > 0 && (
          <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)', borderRadius: 18, padding: '14px 17px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeUp .5s ease .1s both' }}>
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 9, color: '#22c55e66', fontWeight: 900, letterSpacing: '2px' }}>PENDING PAYOUT</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 950, color: '#22c55e', letterSpacing: '-1px' }}>GHS {totalPending.toFixed(2)}</p>
            </div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#22c55e66', textAlign: 'right' }}>
              <ShieldCheck size={16} color="#22c55e" style={{ display: 'block', marginBottom: 4 }} />
              AUTO-SETTLED<br />VIA PAYSTACK
            </div>
          </div>
        )}

        {/* Add events CTA */}
        <button onClick={() => setView('add')} style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px dashed rgba(255,255,255,.12)', borderRadius: 18, padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', marginBottom: 22, animation: 'fadeUp .5s ease .15s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🎯</div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 13 }}>Add More Events</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#555', fontWeight: 600 }}>{filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} available to sell</p>
            </div>
          </div>
          <ChevronRight size={16} color="#555" />
        </button>

        {/* Links section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 950, margin: 0 }}>Your Links</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['active', 'all'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: tab === t ? '#fff' : 'rgba(255,255,255,.05)', color: tab === t ? '#000' : '#555', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                {t === 'active' ? 'Active' : 'All'} ({t === 'active' ? activeLinks.length : links.length})
              </button>
            ))}
          </div>
        </div>

        {(tab === 'active' ? activeLinks : links).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(255,255,255,.02)', borderRadius: 22, border: '1px dashed rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <p style={{ color: '#444', fontWeight: 800, margin: '0 0 6px', fontSize: 14 }}>No links yet</p>
            <p style={{ color: '#333', fontWeight: 600, fontSize: 12, margin: '0 0 16px' }}>Add events above to start earning</p>
            <button onClick={() => setView('add')} style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', border: 'none', padding: '11px 22px', borderRadius: 12, fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>+ ADD YOUR FIRST EVENT</button>
          </div>
        ) : (
          <div style={{ animation: 'fadeUp .4s ease' }}>
            {(tab === 'active' ? activeLinks : links).map(l => <LinkCard key={l.id} link={l} onShare={setShareLink} />)}
          </div>
        )}

        {/* Performance tip */}
        {links.length > 0 && (
          <div style={{ background: 'rgba(14,165,233,.06)', border: '1px solid rgba(14,165,233,.15)', borderRadius: 18, padding: '14px 16px', marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <TrendingUp size={16} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 800, color: '#0ea5e9' }}>Pro tip: Share in multiple places</p>
              <p style={{ margin: 0, fontSize: 11, color: '#555', fontWeight: 600 }}>Resellers who share on WhatsApp, Instagram Stories, and Twitter convert 3× better. Tap Share on any link to get started.</p>
            </div>
          </div>
        )}
      </div>

      {shareLink && <ShareSheet link={shareLink} onClose={() => setShareLink(null)} />}
    </div>
  );
}

const btnSm = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', color: '#fff', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
