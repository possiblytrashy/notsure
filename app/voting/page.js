"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Zap, Trophy, Search, TrendingUp, ArrowLeft, 
  ChevronRight, Share2, XCircle, BarChart3, Send,
  Award, Star, Flame, Crown
} from 'lucide-react';

export default function VotingPortal() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Navigation State - The 3-Tier Drill Down
  const [view, setView] = useState('competitions'); // 'competitions' | 'categories' | 'leaderboard'
  const [activeComp, setActiveComp] = useState(null);
  const [activeCat, setActiveCat] = useState(null);

  useEffect(() => {
    async function loadData() {
      // Fetching contests grouped by their competition/title
      const { data } = await supabase
        .from('contests')
        .select('*, candidates(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
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

  // Payment Logic
  const handleVote = (candidateId, price, candidateName) => {
    if (!window.PaystackPop) return;
    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, 
      email: "voter@ousted.com",
      amount: Math.round(price * 100),
      currency: "GHS",
      metadata: { candidate_id: candidateId, type: 'VOTE', organizer_id: activeComp.organizer_id },
      callback: function(response) {
        supabase.rpc('increment_vote', { candidate_id: candidateId });
      }
    });
    handler.openIframe();
  };

  if (loading) return <div style={centerText}>Loading Luxury Experience...</div>;

  // --- VIEW 1: COMPETITIONS (The "Grand Entry") ---
  if (view === 'competitions') {
    return (
      <div style={container}>
        <header style={headerStyle}>
          <div style={premiumBadge}><Crown size={14}/> PREMIER SELECTION</div>
          <h1 style={mainTitle}>Major <span style={accentText}>Competitions.</span></h1>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input placeholder="Search major events..." style={searchBar} onChange={(e) => setSearchQuery(e.target.value.toLowerCase())} />
          </div>
        </header>

        <div style={contestGrid}>
          {competitions.filter(c => c.title.toLowerCase().includes(searchQuery)).map(comp => (
            <div key={comp.id} onClick={() => { setActiveComp(comp); setView('categories'); }} style={luxuryCard}>
              <div style={cardImagePlaceholder}>
                <Trophy size={40} color="rgba(14, 165, 233, 0.5)"/>
              </div>
              <div style={cardContent}>
                <h2 style={cardTitle}>{comp.title}</h2>
                <p style={cardDesc}>{comp.description}</p>
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

  // --- VIEW 2: CATEGORIES (Specific Contests) ---
  if (view === 'categories') {
    const categories = [...new Set(activeComp.candidates.map(c => c.category || 'General Selection'))];
    return (
      <div style={container}>
        <button onClick={() => setView('competitions')} style={backBtn}><ArrowLeft size={18}/> Back to Competitions</button>
        <h1 style={subHeaderTitle}>{activeComp.title}</h1>
        <p style={subHeaderDesc}>Select a category to view live standings</p>
        
        <div style={categoryList}>
          {categories.map(cat => (
            <div key={cat} onClick={() => { setActiveCat(cat); setView('leaderboard'); }} style={categoryRowLuxury}>
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

  // --- VIEW 3: LIVE LEADERBOARD ---
  const filteredCandidates = activeComp.candidates
    .filter(c => (c.category || 'General Selection') === activeCat)
    .sort((a, b) => b.vote_count - a.vote_count);
  const totalVotes = filteredCandidates.reduce((acc, curr) => acc + curr.vote_count, 0);

  return (
    <div style={container}>
      <div style={navHeader}>
        <button onClick={() => setView('categories')} style={backBtn}><ArrowLeft size={18}/> All Categories</button>
        <button onClick={() => {/* handleShare */}} style={shareBtn}><Share2 size={18}/> SHARE</button>
      </div>

      <div style={leaderboardHeadLuxury}>
        <h1 style={{...mainTitle, fontSize:'48px', marginBottom:0}}>{activeCat}</h1>
        <div style={liveIndicator}><div style={pulseDot}/> LIVE STANDINGS • {totalVotes.toLocaleString()} VOTES</div>
      </div>

      <div style={leaderboardBox}>
        {filteredCandidates.map((can, index) => {
          const percentage = totalVotes > 0 ? (can.vote_count / totalVotes) * 100 : 0;
          return (
            <div key={can.id} style={candidateRowLuxury}>
              <div style={rankBadge}>{index + 1}</div>
              <div style={avatarCircle}><img src={can.image_url} style={avatarImg} /></div>
              <div style={{flex:1}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                  <span style={{fontWeight:900, fontSize:'20px', letterSpacing:'-0.5px'}}>{can.name}</span>
                  <span style={{fontWeight:900, color:'#0ea5e9'}}>{can.vote_count} <small style={{fontSize:'10px', color:'#aaa'}}>VOTES</small></span>
                </div>
                <div style={barContainer}><div style={{...barFill, width: `${percentage}%`}} /></div>
              </div>
              <button onClick={() => handleVote(can.id, activeComp.vote_price, can.name)} style={luxuryVoteBtn}>VOTE</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- ADVANCED LUXURY STYLES ---
const container = { maxWidth: '1100px', margin: '0 auto', padding: '120px 20px' };
const headerStyle = { textAlign:'center', marginBottom:'80px' };
const mainTitle = { fontSize: '72px', fontWeight: 900, letterSpacing: '-4px', lineHeight: 1 };
const accentText = { color: '#0ea5e9', background: 'linear-gradient(to right, #0ea5e9, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' };
const premiumBadge = { display:'inline-flex', alignItems:'center', gap:'8px', background:'#000', color:'#fff', padding:'8px 16px', borderRadius:'100px', fontSize:'12px', fontWeight:800, marginBottom:'20px', letterSpacing:'1px' };

const luxuryCard = { background:'#fff', borderRadius:'45px', overflow:'hidden', border:'1px solid #f0f0f0', cursor:'pointer', transition:'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', boxShadow:'0 20px 40px rgba(0,0,0,0.03)' };
const cardImagePlaceholder = { height:'200px', background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center' };
const cardContent = { padding: '30px' };
const cardTitle = { fontSize:'24px', fontWeight:900, marginBottom:'10px', letterSpacing:'-1px' };
const cardDesc = { color:'#64748b', fontSize:'15px', lineHeight:'1.6', marginBottom:'25px' };
const cardFooter = { display:'flex', justifyContent:'space-between', alignItems:'center', fontWeight:800, fontSize:'14px', color:'#0ea5e9' };
const goButton = { width:'40px', height:'40px', background:'#000', color:'#fff', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center' };

const categoryRowLuxury = { background:'#fff', padding:'35px', borderRadius:'35px', marginBottom:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', border:'1px solid #f1f5f9', transition:'0.2s' };
const categoryIcon = { width:'50px', height:'50px', background:'#f0f9ff', borderRadius:'18px', display:'flex', alignItems:'center', justifyContent:'center' };

const candidateRowLuxury = { display:'flex', gap:'25px', alignItems:'center', background:'#fff', padding:'30px', borderRadius:'40px', marginBottom:'20px', border:'1px solid #f1f5f9', position:'relative' };
const rankBadge = { position:'absolute', top:'-10px', left:'-10px', width:'35px', height:'35px', background:'#000', color:'#fff', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:900 };

const luxuryVoteBtn = { background:'#000', color:'#fff', border:'none', padding:'18px 35px', borderRadius:'22px', fontWeight:900, cursor:'pointer', transition:'0.3s' };
const liveIndicator = { display:'flex', alignItems:'center', gap:'10px', color:'#0ea5e9', fontWeight:800, fontSize:'14px', marginTop:'10px' };
const pulseDot = { width:'8px', height:'8px', background:'#0ea5e9', borderRadius:'50%', animation:'pulse 1.5s infinite' };

// Legacy Mappings to prevent ReferenceErrors
const categoryList = { marginTop: '30px', display:'flex', flexDirection:'column', gap:'15px' };
const categoryListStyle = categoryList;
const leaderboardBox = { marginTop: '40px' };
const backBtn = { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#94a3b8', marginBottom:'20px' };
const subHeaderTitle = { fontSize:'48px', fontWeight:900, letterSpacing:'-2px', marginBottom:'5px' };
const subHeaderDesc = { color:'#64748b', fontWeight:600, marginBottom:'40px' };
const searchContainer = { display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '500px', margin: '40px auto 0', background: '#fff', padding: '18px 30px', borderRadius: '25px', boxShadow: '0 15px 50px rgba(0,0,0,0.06)' };
const searchBar = { border:'none', outline:'none', width:'100%', fontWeight:700, fontSize:'16px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '30px' };
const centerText = { padding: '150px', textAlign: 'center', fontWeight: 800, color: '#aaa' };
const avatarCircle = { width:'80px', height:'80px', borderRadius:'25px', overflow:'hidden', background:'#f8fafc' };
const avatarImg = { width:'100%', height:'100%', objectFit:'cover' };
const barContainer = { background:'#f1f5f9', height:'10px', borderRadius:'20px', overflow:'hidden' };
const barFill = { background: 'linear-gradient(to right, #0ea5e9, #6366f1)', height:'100%', transition:'width 1s ease-in-out' };
const navHeader = { display:'flex', justifyContent:'space-between', marginBottom:'30px' };
const shareBtn = { background:'#fff', border:'1px solid #eee', padding:'12px 25px', borderRadius:'18px', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' };
const leaderboardHeadLuxury = { marginBottom:'40px' };
const totalBadge = { background:'#0ea5e9', color:'#fff', padding:'12px 25px', borderRadius:'20px', fontWeight:900 };
