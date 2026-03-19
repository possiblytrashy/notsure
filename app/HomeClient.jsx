"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Search, MapPin, Calendar, ArrowRight, Zap, Flame, Ticket, LayoutGrid, Clock, TrendingUp, Star, ChevronRight, Sparkles, Heart, Shield, CheckCircle, Globe, X, Users, Award } from 'lucide-react';

// LIVE PURCHASE TOAST
function LivePurchaseToast({ purchases }) {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const queue = useRef([]);
  useEffect(() => {
    if (!purchases?.length) return;
    queue.current = [...purchases];
    const show = () => {
      if (!queue.current.length) return;
      setCurrent(queue.current.shift());
      setVisible(true);
      setTimeout(() => { setVisible(false); setTimeout(show, 700); }, 4000);
    };
    const t = setTimeout(show, 3500);
    return () => clearTimeout(t);
  }, [purchases]);
  if (!current) return null;
  return (
    <div style={{ position:'fixed',bottom:'30px',left:'30px',zIndex:9999,transform:visible?'translateY(0) scale(1)':'translateY(100%) scale(0.9)',opacity:visible?1:0,transition:'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',background:'rgba(255,255,255,0.95)',backdropFilter:'blur(20px)',border:'1px solid rgba(0,0,0,0.08)',borderRadius:'20px',padding:'14px 18px',boxShadow:'0 20px 40px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',gap:'12px',maxWidth:'300px' }}>
      <div style={{ width:'36px',height:'36px',background:'#f0fdf4',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><Ticket size={16} color="#16a34a" /></div>
      <div><p style={{ margin:0,fontSize:'12px',fontWeight:800,color:'#000' }}>{current.name} just bought</p><p style={{ margin:0,fontSize:'11px',color:'#64748b',fontWeight:600,marginTop:'2px' }}>{current.tier} · {current.minutesAgo}m ago</p></div>
      <div style={{ width:'6px',height:'6px',background:'#16a34a',borderRadius:'50%',boxShadow:'0 0 8px #16a34a',flexShrink:0 }} />
    </div>
  );
}

// COUNTDOWN
function EventCountdown({ dateString }) {
  const [t, setT] = useState({ d:0,h:0,m:0,s:0 });
  useEffect(() => {
    const tick = () => { const d=new Date(dateString)-new Date(); if(d<=0){setT({d:0,h:0,m:0,s:0});return;} setT({d:Math.floor(d/86400000),h:Math.floor((d%86400000)/3600000),m:Math.floor((d%3600000)/60000),s:Math.floor((d%60000)/1000)}); };
    tick(); const id=setInterval(tick,1000); return ()=>clearInterval(id);
  }, [dateString]);
  const U=(v,l)=><div style={{textAlign:'center',minWidth:'32px'}}><div style={{fontSize:'17px',fontWeight:950,lineHeight:1}}>{String(v).padStart(2,'0')}</div><div style={{fontSize:'8px',fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:'1px',marginTop:'2px'}}>{l}</div></div>;
  const sep=<span style={{fontSize:'14px',opacity:0.3,paddingBottom:'8px'}}>:</span>;
  return <div style={{display:'flex',gap:'6px',alignItems:'center',color:'#fff'}}>{U(t.d,'D')}{sep}{U(t.h,'H')}{sep}{U(t.m,'M')}{sep}{U(t.s,'S')}</div>;
}

// SCARCITY BAR
function ScarcityBar({ percent }) {
  if (!percent || percent < 30) return null;
  const c=percent>=90?'#ef4444':percent>=70?'#f59e0b':'#10b981';
  const label=percent>=90?'🔥 Almost Gone':percent>=70?'⚡ Selling Fast':'✓ Available';
  return (
    <div style={{marginTop:'8px'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
        <span style={{fontSize:'10px',fontWeight:800,color:c}}>{label}</span>
        <span style={{fontSize:'10px',fontWeight:700,color:'#94a3b8'}}>{percent}% sold</span>
      </div>
      <div style={{height:'4px',background:'#f1f5f9',borderRadius:'2px',overflow:'hidden'}}>
        <div style={{height:'100%',width:`${percent}%`,background:c,borderRadius:'2px'}} />
      </div>
    </div>
  );
}

// EVENT CARD
function EventCard({ event, index, wishlist, toggleWishlist, socialProof }) {
  const [hovered, setHovered] = useState(false);
  const tiers = event.ticket_tiers || [];
  const minPrice = tiers.length ? Math.min(...tiers.map(t=>t.price)) : event.price;
  const proof = socialProof?.[event.id];
  const percent = proof?.tierScarcity?.[0]?.percentSold || 0;
  const isWished = wishlist.has(event.id);
  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} style={{ position:'relative',background:'#fff',borderRadius:'28px',overflow:'hidden',cursor:'pointer',transform:hovered?'translateY(-4px)':'translateY(0)',boxShadow:hovered?'0 20px 60px rgba(0,0,0,0.12)':'0 4px 20px rgba(0,0,0,0.04)',transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',border:'1px solid #f1f5f9',animation:`slideUp 0.5s ease ${index*0.05}s both` }}>
      <div style={{position:'relative',height:'220px',overflow:'hidden',background:'#f1f5f9'}}>
        <img src={event.images?.[0]||`https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600`} alt={event.title} style={{width:'100%',height:'100%',objectFit:'cover',transform:hovered?'scale(1.05)':'scale(1)',transition:'transform 0.5s ease'}} />
        <div style={{position:'absolute',top:'12px',left:'12px',display:'flex',gap:'6px'}}>
          {event.category&&<span style={{background:'rgba(0,0,0,0.7)',color:'#fff',padding:'4px 10px',borderRadius:'8px',fontSize:'10px',fontWeight:800,backdropFilter:'blur(10px)'}}>{event.category}</span>}
          {percent>=80&&<span style={{background:'#ef4444',color:'#fff',padding:'4px 10px',borderRadius:'8px',fontSize:'10px',fontWeight:800}}>🔥 {100-percent}% LEFT</span>}
        </div>
        <button onClick={(e)=>{e.preventDefault();e.stopPropagation();toggleWishlist(event.id);}} style={{position:'absolute',top:'12px',right:'12px',width:'34px',height:'34px',borderRadius:'50%',background:'rgba(255,255,255,0.9)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(10px)',transform:isWished?'scale(1.2)':'scale(1)',transition:'transform 0.2s'}}>
          <Heart size={15} fill={isWished?'#e73c7e':'none'} color={isWished?'#e73c7e':'#64748b'} />
        </button>
        {proof?.liveViewers>2&&<div style={{position:'absolute',bottom:'12px',left:'12px',background:'rgba(0,0,0,0.7)',color:'#fff',padding:'4px 10px',borderRadius:'8px',fontSize:'10px',fontWeight:700,display:'flex',alignItems:'center',gap:'5px',backdropFilter:'blur(10px)'}}><div style={{width:'5px',height:'5px',background:'#10b981',borderRadius:'50%'}} />{proof.liveViewers} viewing</div>}
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:'60px',background:'linear-gradient(to top,rgba(0,0,0,0.3),transparent)'}} />
      </div>
      <a href={`/events/${event.id}`} style={{textDecoration:'none',color:'inherit'}}>
        <div style={{padding:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
            <span style={{fontSize:'11px',fontWeight:900,color:'#e73c7e'}}>{new Date(event.date).toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()}</span>
            {event.time&&<span style={{fontSize:'10px',fontWeight:700,color:'#94a3b8',display:'flex',alignItems:'center',gap:'3px'}}><Clock size={10}/> {event.time?.substring(0,5)}</span>}
          </div>
          <h3 style={{margin:'0 0 5px',fontSize:'16px',fontWeight:900,lineHeight:1.2,color:'#0f172a'}}>{event.title}</h3>
          <p style={{margin:0,fontSize:'12px',color:'#64748b',display:'flex',alignItems:'center',gap:'4px',fontWeight:600}}><MapPin size={11}/> {event.location}</p>
          {percent>30&&<ScarcityBar percent={percent} />}
          <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><span style={{fontSize:'10px',color:'#94a3b8',fontWeight:600}}>From</span><div style={{fontSize:'19px',fontWeight:950,color:'#000',letterSpacing:'-0.5px'}}>GHS {Number(minPrice).toLocaleString()}</div></div>
            <div style={{background:'#000',color:'#fff',width:'36px',height:'36px',borderRadius:'11px',display:'flex',alignItems:'center',justifyContent:'center',transform:hovered?'scale(1.1) rotate(-5deg)':'scale(1)',transition:'transform 0.3s'}}><ArrowRight size={15}/></div>
          </div>
        </div>
      </a>
    </div>
  );
}

// FEATURED CARD
function FeaturedCard({ event, proof }) {
  const [h,setH]=useState(false);
  return (
    <a href={`/events/${event.id}`} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} style={{display:'block',position:'relative',borderRadius:'40px',overflow:'hidden',textDecoration:'none',color:'#fff',height:'480px',cursor:'pointer',boxShadow:h?'0 30px 80px rgba(0,0,0,0.25)':'0 10px 40px rgba(0,0,0,0.12)',transition:'box-shadow 0.3s ease'}}>
      <img src={event.images?.[0]} alt={event.title} style={{width:'100%',height:'100%',objectFit:'cover',transform:h?'scale(1.04)':'scale(1)',transition:'transform 0.6s ease'}} />
      <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 60%)'}} />
      <div style={{position:'absolute',top:'28px',left:'28px',display:'flex',gap:'10px',alignItems:'center'}}>
        <span style={{background:'#e73c7e',color:'#fff',padding:'6px 14px',borderRadius:'10px',fontSize:'11px',fontWeight:900,letterSpacing:'1px'}}>⚡ FEATURED</span>
        {proof?.liveViewers>3&&<span style={{background:'rgba(255,255,255,0.15)',color:'#fff',padding:'6px 14px',borderRadius:'10px',fontSize:'11px',fontWeight:700,backdropFilter:'blur(10px)',display:'flex',alignItems:'center',gap:'6px'}}><div style={{width:'6px',height:'6px',background:'#10b981',borderRadius:'50%'}}/>{proof.liveViewers} here now</span>}
      </div>
      <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'36px'}}>
        {event.date&&<div style={{marginBottom:'14px'}}><EventCountdown dateString={event.date}/></div>}
        <div style={{display:'flex',alignItems:'flex-end',gap:'20px'}}>
          <div style={{flex:1}}>
            <span style={{fontSize:'11px',fontWeight:800,color:'rgba(255,255,255,0.4)',letterSpacing:'2px'}}>{event.category?.toUpperCase()||'LUXURY EXPERIENCE'}</span>
            <h2 style={{margin:'6px 0 8px',fontSize:'40px',fontWeight:950,letterSpacing:'-2px',lineHeight:0.9}}>{event.title}</h2>
            <p style={{margin:0,fontSize:'13px',color:'rgba(255,255,255,0.6)',display:'flex',alignItems:'center',gap:'6px'}}><MapPin size={13}/> {event.location}</p>
          </div>
          <div style={{background:'#fff',color:'#000',padding:'13px 22px',borderRadius:'16px',fontWeight:900,fontSize:'13px',whiteSpace:'nowrap',flexShrink:0,transform:h?'scale(1.05)':'scale(1)',transition:'transform 0.3s',display:'flex',alignItems:'center',gap:'7px'}}>GET TICKETS <ArrowRight size={15}/></div>
        </div>
      </div>
    </a>
  );
}

