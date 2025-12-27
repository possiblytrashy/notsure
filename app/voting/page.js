"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, Search, Trophy, Crown, Share2, 
  Plus, Minus, BarChart3, ChevronRight, Award, Check
} from 'lucide-react';

export default function VotingPortal() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState('competitions'); 
  const [activeComp, setActiveComp] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [voteQuantities, setVoteQuantities] = useState({});
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('contests').select('*, candidates(*)').eq('is_active', true);
      setCompetitions(data || []);
      setTimeout(() => setLoading(false), 800); 
    }
    loadData();

    const channel = supabase.channel('live-voting')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidates' }, 
      payload => {
        setCompetitions(prev => prev.map(comp => ({
          ...comp,
          candidates: comp.candidates.map(can => can.id === payload.new.id ? payload.new : can)
        })));

        const diff = payload.new.vote_count - (payload.old.vote_count || 0);
        if (diff > 0) {
          setToast({ name: payload.new.name, count: diff, id: Date.now() });
          setTimeout(() => setToast(null), 4000);
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleVote = (candidate, qty) => {
    if (!window.PaystackPop) return;
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: "voter@ousted.com",
      amount: Math.round(qty * activeComp.vote_price * 100),
      currency: "GHS",
      metadata: { 
        candidate_id: candidate.id, 
        vote_count: qty, 
        type: 'VOTE',
        organizer_id: activeComp.organizer_id 
      },
      callback: (res) => alert("Order Received! Processing...")
    });
    handler.openIframe();
  };

  const handleShare = (candidate) => {
    const shareText = `Vote for ${candidate.name} in the ${activeComp.title}! Click here to support: ${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: 'Lumina Voting', text: shareText, url: window.location.href });
    } else {
      navigator.clipboard.writeText(shareText);
      setCopySuccess(candidate.id);
      setTimeout(() => setCopySuccess(null), 2000);
    }
  };

  const handleManualQtyChange = (candidateId, val) => {
    const parsed = parseInt(val);
    setVoteQuantities({ ...voteQuantities, [candidateId]: isNaN(parsed) || parsed < 1 ? 1 : parsed });
  };

  if (loading) return (
    <div style={container}>
       <div style={{...headerStyle, opacity: 0.3}}>
          <div style={{width: '100px', height: '20px', background: '#eee', borderRadius: '50px', margin: '0 auto 20px'}} />
          <div style={{width: '300px', height: '60px', background: '#eee', borderRadius: '20px', margin: '0 auto'}} />
       </div>
       <div style={contestGrid}>
         {[1, 2, 3].map(i => (
           <div key={i} style={{...luxuryCard, height: '300px', background: '#fcfcfc', border: '1px solid #eee'}}>
              <div style={{height: '150px', background: '#f0f0f0'}} className="shimmer" />
              <div style={{padding: '30px'}}><div style={{width: '60%', height: '20px', background: '#eee', borderRadius: '10px'}} /></div>
           </div>
         ))}
       </div>
       <style>{`.shimmer { animation: pulse 1.5s infinite ease-in-out; } @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
    </div>
  );

  if (view === 'competitions') {
    return (
      <div style={container}>
        <header style={headerStyle}>
          <div style={premiumBadge}><Crown size={14}/> PREMIER</div>
          <h1 style={mainTitle}>Major <span style={accentText}>Events.</span></h1>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input placeholder="Search..." style={searchBar} onChange={(e)=>setSearchQuery(e.target.value.toLowerCase())} />
          </div>
        </header>
        <div style={contestGrid}>
          {competitions.filter(c => c.title.toLowerCase().includes(searchQuery)).map(comp => (
            <div key={comp.id} onClick={()=>{setActiveComp(comp); setView('categories');}} style={luxuryCard}>
              <div style={cardImagePlaceholder}><Trophy size={40} color="#0ea5e9"/></div>
              <div style={cardContent}>
                <h2 style={cardTitle}>{comp.title}</h2>
                <div style={cardFooter}>
                  <span>{new Set(comp.candidates.map(can => can.category)).size} Categories</span>
                  <div style={goButton}><ChevronRight size={18}/></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'categories') {
    const categories = [...new Set(activeComp.candidates.map(c => c.category || 'General'))];
    return (
      <div style={container}>
        <button onClick={()=>setView('competitions')} style={backBtn}><ArrowLeft size={18}/> Back</button>
        <h1 style={subHeaderTitle}>{activeComp.title}</h1>
        <div style={categoryList}>
          {categories.map(cat => (
            <div key={cat} onClick={()=>{setActiveCat(cat); setView('leaderboard');}} style={categoryRowLuxury}>
              <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
                <div style={categoryIcon}><Award color="#0ea5e9"/></div>
                <span style={{fontWeight:800, fontSize:'20px'}}>{cat}</span>
              </div>
              <ChevronRight color="#0ea5e9" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredCandidates = activeComp.candidates
    .filter(c => (c.category || 'General') === activeCat)
    .sort((a,b) => b.vote_count - a.vote_count);
  const totalVotes = filteredCandidates.reduce((acc, curr) => acc + curr.vote_count, 0);

  return (
    <div style={container}>
      <div style={navHeader}>
        <button onClick={()=>setView('categories')} style={backBtn}><ArrowLeft size={18}/> Categories</button>
        <div style={liveIndicator}><div style={pulseDot}/> {totalVotes.toLocaleString()} VOTES</div>
      </div>

      <div style={luxuryGallery}>
        {filteredCandidates.map((can, index) => {
          const qty = voteQuantities[can.id] || 1;
          const percentage = totalVotes > 0 ? (can.vote_count / totalVotes) * 100 : 0;
          return (
            <div key={can.id} style={tallCandidateCard}>
              <div style={imageWrapper}>
                <img src={can.image_url} style={heroImg} />
                <div style={rankOverlay}>#{index + 1}</div>
                <button onClick={() => handleShare(can)} style={shareBtn}>
                   {copySuccess === can.id ? <Check size={18} /> : <Share2 size={18} />}
                </button>
              </div>
              <div style={cardInfo}>
                <h3 style={candidateName}>{can.name}</h3>
                <div style={barContainer}><div style={{...barFill, width: `${percentage}%`}} /></div>
                <div style={votingControl}>
                  <div style={qtySelector}>
                    <button onClick={() => setVoteQuantities({...voteQuantities, [can.id]: Math.max(1, qty - 1)})} style={qtyBtn}><Minus size={14}/></button>
                    <input type="number" value={qty} onChange={(e) => handleManualQtyChange(can.id, e.target.value)} style={qtyInput} />
                    <button onClick={() => setVoteQuantities({...voteQuantities, [can.id]: qty + 1})} style={qtyBtn}><Plus size={14}/></button>
                  </div>
                  <button onClick={() => handleVote(can, qty)} style={grandVoteBtn}>
                    VOTE {qty > 1 ? `(${qty.toLocaleString()})` : ''} — GHS {(qty * (activeComp?.vote_price || 0)).toFixed(2)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={toastContainer}>
          <div style={toastIcon}><BarChart3 size={18} color="#fff"/></div>
          <div style={toastText}>
             <span style={{fontWeight: 900}}>Activity:</span> {toast.count} votes for {toast.name}
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// --- FULL STYLE OBJECTS ---
const container = { maxWidth: '1100px', margin: '0 auto', padding: '120px 20px' };
const headerStyle = { textAlign:'center', marginBottom:'60px' };
const mainTitle = { fontSize: '72px', fontWeight: 900, letterSpacing: '-4px', lineHeight: 1 };
const accentText = { color: '#0ea5e9' };
const premiumBadge = { display:'inline-flex', alignItems:'center', gap:'8px', background:'#000', color:'#fff', padding:'8px 16px', borderRadius:'100px', fontSize:'12px', fontWeight:800, marginBottom:'20px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' };
const luxuryCard = { background:'#fff', borderRadius:'45px', overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', boxShadow:'0 20px 40px rgba(0,0,0,0.03)' };
const cardImagePlaceholder = { height:'150px', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' };
const cardContent = { padding: '30px' };
const cardTitle = { fontSize:'24px', fontWeight:900 };
const cardFooter = { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px', color:'#0ea5e9', fontWeight:800 };
const goButton = { width:'40px', height:'40px', background:'#000', color:'#fff', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center' };
const backBtn = { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#94a3b8', marginBottom: '20px' };
const subHeaderTitle = { fontSize:'48px', fontWeight:900, letterSpacing:'-2px' };
const categoryList = { marginTop: '30px', display:'flex', flexDirection:'column', gap:'15px' };
const categoryRowLuxury = { background:'#fff', padding:'30px', borderRadius:'30px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', border:'1px solid #f1f5f9' };
const categoryIcon = { width:'50px', height:'50px', background:'#f0f9ff', borderRadius:'18px', display:'flex', alignItems:'center', justifyContent:'center' };
const navHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'40px' };
const luxuryGallery = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '40px' };
const tallCandidateCard = { background: '#fff', borderRadius: '40px', overflow: 'hidden', border: '1px solid #f0f0f0', boxShadow: '0 30px 60px rgba(0,0,0,0.05)' };
const imageWrapper = { height: '450px', position: 'relative' };
const heroImg = { width: '100%', height: '100%', objectFit: 'cover' };
const rankOverlay = { position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 18px', borderRadius: '15px', fontWeight: 900, backdropFilter: 'blur(10px)' };
const shareBtn = { position: 'absolute', top: '20px', right: '20px', width: '45px', height: '45px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const cardInfo = { padding: '30px' };
const candidateName = { fontSize: '28px', fontWeight: 900, marginBottom: '20px', textAlign: 'center' };
const barContainer = { background:'#f1f5f9', height:'10px', borderRadius:'20px', marginBottom:'25px', overflow:'hidden' };
const barFill = { background: 'linear-gradient(90deg, #0ea5e9, #6366f1)', height:'100%', transition:'width 1s ease' };
const votingControl = { display:'flex', flexDirection:'column', gap:'12px' };
const qtySelector = { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'8px', borderRadius:'20px' };
const qtyInput = { border: 'none', background: 'none', width: '80px', textAlign: 'center', fontWeight: 900, fontSize: '20px', outline: 'none' };
const qtyBtn = { width:'45px', height:'45px', borderRadius:'15px', border:'none', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
const grandVoteBtn = { background:'#000', color:'#fff', border:'none', padding:'22px', borderRadius:'25px', fontWeight: 900, fontSize: '16px', cursor:'pointer' };
const searchContainer = { display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '500px', margin: '40px auto 0', background: '#fff', padding: '18px 30px', borderRadius: '25px', boxShadow: '0 15px 50px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' };
const searchBar = { border: 'none', outline: 'none', width: '100%', fontWeight: 700, fontSize: '16px', color: '#000' };
const liveIndicator = { display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontWeight: 800, fontSize: '14px', background: '#f0f9ff', padding: '8px 16px', borderRadius: '100px' };
const pulseDot = { width:'10px', height:'10px', background:'#0ea5e9', borderRadius:'50%' };
const toastContainer = { position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '12px 24px', borderRadius: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '15px', zIndex: 1000, border: '1px solid #f1f5f9', animation: 'slideUp 0.4s ease-out' };
const toastIcon = { width: '35px', height: '35px', background: '#000', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const toastText = { fontSize: '14px', color: '#1e293b' };
