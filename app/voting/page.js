"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, Search, Trophy, Crown, Share2, 
  Plus, Minus, BarChart3, ChevronRight, Award, Check, RefreshCcw, 
  Image as ImageIcon, AlertCircle
} from 'lucide-react';

export default function VotingPortal() {
  const [competitions, setCompetitions] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState('competitions'); 
  const [activeCompId, setActiveCompId] = useState(null); 
  const [activeCatId, setActiveCatId] = useState(null); 
  const [voteQuantities, setVoteQuantities] = useState({});
  const [toast, setToast] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);

  // 1. DATA FETCHING (Filtering for is_active at the source)
  const fetchLatestData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    
    const { data, error } = await supabase
      .from('competitions')
      .select(`
        *,
        contests (*, candidates(*))
      `);

    if (!error && data) {
      // Filter out competitions that have no active contests
      const filteredData = data.map(comp => ({
        ...comp,
        // Only keep contests that are active
        contests: comp.contests?.filter(ct => ct.is_active) || []
      })).filter(comp => comp.contests.length > 0);

      setCompetitions(filteredData);
    }
    
    setLoading(false);
    if (isManual) setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  useEffect(() => {
    fetchLatestData();
  }, [fetchLatestData]);

  // DERIVED STATES
  const activeComp = competitions.find(c => c.id === activeCompId);
  const activeContest = activeComp?.contests?.find(ct => ct.id === activeCatId);

  // 2. HANDLERS
  const triggerConfetti = () => {
    if (typeof window !== "undefined" && window.confetti) {
      window.confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0ea5e9', '#000000', '#ffffff']
      });
    }
  };

