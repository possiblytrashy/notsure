"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Search, Trophy, Crown, Share2, Plus, Minus, ChevronRight, Award, Check, RefreshCcw, AlertCircle, Mail, User, X, TrendingUp, ShieldCheck, Vote, Phone } from 'lucide-react';

function VoterModal({ candidate, contest, onConfirm, onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const votePrice = Number(contest?.vote_price || 0);
  const platformFee = votePrice * 0.05;
  const total = (votePrice + platformFee) * qty;

  const handleSubmit = async () => {
    if (!email.includes('@')) { setError('Valid email required'); return; }
    if (!name.trim()) { setError('Your name is required'); return; }
    if (!phone.trim()) { setError('Phone number required for SMS receipt'); return; }
    setError(''); setLoading(true);
    await onConfirm({ email, name, qty, phone: phone.trim() });
    setLoading(false);
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
          <div>
            <p style={{ margin:'0 0 6px', fontSize:'11px', fontWeight:800, color:'#0ea5e9', letterSpacing:'1.5px' }}>VOTING FOR</p>
            <h3 style={{ margin:0, fontSize:'24px', fontWeight:950, letterSpacing:'-1px' }}>{candidate?.name}</h3>
            <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#64748b', fontWeight:600 }}>{contest?.title}</p>
          </div>
          <button onClick={onClose} style={S.iconBtn}><X size={18}/></button>
        </div>
        {candidate?.image_url && <img src={candidate.image_url} alt={candidate.name} style={{ width:'80px', height:'80px', borderRadius:'20px', objectFit:'cover', marginBottom:'20px', border:'3px solid #f1f5f9' }}/>}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
          <div style={S.inputRow}><User size={16} color="#94a3b8"/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={S.inlineInput}/></div>
          <div style={S.inputRow}><Mail size={16} color="#94a3b8"/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email for vote receipt" style={S.inlineInput}/></div>
          <div style={S.inputRow}><Phone size={16} color="#94a3b8"/><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Phone number for SMS receipt" style={S.inlineInput}/></div>
        </div>
        <div style={S.qtyBox}>
          <div>
            <p style={{ margin:0, fontSize:'12px', fontWeight:800, color:'#64748b' }}>VOTES TO CAST</p>
            <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#94a3b8', fontWeight:600 }}>More votes = stronger support</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={S.qtyBtn}><Minus size={14}/></button>
            <span style={{ fontWeight:950, fontSize:'22px', minWidth:'36px', textAlign:'center' }}>{qty}</span>
            <button onClick={()=>setQty(q=>Math.min(500,q+1))} style={S.qtyBtn}><Plus size={14}/></button>
          </div>
        </div>
        <div style={S.priceCard}>
          <div style={S.priceRow}><span style={{ color:'#64748b', fontWeight:600 }}>{qty} vote{qty>1?'s':''} × GHS {votePrice.toFixed(2)}</span><span style={{ fontWeight:800 }}>GHS {(votePrice*qty).toFixed(2)}</span></div>
          <div style={S.priceRow}><span style={{ color:'#94a3b8', fontSize:'12px', fontWeight:600 }}>Platform fee (5%)</span><span style={{ color:'#94a3b8', fontSize:'12px', fontWeight:700 }}>GHS {(platformFee*qty).toFixed(2)}</span></div>
          <div style={{ height:'1px', background:'#e2e8f0', margin:'10px 0' }}/>
          <div style={S.priceRow}><span style={{ fontWeight:900, fontSize:'16px' }}>Total</span><span style={{ fontWeight:950, fontSize:'20px', color:'#0ea5e9' }}>GHS {total.toFixed(2)}</span></div>
        </div>
        {error && <div style={{ display:'flex', alignItems:'center', gap:'8px', color:'#ef4444', fontSize:'13px', fontWeight:700, marginBottom:'12px' }}><AlertCircle size={14}/>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{ width:'100%', padding:'18px', background:loading?'#94a3b8':'linear-gradient(135deg,#0ea5e9,#6366f1)', color:'#fff', border:'none', borderRadius:'18px', fontWeight:900, fontSize:'16px', cursor:loading?'not-allowed':'pointer' }}>
          {loading?'Redirecting to Paystack...':`VOTE NOW — GHS ${total.toFixed(2)}`}
        </button>
        <p style={{ textAlign:'center', fontSize:'11px', color:'#94a3b8', marginTop:'12px', fontWeight:600 }}><ShieldCheck size={11} style={{ verticalAlign:'middle' }}/> Secured by Paystack · Receipt sent to email</p>
      </div>
    </div>
  );
}

function VoteReceipt({ data, onClose }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.confetti) {
      window.confetti({ particleCount:200, spread:80, origin:{ y:0.5 }, colors:['#0ea5e9','#6366f1','#000','#fff'] });
    }
  }, []);
  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, textAlign:'center' }}>
        <div style={{ width:'72px', height:'72px', background:'linear-gradient(135deg,#0ea5e9,#6366f1)', borderRadius:'24px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <Check size={36} color="#fff" strokeWidth={3}/>
        </div>
        <h3 style={{ fontSize:'26px', fontWeight:950, letterSpacing:'-1px', margin:'0 0 8px' }}>Votes Confirmed!</h3>
        <p style={{ color:'#64748b', fontWeight:600, marginBottom:'28px' }}>Payment successful. Your support is live on the leaderboard.</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'24px' }}>
          {[['VOTED FOR',data?.candidate_name],['VOTES CAST',data?.votes],['CONTEST',data?.contest],['STATUS','✅ Confirmed']].map(([label,val])=>(
            <div key={label} style={{ background:'#f8fafc', borderRadius:'16px', padding:'16px' }}>
              <p style={{ margin:'0 0 6px', fontSize:'10px', fontWeight:800, color:'#94a3b8', letterSpacing:'1px' }}>{label}</p>
              <p style={{ margin:0, fontSize:'14px', fontWeight:900 }}>{val}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width:'100%', padding:'16px', background:'#000', color:'#fff', border:'none', borderRadius:'18px', fontWeight:900, fontSize:'15px', cursor:'pointer' }}>VIEW LIVE LEADERBOARD</button>
      </div>
    </div>
  );
}

