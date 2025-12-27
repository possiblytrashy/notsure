"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, Search, Trophy, Crown, Share2, 
  Plus, Minus, BarChart3, ChevronRight, Award
} from 'lucide-react';

export default function VotingPortal() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState('competitions'); // 'competitions' | 'categories' | 'leaderboard'
  const [activeComp, setActiveComp] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [voteQuantities, setVoteQuantities] = useState({});

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase.from('contests').select('*, candidates(*)').eq('is_active', true);
      setCompetitions(data || []);
      setLoading(false);
    }
    loadData();

    const channel = supabase.channel('live-voting')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidates' }, 
      payload => {
        setCompetitions(prev => prev.map(comp => ({
          ...comp,
          candidates: comp.candidates.map(can => can.id === payload.new.id ? payload.new : can)
        })));
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleVote = (candidate, qty) => {
    if (!window.PaystackPop) return;
    const totalAmount = qty * (activeComp.vote_price || 1);

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: "voter@ousted.com",
      amount: Math.round(totalAmount * 100),
      currency: "GHS",
      metadata: { 
        candidate_id: candidate.id, 
        vote_count: qty, 
        type: 'VOTE',
        organizer_id: activeComp.organizer_id 
      },
      callback: function(response) {
        alert("Payment verified. Votes will update shortly.");
      }
    });
    handler.openIframe();
  };

  if (loading) return <div style={centerText}>Initialising Ousted Experience...</div>;

  // VIEW 1: COMPETITIONS
  if (view === 'competitions') {
    return (
      <div style={container}>
        <header style={headerStyle}>
          <div style={premiumBadge}><Crown size={14}/> PREMIER</div>
          <h1 style={mainTitle}>Major <span style={accentText}>Events.</span></h1>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input placeholder="Search competitions..." style={searchBar} onChange={(e)=>setSearchQuery(e.target.value.toLowerCase())} />
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

  // VIEW 2: CATEGORIES
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

  // VIEW 3: LEADERBOARD (Large Images)
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
              </div>
              <div style={cardInfo}>
                <h3 style={candidateName}>{can.name}</h3>
                <div style={barContainer}><div style={{...barFill, width: `${percentage}%`}} /></div>
                
                <div style={votingControl}>
                  <div style={qtySelector}>
                    <button onClick={()=>setVoteQuantities({...voteQuantities, [can.id]: Math.max(1, qty-1)})} style={qtyBtn}><Minus size={14}/></button>
                    <input type="number" value={qty} readOnly style={qtyInput} />
                    <button onClick={()=>setVoteQuantities({...voteQuantities, [can.id]: qty+1})} style={qtyBtn}><Plus size={14}/></button>
                  </div>
                  <button onClick={()=>handleVote(can, qty)} style={grandVoteBtn}>
                    VOTE {qty > 1 ? `(${qty})` : ''} — GHS {(qty * activeComp.vote_price).toFixed(2)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- STYLES ---
const container = { maxWidth: '1100px', margin: '0 auto', padding: '120px 20px' };
const headerStyle = { textAlign:'center', marginBottom:'60px' };
const mainTitle = { fontSize: '72px', fontWeight: 900, letterSpacing: '-4px' };
const accentText = { color: '#0ea5e9' };
const premiumBadge = { background:'#000', color:'#fff', padding:'8px 16px', borderRadius:'100px', fontSize:'12px', fontWeight:800, marginBottom:'20px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' };
const luxuryCard = { background:'#fff', borderRadius:'45px', overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer' };
const cardImagePlaceholder = { height:'150px', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' };
const cardContent = { padding: '30px' };
const cardTitle = { fontSize:'24px', fontWeight:900 };
const cardFooter = { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px', color:'#0ea5e9', fontWeight:800 };
const goButton = { width:'40px', height:'40px', background:'#000', color:'#fff', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center' };
const backBtn = { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#94a3b8' };
const categoryList = { marginTop: '30px', display:'flex', flexDirection:'column', gap:'15px' };
const categoryRowLuxury = { background:'#fff', padding:'30px', borderRadius:'30px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', border:'1px solid #f1f5f9' };
const categoryIcon = { width:'50px', height:'50px', background:'#f0f9ff', borderRadius:'18px', display:'flex', alignItems:'center', justifyContent:'center' };
const subHeaderTitle = { fontSize:'48px', fontWeight:900, letterSpacing:'-2px' };
const navHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px' };
const liveIndicator = { display:'flex', alignItems:'center', gap:'8px', color:'#0ea5e9', fontWeight:800 };
const pulseDot = { width:'10px', height:'10px', background:'#0ea5e9', borderRadius:'50%' };
const luxuryGallery = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '40px' };
const tallCandidateCard = { background: '#fff', borderRadius: '40px', overflow: 'hidden', border: '1px solid #f0f0f0' };
const imageWrapper = { height: '400px', position: 'relative' };
const heroImg = { width: '100%', height: '100%', objectFit: 'cover' };
const rankOverlay = { position: 'absolute', top: '20px', left: '20px', background: '#000', color: '#fff', padding: '8px 15px', borderRadius: '12px', fontWeight: 900 };
const cardInfo = { padding: '25px' };
const candidateName = { fontSize: '24px', fontWeight: 900, marginBottom: '15px', textAlign: 'center' };
const barContainer = { background:'#f1f5f9', height:'8px', borderRadius:'10px', marginBottom:'20px', overflow:'hidden' };
const barFill = { background: '#0ea5e9', height:'100%', transition:'width 1s ease' };
const votingControl = { display:'flex', flexDirection:'column', gap:'10px' };
const qtySelector = { display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', padding:'5px', borderRadius:'15px' };
const qtyInput = { border:'none', background:'none', width:'40px', textAlign:'center', fontWeight:900, fontSize:'18px' };
const qtyBtn = { width:'35px', height:'35px', borderRadius:'10px', border:'none', background:'#fff', cursor:'pointer', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' };
const grandVoteBtn = { background:'#000', color:'#fff', border:'none', padding:'18px', borderRadius:'20px', fontWeight:900, cursor:'pointer' };
const centerText = { padding: '100px', textAlign: 'center', fontWeight: 800 };