const handleVote = async (candidate, qty) => {
     if (!activeContest || !activeContest.is_active) {
       setToast({ type: 'ERROR', message: 'Voting is currently paused.' });
       return;
     }

     try {
       console.log('Sending vote request:', {
         type: 'VOTE',
         candidate_id: candidate.id,
         vote_count: qty,
         email: "voter@ousted.com"
       });

       const response = await fetch('/api/checkout/secure-session', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           type: 'VOTE',
           candidate_id: candidate.id,
           vote_count: qty,
           email: "voter@ousted.com"
         }),
       });

       const initData = await response.json();
       console.log('Response:', initData);

       if (!response.ok) {
         throw new Error(initData.error || 'Failed to initialize payment');
       }

       window.location.href = initData.authorization_url;

     } catch (err) {
       console.error('Vote error:', err);
       setToast({ type: 'ERROR', message: err.message });
     }
   };

  const handleShare = (candidate) => {
    const shareText = `Vote for ${candidate.name} in ${activeContest?.title}! Support here: ${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: 'Lumina', text: shareText, url: window.location.href });
    } else {
      navigator.clipboard.writeText(shareText);
      setCopySuccess(candidate.id);
      setTimeout(() => setCopySuccess(null), 2000);
    }
  };

  if (loading) return (
    <div style={container}><div className="shimmer" style={{height:'400px', borderRadius:'40px', background:'#eee'}} /></div>
  );

  // VIEW 1: SELECT GRAND COMPETITION
  if (view === 'competitions') {
    return (
      <div style={container}>
        <header style={headerStyle}>
          <div style={premiumBadge}><Crown size={14}/> PREMIER</div>
          <h1 style={mainTitle}>Major <span style={accentText}>Events.</span></h1>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input placeholder="Search events..." style={searchBar} onChange={(e)=>setSearchQuery(e.target.value.toLowerCase())} />
          </div>
        </header>
        <div style={contestGrid}>
          {competitions.filter(c => c.title.toLowerCase().includes(searchQuery)).map(comp => (
            <div key={comp.id} onClick={()=>{setActiveCompId(comp.id); setView('categories');}} style={luxuryCard}>
              <div style={cardImageWrapper}>
                {comp.image_url ? (
                  <img src={comp.image_url} style={heroImg} alt={comp.title} />
                ) : (
                  <div style={cardImagePlaceholder}><Trophy size={40} color="#0ea5e9"/></div>
                )}
              </div>
              <div style={cardContent}>
                <h2 style={cardTitle}>{comp.title}</h2>
                <div style={cardFooter}>
                  <span>{comp.contests?.length || 0} Categories Live</span>
                  <div style={goButton}><ChevronRight size={18}/></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VIEW 2: SELECT CATEGORY (CONTEST)
  if (view === 'categories') {
    return (
      <div style={container}>
        <button onClick={()=>setView('competitions')} style={backBtn}><ArrowLeft size={18}/> Back</button>
        <h1 style={subHeaderTitle}>{activeComp?.title}</h1>
        <div style={categoryList}>
          {activeComp?.contests?.map(ct => (
            <div key={ct.id} onClick={()=>{setActiveCatId(ct.id); setView('leaderboard');}} style={categoryRowLuxury}>
              <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
                <div style={categoryIcon}>
                   {ct.image_url ? <img src={ct.image_url} style={imgFillRound} /> : <Award color="#0ea5e9"/>}
                </div>
                <span style={{fontWeight:800, fontSize:'20px'}}>{ct.title}</span>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                <span style={priceTagMini}>GHS {ct.vote_price}</span>
                <ChevronRight color="#0ea5e9" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // VIEW 3: LEADERBOARD
  const candidates = activeContest?.candidates?.sort((a,b) => b.vote_count - a.vote_count) || [];
  const totalVotes = candidates.reduce((acc, curr) => acc + curr.vote_count, 0);

  return (
    <div style={container}>
      <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js" defer></script>
      <div style={navHeader}>
        <button onClick={()=>setView('categories')} style={backBtn}><ArrowLeft size={18}/> Categories</button>
        <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
            <button onClick={() => fetchLatestData(true)} style={refreshIconBtn}>
              <RefreshCcw size={16} className={isRefreshing ? "spin" : ""} />
            </button>
            <div style={liveIndicator}><div style={pulseDot}/> {totalVotes.toLocaleString()} VOTES</div>
        </div>
      </div>

      <h2 style={{fontSize:'32px', fontWeight:900, marginBottom:'30px'}}>{activeContest?.title}</h2>

      <div style={luxuryGallery}>
        {candidates.map((can, index) => {
          const qty = voteQuantities[can.id] || 1;
          const percentage = totalVotes > 0 ? (can.vote_count / totalVotes) * 100 : 0;
          return (
            <div key={can.id} style={tallCandidateCard}>
              <div style={imageWrapper}>
                <img src={can.image_url} style={heroImg} alt={can.name} />
                <div style={rankOverlay}>#{index + 1}</div>
                <button onClick={() => handleShare(can)} style={shareBtn}>
                   {copySuccess === can.id ? <Check size={18} color="#0ea5e9" /> : <Share2 size={18} />}
                </button>
              </div>
              <div style={cardInfo}>
                <h3 style={candidateName}>{can.name}</h3>
                <div style={barContainer}><div style={{...barFill, width: `${percentage}%`}} /></div>
                <div style={votingControl}>
                  <div style={qtySelector}>
                    <button onClick={() => setVoteQuantities({...voteQuantities, [can.id]: Math.max(1, qty - 1)})} style={qtyBtn}><Minus size={14}/></button>
                    <input type="number" value={qty} onChange={(e) => setVoteQuantities({...voteQuantities, [can.id]: parseInt(e.target.value) || 1})} style={qtyInput} />
                    <button onClick={() => setVoteQuantities({...voteQuantities, [can.id]: qty + 1})} style={qtyBtn}><Plus size={14}/></button>
                  </div>
                  <button 
                    onClick={() => handleVote(can, qty)} 
                    style={grandVoteBtn}
                  >
                    VOTE — GHS {(qty * (activeContest?.vote_price || 0)).toFixed(2)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toast && (
        <div style={{...toastContainer, borderColor: toast.type === 'ERROR' ? '#ef4444' : '#0ea5e9'}}>
          {toast.type === 'ERROR' ? <AlertCircle size={18} color="#ef4444"/> : <Check size={18} color="#0ea5e9"/>} 
          <span>{toast.type === 'ERROR' ? toast.message : `Success! ${toast.count} votes for ${toast.name}`}</span>
          {toast.type === 'ERROR' && <button onClick={() => setToast(null)} style={{background:'none', border:'none', marginLeft:'10px', cursor:'pointer'}}>×</button>}
        </div>
      )}

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .shimmer { animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}

// --- STYLES (Kept exactly as requested) ---
const container = { maxWidth: '1100px', margin: '0 auto', padding: '100px 20px' };
const headerStyle = { textAlign:'center', marginBottom:'60px' };
const mainTitle = { fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, letterSpacing: '-4px' };
const accentText = { color: '#0ea5e9' };
const premiumBadge = { display:'inline-flex', alignItems:'center', gap:'8px', background:'#000', color:'#fff', padding:'8px 16px', borderRadius:'100px', fontSize:'12px', fontWeight:800, marginBottom:'20px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' };
const luxuryCard = { background:'#fff', borderRadius:'45px', overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', boxShadow:'0 20px 40px rgba(0,0,0,0.03)' };
const cardImageWrapper = { height: '220px', overflow: 'hidden' };
const cardImagePlaceholder = { height:'100%', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' };
const cardContent = { padding: '30px' };
const cardTitle = { fontSize:'24px', fontWeight:900 };
const cardFooter = { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px', color:'#0ea5e9', fontWeight:800 };
const goButton = { width:'40px', height:'40px', background:'#000', color:'#fff', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center' };
const backBtn = { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#94a3b8', marginBottom: '20px' };
const subHeaderTitle = { fontSize:'48px', fontWeight:900, letterSpacing:'-2px' };
const categoryList = { marginTop: '30px', display:'flex', flexDirection:'column', gap:'15px' };
const categoryRowLuxury = { background:'#fff', padding:'20px 30px', borderRadius:'30px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', border:'1px solid #f1f5f9' };
const categoryIcon = { width:'60px', height:'60px', background:'#f0f9ff', borderRadius:'20px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' };
const imgFillRound = { width:'100%', height:'100%', objectFit:'cover' };
const navHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'40px' };
const luxuryGallery = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '40px' };
const tallCandidateCard = { background: '#fff', borderRadius: '40px', overflow: 'hidden', border: '1px solid #f0f0f0' };
const imageWrapper = { height: '450px', position: 'relative' };
const heroImg = { width: '100%', height: '100%', objectFit: 'cover' };
const rankOverlay = { position: 'absolute', top: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '10px 18px', borderRadius: '15px', fontWeight: 900, backdropFilter: 'blur(10px)' };
const shareBtn = { position: 'absolute', top: '20px', right: '20px', width: '45px', height: '45px', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const cardInfo = { padding: '30px' };
const candidateName = { fontSize: '28px', fontWeight: 900, marginBottom: '20px', textAlign: 'center' };
const barContainer = { background:'#f1f5f9', height:'10px', borderRadius:'20px', marginBottom:'25px', overflow:'hidden' };
const barFill = { background: 'linear-gradient(90deg, #0ea5e9, #6366f1)', height:'100%', transition:'width 1s ease' };
const votingControl = { display:'flex', flexDirection:'column', gap:'12px' };
const qtySelector = { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'8px', borderRadius:'20px' };
const qtyInput = { border: 'none', background: 'none', width: '80px', textAlign: 'center', fontWeight: 900, fontSize: '20px', outline: 'none' };
const qtyBtn = { width:'45px', height:'45px', borderRadius:'15px', border:'none', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' };
const grandVoteBtn = { background:'#000', color:'#fff', border:'none', padding:'22px', borderRadius:'25px', fontWeight: 900, fontSize: '16px', cursor:'pointer' };
const searchContainer = { display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '500px', margin: '40px auto 0', background: '#fff', padding: '18px 30px', borderRadius: '25px', border: '1px solid #f1f5f9' };
const searchBar = { border: 'none', outline: 'none', width: '100%', fontWeight: 700, fontSize: '16px' };
const liveIndicator = { display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontWeight: 800, fontSize: '14px', background: '#f0f9ff', padding: '8px 16px', borderRadius: '100px' };
const pulseDot = { width:'10px', height:'10px', background:'#0ea5e9', borderRadius:'50%', animation: 'pulse 2s infinite' };
const refreshIconBtn = { background: '#f1f5f9', border: 'none', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const toastContainer = { position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '15px 30px', borderRadius: '25px', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000, border: '1px solid #0ea5e9' };
const priceTagMini = { background: '#f0f9ff', color: '#0ea5e9', padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 };