export default function VotingPortal() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('competitions');
  const [activeCompId, setActiveCompId] = useState(null);
  const [activeCatId, setActiveCatId] = useState(null);
  const [voterModal, setVoterModal] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [liveVotes, setLiveVotes] = useState({});

  const showToast = (type, message) => { setToast({ type, message }); setTimeout(()=>setToast(null), 4000); };

  const fetchData = useCallback(async (isManual=false) => {
    if (isManual) setRefreshing(true);
    const { data, error } = await supabase.from('competitions').select('*, contests(*, candidates(*))').order('created_at',{ ascending:false });
    if (!error && data) {
      setCompetitions(data.map(comp=>({ ...comp, contests:(comp.contests||[]).filter(ct=>ct.is_active) })).filter(comp=>comp.contests.length>0));
    }
    setLoading(false);
    if (isManual) setTimeout(()=>setRefreshing(false), 600);
  }, []);

  useEffect(()=>{ fetchData(); },[fetchData]);

  // Realtime vote updates
  useEffect(()=>{
    const channel = supabase.channel('vote-updates')
      .on('postgres_changes',{ event:'UPDATE', schema:'public', table:'candidates' },(payload)=>{
        const updated = payload.new;
        setLiveVotes(prev=>({ ...prev, [updated.id]: updated.vote_count }));
        setCompetitions(prev=>prev.map(comp=>({ ...comp, contests:comp.contests.map(ct=>({ ...ct, candidates:ct.candidates.map(c=>c.id===updated.id?{ ...c, vote_count:updated.vote_count }:c) })) })));
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[]);

  // Payment success callback
  useEffect(()=>{
    if (typeof window==='undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment')==='success') {
      const candidateId = params.get('candidate_id');
      const votes = parseInt(params.get('votes')||'1',10);
      const candidate = competitions.flatMap(c=>c.contests||[]).flatMap(ct=>ct.candidates||[]).find(c=>c.id===candidateId);
      const contest = competitions.flatMap(c=>c.contests||[]).find(ct=>ct.candidates?.some(c=>c.id===candidateId));
      if (candidate) setReceiptData({ candidate_name:candidate.name, votes, contest:contest?.title });
      else showToast('SUCCESS',`✅ ${votes} vote(s) processed!`);
      window.history.replaceState({},'','/voting');
      setTimeout(()=>fetchData(true), 2000);
    }
  },[competitions, fetchData]);

  const handleVoteConfirm = async ({ email, name, qty, phone }) => {
    if (!voterModal) return;
    const { candidate, contest } = voterModal;
    try {
      const res = await fetch('/api/checkout/secure-session',{ method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ type:'VOTE', candidate_id:candidate.id, vote_count:qty, email, voter_name:name, voter_phone: phone || '' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||'Payment failed');
      setVoterModal(null);
      window.location.href = data.authorization_url;
    } catch(err) { showToast('ERROR', err.message); }
  };

  const handleShare = (candidate, contest) => {
    const text = `🗳️ Vote for ${candidate.name} in "${contest.title}"! ${window.location.href}`;
    if (navigator.share) { navigator.share({ title:'Vote on OUSTED', text, url:window.location.href }); }
    else { navigator.clipboard.writeText(text); setCopySuccess(candidate.id); setTimeout(()=>setCopySuccess(null),2000); showToast('SUCCESS','Share link copied!'); }
  };

  const activeComp = competitions.find(c=>c.id===activeCompId);
  const activeContest = activeComp?.contests?.find(ct=>ct.id===activeCatId);
  const candidates = [...(activeContest?.candidates||[])].map(c=>({ ...c, vote_count:liveVotes[c.id]??c.vote_count })).sort((a,b)=>b.vote_count-a.vote_count);
  const totalVotes = candidates.reduce((a,c)=>a+(c.vote_count||0),0);

  if (loading) return <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'100px 20px' }}>{[1,2,3].map(i=><div key={i} style={{ height:'180px', background:'#f1f5f9', borderRadius:'30px', marginBottom:'20px', animation:'pulse 1.5s infinite' }}/>)}</div>;

  // ── VIEW 1: COMPETITIONS ─────────────────────────────────────
  if (view==='competitions') return (
    <div style={S.container}>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" defer/>
      <header style={{ textAlign:'center', marginBottom:'60px' }}>
        <div style={S.badge}><Crown size={14}/> OUSTED VOTING PORTAL</div>
        <h1 style={S.title}>Cast Your <span style={{ color:'#0ea5e9' }}>Vote.</span></h1>
        <p style={{ color:'#64748b', fontWeight:600, fontSize:'16px', marginBottom:'40px' }}>Support your favourites. Every vote counts.</p>
        <div style={S.searchBox}>
          <Search size={20} color="#0ea5e9"/>
          <input placeholder="Search competitions..." style={S.searchInput} onChange={e=>setSearchQuery(e.target.value.toLowerCase())}/>
        </div>
      </header>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'24px' }}>
        {competitions.filter(c=>c.title?.toLowerCase().includes(searchQuery)).map(comp=>{
          const totalCompVotes = comp.contests?.flatMap(ct=>ct.candidates||[]).reduce((a,c)=>a+(c.vote_count||0),0)||0;
          return (
            <div key={comp.id} onClick={()=>{ setActiveCompId(comp.id); setView('categories'); }} style={S.compCard}>
              <div style={{ height:'200px', position:'relative', overflow:'hidden', background:'linear-gradient(135deg,#f0f9ff,#e0f2fe)' }}>
                {comp.image_url?<img src={comp.image_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={comp.title}/>:<div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><Trophy size={48} color="#0ea5e9"/></div>}
                <div style={{ position:'absolute', top:'14px', right:'14px', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', color:'#fff', padding:'5px 12px', borderRadius:'20px', fontSize:'10px', fontWeight:900, display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'5px', height:'5px', background:'#22c55e', borderRadius:'50%', animation:'pulse 1.5s infinite' }}/> LIVE
                </div>
              </div>
              <div style={{ padding:'24px' }}>
                <h2 style={{ fontSize:'20px', fontWeight:950, letterSpacing:'-0.5px', margin:'0 0 8px' }}>{comp.title}</h2>
                {comp.description&&<p style={{ color:'#64748b', fontSize:'13px', fontWeight:600, margin:'0 0 16px', lineHeight:'1.5' }}>{comp.description}</p>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <span style={S.chip}><Vote size={11}/> {comp.contests?.length} categor{comp.contests?.length===1?'y':'ies'}</span>
                    <span style={S.chip}><TrendingUp size={11}/> {totalCompVotes.toLocaleString()} votes</span>
                  </div>
                  <div style={{ width:'32px', height:'32px', background:'#000', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><ChevronRight size={18} color="#fff"/></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {competitions.length===0&&<div style={{ textAlign:'center', padding:'80px 20px', color:'#94a3b8' }}><Trophy size={48} style={{ margin:'0 auto 20px', display:'block', opacity:0.3 }}/><h3 style={{ fontWeight:800 }}>No active competitions</h3><p>Check back soon.</p></div>}
      {toast&&<ToastBar toast={toast} onClose={()=>setToast(null)}/>}
      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );

  // ── VIEW 2: CATEGORIES ────────────────────────────────────────
  if (view==='categories') return (
    <div style={S.container}>
      <button onClick={()=>setView('competitions')} style={S.backBtn}><ArrowLeft size={18}/> All Competitions</button>
      <div style={{ height:'200px', borderRadius:'28px', overflow:'hidden', position:'relative', marginBottom:'40px', background:'#000' }}>
        {activeComp?.image_url&&<img src={activeComp.image_url} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.6 }} alt=""/>}
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'28px' }}>
          <h1 style={{ color:'#fff', fontSize:'clamp(24px,5vw,44px)', fontWeight:950, letterSpacing:'-2px', margin:0 }}>{activeComp?.title}</h1>
        </div>
      </div>
      <h2 style={{ fontSize:'18px', fontWeight:900, margin:'0 0 20px' }}>Select a Category to Vote</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {activeComp?.contests?.map(ct=>{
          const leader = [...(ct.candidates||[])].sort((a,b)=>b.vote_count-a.vote_count)[0];
          const total = ct.candidates?.reduce((a,c)=>a+(c.vote_count||0),0)||0;
          return (
            <div key={ct.id} onClick={()=>{ setActiveCatId(ct.id); setView('leaderboard'); }} style={{ background:'#fff', padding:'20px 22px', borderRadius:'22px', display:'flex', alignItems:'center', gap:'16px', cursor:'pointer', border:'1px solid #f1f5f9', transition:'transform 0.15s' }}>
              <div style={{ width:'54px', height:'54px', borderRadius:'16px', background:'#f0f9ff', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
                {ct.image_url?<img src={ct.image_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt=""/>:<Award size={22} color="#0ea5e9"/>}
              </div>
              <div style={{ flex:1 }}>
                <h3 style={{ margin:'0 0 5px', fontSize:'16px', fontWeight:900 }}>{ct.title}</h3>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  <span style={S.chip}>{ct.candidates?.length||0} nominees</span>
                  <span style={S.chip}>{total.toLocaleString()} votes</span>
                  {leader&&<span style={{ ...S.chip, background:'#f0fdf4', color:'#16a34a' }}>🏆 {leader.name} leading</span>}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ background:'#f0f9ff', color:'#0ea5e9', padding:'6px 14px', borderRadius:'12px', fontSize:'13px', fontWeight:900, marginBottom:'4px' }}>
                  GHS {Number(ct.vote_price).toFixed(2)} <span style={{ fontSize:'10px', opacity:0.7 }}>+5%</span>
                </div>
                <ChevronRight size={16} color="#94a3b8"/>
              </div>
            </div>
          );
        })}
      </div>
      {toast&&<ToastBar toast={toast} onClose={()=>setToast(null)}/>}
    </div>
  );

  // ── VIEW 3: LEADERBOARD + VOTING ─────────────────────────────
  return (
    <div style={S.container}>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" defer/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
        <button onClick={()=>setView('categories')} style={S.backBtn}><ArrowLeft size={18}/> Categories</button>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <button onClick={()=>fetchData(true)} style={S.iconBtn}><RefreshCcw size={16} style={{ animation:refreshing?'spin 0.8s linear infinite':'none' }}/></button>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#f0fdf4', color:'#16a34a', padding:'7px 14px', borderRadius:'20px', fontSize:'12px', fontWeight:800 }}>
            <div style={{ width:'6px', height:'6px', background:'#22c55e', borderRadius:'50%', animation:'pulse 1.5s infinite' }}/> {totalVotes.toLocaleString()} VOTES
          </div>
        </div>
      </div>

      <h2 style={{ fontSize:'28px', fontWeight:950, letterSpacing:'-1px', margin:'0 0 6px' }}>{activeContest?.title}</h2>
      <p style={{ color:'#64748b', fontWeight:600, fontSize:'14px', marginBottom:'36px' }}>
        GHS {Number(activeContest?.vote_price).toFixed(2)} per vote
        <span style={{ background:'#f0f9ff', color:'#0ea5e9', padding:'3px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:800, marginLeft:'8px' }}>+ 5% platform fee</span>
      </p>

      {/* Podium for top 3 */}
      {candidates.length >= 2 && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', gap:'10px', marginBottom:'48px', padding:'28px', background:'#fff', borderRadius:'28px', border:'1px solid #f0f0f0' }}>
          {[candidates[1], candidates[0], candidates[2]].filter(Boolean).map((can,podIdx)=>{
            const actualRank = podIdx===0?2:podIdx===1?1:3;
            const ht = [130,170,110];
            const bg = ['linear-gradient(135deg,#6366f1,#8b5cf6)','linear-gradient(135deg,#0ea5e9,#6366f1)','linear-gradient(135deg,#f59e0b,#ef4444)'];
            const emoji = ['🥈','🥇','🥉'];
            return (
              <div key={can.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:podIdx===1?'0 0 36%':'0 0 26%' }}>
                <div style={{ fontSize:'22px', marginBottom:'6px' }}>{emoji[podIdx]}</div>
                {can.image_url&&<img src={can.image_url} alt={can.name} style={{ width:podIdx===1?'72px':'56px', height:podIdx===1?'72px':'56px', borderRadius:'18px', objectFit:'cover', border:'3px solid #fff', boxShadow:'0 6px 20px rgba(0,0,0,0.1)', marginBottom:'8px' }}/>}
                <p style={{ fontWeight:900, fontSize:podIdx===1?'14px':'12px', margin:'0 0 3px', textAlign:'center' }}>{can.name}</p>
                <p style={{ fontWeight:800, color:'#0ea5e9', fontSize:'11px', margin:'0 0 8px' }}>{(can.vote_count||0).toLocaleString()}</p>
                <div style={{ height:`${ht[podIdx]}px`, width:'100%', background:bg[podIdx], borderRadius:'16px 16px 0 0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <span style={{ color:'#fff', fontWeight:950, fontSize:'26px' }}>#{actualRank}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:'20px' }}>
        {candidates.map((can,idx)=>{
          const pct = totalVotes>0?Math.round((can.vote_count/totalVotes)*100):0;
          const isLeader = idx===0;
          return (
            <div key={can.id} style={{ background:'#fff', borderRadius:'26px', overflow:'hidden', border:isLeader?'2px solid #0ea5e9':'1px solid #f0f0f0', boxShadow:isLeader?'0 8px 30px rgba(14,165,233,0.1)':'0 2px 10px rgba(0,0,0,0.04)' }}>
              <div style={{ height:'280px', position:'relative', overflow:'hidden', background:'#f8fafc' }}>
                {can.image_url?<img src={can.image_url} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={can.name}/>:<div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><User size={40} color="#94a3b8"/></div>}
                <div style={{ position:'absolute', top:'12px', left:'12px', background:idx<3?['#0ea5e9','#6366f1','#8b5cf6'][idx]:'rgba(0,0,0,0.6)', color:'#fff', padding:'5px 12px', borderRadius:'10px', fontWeight:900, fontSize:'13px', backdropFilter:'blur(8px)' }}>
                  {isLeader?'👑':`#${idx+1}`}
                </div>
                <button onClick={()=>handleShare(can,activeContest)} style={{ position:'absolute', top:'12px', right:'12px', width:'38px', height:'38px', background:'rgba(255,255,255,0.9)', border:'none', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                  {copySuccess===can.id?<Check size={15} color="#0ea5e9"/>:<Share2 size={15}/>}
                </button>
              </div>
              <div style={{ padding:'22px' }}>
                <h3 style={{ fontSize:'19px', fontWeight:950, textAlign:'center', margin:'0 0 4px' }}>{can.name}</h3>
                {can.category&&<p style={{ textAlign:'center', color:'#64748b', fontSize:'11px', fontWeight:700, margin:'0 0 14px' }}>{can.category}</p>}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                  <div style={{ background:'#f1f5f9', height:'7px', borderRadius:'4px', overflow:'hidden', flex:1 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:isLeader?'#0ea5e9':'#6366f1', borderRadius:'4px', transition:'width 1.2s ease' }}/>
                  </div>
                  <span style={{ fontWeight:900, fontSize:'13px', color:'#0ea5e9', minWidth:'34px', textAlign:'right' }}>{pct}%</span>
                </div>
                <p style={{ textAlign:'center', fontWeight:800, color:'#94a3b8', fontSize:'12px', marginBottom:'18px' }}>{(can.vote_count||0).toLocaleString()} votes</p>
                <button onClick={()=>setVoterModal({ candidate:can, contest:activeContest })} style={{ width:'100%', padding:'15px', background:isLeader?'#0ea5e9':'#000', color:'#fff', border:'none', borderRadius:'14px', fontWeight:900, fontSize:'13px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                  <Vote size={15}/> VOTE — GHS {(Number(activeContest?.vote_price||0)*1.05).toFixed(2)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {voterModal&&<VoterModal candidate={voterModal.candidate} contest={voterModal.contest} onConfirm={handleVoteConfirm} onClose={()=>setVoterModal(null)}/>}
      {receiptData&&<VoteReceipt data={receiptData} onClose={()=>setReceiptData(null)}/>}
      {toast&&<ToastBar toast={toast} onClose={()=>setToast(null)}/>}
      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

function ToastBar({ toast, onClose }) {
  return (
    <div style={{ position:'fixed', bottom:'30px', left:'50%', transform:'translateX(-50%)', background:'#fff', padding:'14px 22px', borderRadius:'20px', boxShadow:'0 20px 50px rgba(0,0,0,0.15)', display:'flex', alignItems:'center', gap:'12px', zIndex:9999, border:`1px solid ${toast.type==='ERROR'?'#fecaca':'#bbf7d0'}`, animation:'slideUp 0.3s ease', minWidth:'280px' }}>
      {toast.type==='ERROR'?<AlertCircle size={18} color="#ef4444"/>:<Check size={18} color="#22c55e"/>}
      <span style={{ fontWeight:700, fontSize:'13px', flex:1 }}>{toast.message}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><X size={16}/></button>
    </div>
  );
}

const S = {
  container: { maxWidth:'1100px', margin:'0 auto', padding:'100px 20px 60px' },
  badge: { display:'inline-flex', alignItems:'center', gap:'8px', background:'#000', color:'#fff', padding:'8px 18px', borderRadius:'100px', fontSize:'11px', fontWeight:800, marginBottom:'20px', letterSpacing:'1px' },
  title: { fontSize:'clamp(40px,8vw,72px)', fontWeight:950, letterSpacing:'-4px', margin:'0 0 16px' },
  searchBox: { display:'flex', alignItems:'center', gap:'14px', maxWidth:'460px', margin:'0 auto', background:'#fff', padding:'16px 24px', borderRadius:'20px', border:'1px solid #f1f5f9', boxShadow:'0 4px 20px rgba(0,0,0,0.04)' },
  searchInput: { border:'none', outline:'none', width:'100%', fontWeight:700, fontSize:'15px', background:'none' },
  compCard: { background:'#fff', borderRadius:'28px', overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.04)', transition:'transform 0.2s' },
  chip: { display:'inline-flex', alignItems:'center', gap:'4px', background:'#f8fafc', color:'#64748b', padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700 },
  backBtn: { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#94a3b8', fontSize:'13px', marginBottom:'20px', padding:0 },
  iconBtn: { background:'#f1f5f9', border:'none', width:'38px', height:'38px', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9998, padding:'20px' },
  modal: { background:'#fff', borderRadius:'32px', padding:'36px', width:'100%', maxWidth:'420px', boxShadow:'0 40px 80px rgba(0,0,0,0.25)', animation:'slideUp 0.3s ease', maxHeight:'90vh', overflowY:'auto' },
  inputRow: { display:'flex', alignItems:'center', gap:'12px', background:'#f8fafc', padding:'14px 18px', borderRadius:'14px', border:'1px solid #f1f5f9' },
  inlineInput: { border:'none', outline:'none', background:'none', fontSize:'14px', fontWeight:600, flex:1 },
  qtyBox: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'16px 20px', borderRadius:'16px', marginBottom:'16px', border:'1px solid #f1f5f9' },
  qtyBtn: { width:'36px', height:'36px', borderRadius:'10px', background:'#fff', border:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' },
  priceCard: { background:'#f8fafc', borderRadius:'16px', padding:'18px 20px', marginBottom:'16px' },
  priceRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' },
};