// ORGANIZER CTA


/* ──────────── HOW IT WORKS ──────────── */
function HowItWorks() {
  const steps = [
    { n:'01', emoji:'🔍', title:'Discover', body:'Browse upcoming events curated for every taste — concerts, parties, galas, talent shows. Filter by category, date, or vibe. Real buyer counts show you what's hot right now.' },
    { n:'02', emoji:'🎟️', title:'Buy Instantly', body:'Pick your tier, enter your name and email. Pay in seconds via Paystack — card, mobile money, or bank transfer. No account required for buyers.' },
    { n:'03', emoji:'📲', title:'Your Ticket Lives Here', body:'Your ticket lands in your personal Vault instantly. Cryptographically signed QR — impossible to forge. Add it to Google Wallet, download to calendar, or write it to an NFC tag.' },
    { n:'04', emoji:'⚡', title:'Walk In Effortlessly', body:'At the gate, our scanner verifies your QR or NFC tap in under a second. No printing, no queues, no "my phone died" anxiety — your ticket is always online and always verifiable.' },
  ];
  return (
    <section style={{ margin: '100px 0 0', padding: '0 4px' }}>
      <div style={{ textAlign: 'center', marginBottom: 52 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 100, padding: '5px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: '1.5px' }}>HOW IT WORKS</span>
        </div>
        <h2 style={{ fontSize: 44, fontWeight: 950, letterSpacing: '-2.5px', margin: '0 0 14px', lineHeight: 1 }}>Ridiculously simple.<br/><span style={{ WebkitTextStroke: '1.5px #000', WebkitTextFillColor: 'transparent' }}>Impossibly fast.</span></h2>
        <p style={{ color: '#64748b', fontSize: 16, fontWeight: 600, margin: 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>From discovery to door in under 2 minutes. No app download. No signup required to buy.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {steps.map(({ n, emoji, title, body }) => (
          <div key={n} style={{ background: '#fff', borderRadius: 28, padding: '28px 24px 26px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 18, right: 20, fontSize: 12, fontWeight: 900, color: '#e2e8f0', letterSpacing: '-0.5px' }}>{n}</div>
            <div style={{ fontSize: 36, marginBottom: 16 }}>{emoji}</div>
            <h3 style={{ fontSize: 18, fontWeight: 950, margin: '0 0 10px', letterSpacing: '-0.5px' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.65, fontWeight: 600 }}>{body}</p>
          </div>
        ))}
      </div>
      {/* Why we're different — no specifics that hand info to competitors */}
      <div style={{ marginTop: 52, background: '#000', borderRadius: 32, padding: '44px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 24 }}>
        {[
          { emoji: '🔐', title: 'Unforgeable Tickets', body: 'Every QR is cryptographically signed server-side. Printed screenshots, duplicates, and screenshots fail at the gate instantly.' },
          { emoji: '💸', title: 'You Keep Your Revenue', body: 'Organizers keep their full ticket price. Our fee sits transparently on top — buyers see it, nobody's surprised.' },
          { emoji: '📡', title: 'Works Without Internet', body: 'NFC-written tickets scan at the gate even when your phone has no signal. Downloaded QR screenshots work too.' },
          { emoji: '⚡', title: 'Real-Time Everything', body: 'Live ticket counts, live vote tallies, live check-in rates. Every number updates the moment it changes.' },
        ].map(({ emoji, title, body }) => (
          <div key={title} style={{ color: '#fff' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{emoji}</div>
            <h4 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 8px', color: '#fff' }}>{title}</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.6, fontWeight: 600 }}>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────── SHORT FORM VIDEOS ──────────── */
function EventVideos({ events }) {
  const [active, setActive] = useState(0);
  const videoed = (events || []).filter(e => e.promo_video_url || e.images?.length > 0).slice(0, 6);
  if (videoed.length === 0) return null;

  const ev = videoed[active] || {};
  const isVideo = !!ev.promo_video_url;

  return (
    <section style={{ margin: '100px 0 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 950, margin: 0, letterSpacing: '-1px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 20 }}>🎬</span> Event Previews
        </h2>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>SWIPE TO EXPLORE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Main player */}
        <div style={{ borderRadius: 28, overflow: 'hidden', background: '#000', aspectRatio: '9/16', maxHeight: 520, position: 'relative', cursor: 'pointer' }}
          onClick={() => window.location.href = `/events/${ev.id}`}>
          {isVideo ? (
            <video src={ev.promo_video_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={ev.images?.[0] || ev.image_url} alt={ev.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.85) 0%,transparent 50%)' }} />
          <div style={{ position: 'absolute', bottom: 20, left: 18, right: 18 }}>
            <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,.5)', letterSpacing: '1.5px' }}>
              {ev.date ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'UPCOMING'}
            </p>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 950, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{ev.title}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href={`/events/${ev.id}`} onClick={e => e.stopPropagation()}
                style={{ background: '#fff', color: '#000', padding: '9px 18px', borderRadius: 20, fontWeight: 900, fontSize: 11, textDecoration: 'none', flexShrink: 0 }}>
                GET TICKETS →
              </a>
              {isVideo && <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.4)', letterSpacing: '1px' }}>▶ PROMO VIDEO</span>}
            </div>
          </div>
        </div>
        {/* Thumbnail reel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {videoed.map((e, i) => (
            <div key={e.id} onClick={() => setActive(i)}
              style={{ borderRadius: 18, overflow: 'hidden', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: i === active ? '#000' : 'rgba(255,255,255,.7)', border: `1px solid ${i === active ? 'rgba(0,0,0,0)' : '#e2e8f0'}`, transition: 'all .2s', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: 48, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <img src={e.images?.[0] || e.image_url || ''} alt={e.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: 12, fontWeight: 900, color: i === active ? '#fff' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</p>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: i === active ? 'rgba(255,255,255,.45)' : '#94a3b8' }}>
                  {e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming'}
                  {e.promo_video_url ? ' · 🎬 Video' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────── AUTOMATIONS & INTEGRATIONS ──────────── */
function AutomationsSection() {
  const integrations = [
    { name: 'Paystack', emoji: '💳', desc: 'Cards, MoMo & bank transfer', badge: 'PAYMENTS', color: '#0ea5e9' },
    { name: 'Google Wallet', emoji: '🎫', desc: 'One-tap "Save to Wallet"', badge: 'WALLET', color: '#22c55e' },
    { name: 'NFC Tags', emoji: '📡', desc: 'Tap-to-enter physical tags', badge: 'ENTRY', color: '#8b5cf6' },
    { name: 'Google Calendar', emoji: '📅', desc: '.ics to any calendar app', badge: 'CALENDAR', color: '#f59e0b' },
    { name: 'Supabase', emoji: '⚡', desc: 'Real-time live data sync', badge: 'REALTIME', color: '#22d3ee' },
    { name: 'WhatsApp', emoji: '💬', desc: 'Reseller share links', badge: 'SHARING', color: '#22c55e' },
    { name: 'Google Maps', emoji: '🗺️', desc: 'Embedded venue directions', badge: 'MAPS', color: '#ef4444' },
    { name: 'Bolt / Uber', emoji: '🚗', desc: 'One-tap ride to venue', badge: 'TRANSPORT', color: '#f59e0b' },
  ];

  const automations = [
    { emoji: '🎟️', title: 'Instant ticket delivery', body: 'Ticket appears in buyer's vault the moment payment clears. No manual processing, no delay.' },
    { emoji: '📊', title: 'Live check-in dashboard', body: 'Gate staff see arrivals in real time. Organizers see check-in rate from anywhere.' },
    { emoji: '💰', title: 'Automatic payout tracking', body: 'Every sale logs what's owed to whom. Admin sees a clear ledger — no spreadsheets.' },
    { emoji: '🔔', title: 'Scarcity alerts', body: 'Buyers see live ticket counts. When stock drops below 10%, urgency warnings fire automatically.' },
    { emoji: '🏆', title: 'Live vote leaderboards', body: 'Competition results update in real time. No manual counting, no result disputes.' },
    { emoji: '🔗', title: 'Reseller link tracking', body: 'Each reseller's unique link tracks clicks, conversions, and commission earned automatically.' },
  ];

  return (
    <section style={{ margin: '100px 0 0' }}>
      {/* Integrations */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 100, padding: '5px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: '1.5px' }}>INTEGRATIONS</span>
        </div>
        <h2 style={{ fontSize: 40, fontWeight: 950, letterSpacing: '-2px', margin: '0 0 12px', lineHeight: 1.05 }}>Everything connected.<br/><span style={{ WebkitTextStroke: '1.5px #000', WebkitTextFillColor: 'transparent' }}>Nothing manual.</span></h2>
        <p style={{ color: '#64748b', fontSize: 15, fontWeight: 600, margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>OUSTED connects to the tools your attendees already use — no extra apps to download.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 64 }}>
        {integrations.map(({ name, emoji, desc, badge, color }) => (
          <div key={name} style={{ background: '#fff', borderRadius: 22, padding: '20px 16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>{emoji}</div>
            <div style={{ display: 'inline-block', background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 8, fontWeight: 900, padding: '2px 8px', borderRadius: 20, letterSpacing: '1.5px', marginBottom: 8 }}>{badge}</div>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{name}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Automations */}
      <div style={{ background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)', borderRadius: 36, padding: '52px 44px', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.05)', border: '1px solid rgba(0,0,0,.08)', borderRadius: 100, padding: '5px 16px', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: '1.5px' }}>AUTOMATIONS</span>
          </div>
          <h3 style={{ fontSize: 32, fontWeight: 950, letterSpacing: '-1.5px', margin: 0, lineHeight: 1.1 }}>The platform that runs itself<br/><span style={{ color: '#e73c7e' }}>while you run your event.</span></h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
          {automations.map(({ emoji, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>{emoji}</div>
              <div>
                <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{title}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6, fontWeight: 600 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OrganizerCTA() {
  const stats=[{v:'₵0',l:'Setup Fee'},{v:'95%',l:'Revenue'},{v:'24h',l:'Payout'},{v:'∞',l:'Ticket Tiers'}];
  return (
    <section style={{marginTop:'100px',position:'relative',overflow:'hidden',borderRadius:'44px',background:'#000',padding:'70px 55px'}} className="cta-section">
      <div style={{position:'absolute',top:'-50%',right:'-5%',width:'500px',height:'500px',background:'radial-gradient(circle,rgba(231,60,126,0.15) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1,display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:'50px',alignItems:'center'}} className="org-grid">
        <div>
          <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(231,60,126,0.15)',border:'1px solid rgba(231,60,126,0.3)',borderRadius:'10px',padding:'6px 14px',marginBottom:'22px'}}>
            <Zap size={13} color="#e73c7e"/><span style={{fontSize:'11px',fontWeight:900,color:'#e73c7e',letterSpacing:'1px'}}>FOR ORGANIZERS</span>
          </div>
          <h2 style={{fontSize:'48px',fontWeight:950,letterSpacing:'-3px',color:'#fff',margin:'0 0 18px',lineHeight:0.9}}>Stop leaving money<br/><span style={{color:'#e73c7e'}}>on the table.</span></h2>
          <p style={{color:'rgba(255,255,255,0.55)',fontSize:'16px',lineHeight:1.6,margin:'0 0 30px',maxWidth:'400px'}}>Keep 95% of every ticket. Multi-tier ticketing, reseller network, live voting, real-time analytics — all in one dashboard.</p>
          {[['Shield','Paystack-secured — zero fraud risk'],['TrendingUp','Real-time analytics on every sale'],['Users','Built-in reseller network'],['Award','Voting & competition tools']].map(([_,text],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
              <CheckCircle size={14} color="#22c55e"/><p style={{margin:0,fontSize:'13px',color:'rgba(255,255,255,0.55)',fontWeight:600}}>{text}</p>
            </div>
          ))}
          <div style={{display:'flex',gap:'12px',marginTop:'30px',flexWrap:'wrap'}}>
            <a href="/login" style={{background:'#fff',color:'#000',padding:'16px 32px',borderRadius:'16px',fontWeight:900,textDecoration:'none',fontSize:'13px',display:'flex',alignItems:'center',gap:'8px'}}>START FREE <ArrowRight size={15}/></a>
            <a href="/login" style={{border:'1px solid rgba(255,255,255,0.2)',color:'#fff',padding:'16px 32px',borderRadius:'16px',fontWeight:900,textDecoration:'none',fontSize:'13px'}}>ORGANIZER LOGIN</a>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}} className="stats-grid">
          {stats.map(({v,l},i)=>(<div key={i} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'22px',padding:'28px',textAlign:'center'}}><div style={{fontSize:'40px',fontWeight:950,color:'#fff',letterSpacing:'-2px',marginBottom:'6px'}}>{v}</div><div style={{fontSize:'11px',fontWeight:700,color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'1px'}}>{l}</div></div>))}
          <div style={{gridColumn:'1/-1',background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:'22px',padding:'22px',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px'}}>
            <CheckCircle size={15} color="#22c55e"/><span style={{fontSize:'12px',fontWeight:800,color:'#22c55e'}}>Bank-grade security via Paystack</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// SKELETON
const Skeleton = () => (
  <div style={{background:'#fff',borderRadius:'28px',overflow:'hidden',border:'1px solid #f1f5f9'}}>
    <div style={{height:'220px',background:'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.5s infinite'}}/>
    <div style={{padding:'16px'}}>{[['40%','10px'],['80%','16px'],['60%','10px']].map(([w,h],i)=>(<div key={i} style={{height:h,width:w,background:'#f1f5f9',borderRadius:'6px',marginBottom:'10px'}}/>))}</div>
  </div>
);

// MAIN
export default function Home() {
  const [events,setEvents]=useState([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [activeCategory,setActiveCategory]=useState('All');
  const [wishlist,setWishlist]=useState(new Set());
  const [socialProof,setSocialProof]=useState({});
  const [toastPurchases,setToastPurchases]=useState([]);
  const [sessionToken]=useState(()=>Math.random().toString(36).slice(2));
  const categories=['All','Party','Concert','Conference','Art','Sports','Food','Festival'];

  useEffect(()=>{
    supabase.from('events').select('*,ticket_tiers(*)').eq('is_deleted',false).order('date',{ascending:true}).then(({data})=>{setEvents(data||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    try { const s=JSON.parse(localStorage.getItem('ousted_wishlist')||'[]'); setWishlist(new Set(s)); } catch{}
  },[]);

  useEffect(()=>{
    if(!events.length) return;
    const fetch = async()=>{
      const proofData={};
      await Promise.allSettled(events.slice(0,8).map(async(e)=>{
        const r=await window.fetch(`/api/social-proof?event_id=${e.id}&session=${sessionToken}`).catch(()=>null);
        if(r?.ok) proofData[e.id]=await r.json();
      }));
      setSocialProof(proofData);
      const purchases=Object.values(proofData).flatMap(d=>d.recentPurchases||[]);
      setToastPurchases(purchases.slice(0,8));
    };
    fetch();
    const id=setInterval(fetch,30000);
    return()=>clearInterval(id);
  },[events,sessionToken]);

  const toggleWishlist=useCallback((id)=>{
    setWishlist(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);localStorage.setItem('ousted_wishlist',JSON.stringify([...n]));return n;});
  },[]);

  const filtered=events.filter(e=>{
    const ms=!search||e.title?.toLowerCase().includes(search.toLowerCase())||e.location?.toLowerCase().includes(search.toLowerCase());
    const mc=activeCategory==='All'||e.category===activeCategory;
    return ms&&mc;
  });

  const featured=filtered[0];
  const grid=search||activeCategory!=='All'?filtered:filtered.slice(1);

  return (
    <div style={{maxWidth:'1280px',margin:'0 auto',padding:'0 20px 120px'}}>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @media(max-width:768px){.org-grid{grid-template-columns:1fr!important}.stats-grid{grid-template-columns:1fr 1fr!important}.cta-section{padding:40px 24px!important}}
        @media(max-width:480px){.hero-h1{font-size:42px!important;letter-spacing:-3px!important}}
      `}</style>
      <LivePurchaseToast purchases={toastPurchases}/>

      {/* HERO */}
      <section style={{textAlign:'center',padding:'55px 20px 45px',display:'flex',flexDirection:'column',alignItems:'center',animation:'fadeIn 0.6s ease'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'rgba(231,60,126,0.08)',border:'1px solid rgba(231,60,126,0.2)',borderRadius:'100px',padding:'5px 16px',marginBottom:'22px'}}>
          <div style={{width:'6px',height:'6px',background:'#e73c7e',borderRadius:'50%',animation:'pulse 1.5s infinite'}}/>
          <span style={{fontSize:'11px',fontWeight:900,color:'#e73c7e',letterSpacing:'1.5px'}}>LIVE IN ACCRA</span>
        </div>
        <h1 className="hero-h1" style={{fontSize:'84px',fontWeight:950,margin:0,letterSpacing:'-5px',lineHeight:0.85,maxWidth:'800px'}}>
          Every Legendary<br/>
          <span style={{WebkitTextStroke:'2px #000',WebkitTextFillColor:'transparent'}}>Experience.</span>
        </h1>
        <p style={{fontSize:'17px',color:'#64748b',fontWeight:600,margin:'22px 0 0',maxWidth:'480px',lineHeight:1.6}}>
          's premium event ticketing. Concerts, parties, galas — get in before it sells out.
        </p>
        <div style={{position:'relative',width:'100%',maxWidth:'580px',marginTop:'36px'}}>
          <Search size={19} style={{position:'absolute',left:'22px',top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}/>
          <input onChange={e=>setSearch(e.target.value)} value={search} placeholder="Search events, venues, artists..." style={{width:'100%',padding:'21px 22px 21px 58px',borderRadius:'28px',border:'none',background:'rgba(255,255,255,0.92)',fontSize:'15px',fontWeight:600,boxShadow:'0 20px 60px rgba(0,0,0,0.08)',outline:'none',backdropFilter:'blur(10px)'}}/>
          {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:'18px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:'4px'}}><X size={17}/></button>}
        </div>
        <div style={{display:'flex',gap:'22px',marginTop:'25px',flexWrap:'wrap',justifyContent:'center'}}>
          {[{icon:Shield,text:'Paystack Secured'},{icon:CheckCircle,text:'Instant Tickets'},{icon:Globe,text:' & Beyond'}].map(({icon:Icon,text},i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'12px',fontWeight:700,color:'#64748b'}}><Icon size={13} color="#10b981"/> {text}</div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      {!search&&(
        <div style={{display:'flex',gap:'8px',padding:'5px 0 18px',overflowX:'auto',scrollbarWidth:'none'}}>
          {categories.map(cat=>(
            <button key={cat} onClick={()=>setActiveCategory(cat)} style={{padding:'9px 18px',borderRadius:'100px',border:'none',cursor:'pointer',fontWeight:800,fontSize:'12px',whiteSpace:'nowrap',flexShrink:0,background:activeCategory===cat?'#000':'rgba(255,255,255,0.82)',color:activeCategory===cat?'#fff':'#64748b',transition:'all 0.2s',backdropFilter:'blur(10px)',boxShadow:activeCategory===cat?'0 4px 15px rgba(0,0,0,0.18)':'none'}}>{cat}</button>
          ))}
        </div>
      )}

      {/* FEATURED */}
      {!search&&featured&&!loading&&(
        <section style={{marginBottom:'55px',animation:'slideUp 0.5s ease'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
            <h2 style={{fontSize:'19px',fontWeight:900,margin:0,display:'flex',alignItems:'center',gap:'9px'}}><Sparkles size={19} color="#e73c7e"/> Featured Tonight</h2>
            <a href="/" style={{fontSize:'12px',fontWeight:800,color:'#000',textDecoration:'none',display:'flex',alignItems:'center',gap:'3px'}}>View All <ChevronRight size={15}/></a>
          </div>
          <FeaturedCard event={featured} proof={socialProof[featured.id]}/>
        </section>
      )}

      {/* GRID */}
      <section>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'22px'}}>
          <h2 style={{fontSize:'19px',fontWeight:900,margin:0,display:'flex',alignItems:'center',gap:'9px'}}>
            {search?<Search size={19}/>:<LayoutGrid size={19}/>}
            {search?`Results for "${search}"`:activeCategory==='All'?'Upcoming Events':activeCategory}
          </h2>
          <span style={{background:'#000',color:'#fff',padding:'4px 12px',borderRadius:'8px',fontSize:'11px',fontWeight:800}}>{filtered.length} EVENT{filtered.length!==1?'S':''}</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:'22px'}}>
          {loading?[1,2,3,4,5,6].map(n=><Skeleton key={n}/>):(search||activeCategory!=='All'?filtered:grid).map((e,i)=>(
            <EventCard key={e.id} event={e} index={i} wishlist={wishlist} toggleWishlist={toggleWishlist} socialProof={socialProof}/>
          ))}
        </div>
        {!loading&&filtered.length===0&&(
          <div style={{padding:'90px 0',textAlign:'center'}}>
            <Ticket size={44} color="#cbd5e1"/>
            <h3 style={{margin:'18px 0 8px',fontWeight:900,color:'#334155'}}>No events found</h3>
            <p style={{color:'#94a3b8',fontWeight:600}}>Try a different search or browse all categories</p>
            <button onClick={()=>{setSearch('');setActiveCategory('All');}} style={{marginTop:'18px',background:'#000',color:'#fff',border:'none',padding:'13px 26px',borderRadius:'13px',fontWeight:800,cursor:'pointer'}}>CLEAR FILTERS</button>
          </div>
        )}
      </section>

      <HowItWorks/>
      <AutomationsSection/>
      <EventVideos events={events}/>
      <OrganizerCTA/>
    </div>
  );
}
