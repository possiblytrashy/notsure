"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Zap, Trophy, Search, TrendingUp, ArrowLeft, 
  ChevronRight, Share2, XCircle, BarChart3, Send 
} from 'lucide-react';

export default function VotingPortal() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Navigation State
  const [selectedContest, setSelectedContest] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    async function loadInitialData() {
      const { data } = await supabase
        .from('contests')
        .select('*, candidates(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      setContests(data || []);

      // DEEP LINKING: Check URL for ?contest=Title&cat=Category
      const params = new URLSearchParams(window.location.search);
      const urlContest = params.get('contest');
      const urlCat = params.get('cat');

      if (urlContest && data) {
        const found = data.find(c => c.title === urlContest);
        if (found) {
          setSelectedContest(found);
          if (urlCat) setSelectedCategory(urlCat);
        }
      }
      setLoading(false);
    }
    loadInitialData();

    // REAL-TIME: Listen for vote increments globally
    const channel = supabase.channel('live-voting-results')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'candidates' }, 
      payload => {
        setContests(prev => prev.map(con => ({
          ...con,
          candidates: con.candidates.map(can => can.id === payload.new.id ? payload.new : can)
        })));
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleShare = (contestTitle, categoryName) => {
    const url = `${window.location.origin}/voting?contest=${encodeURIComponent(contestTitle)}&cat=${encodeURIComponent(categoryName)}`;
    const text = `Check out the live leaderboard for ${categoryName} in the ${contestTitle}! Vote now on OUSTED. 🗳️`;
    
    if (navigator.share) {
      navigator.share({ title: 'OUSTED Voting', text, url });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`);
    }
  };

  const handleVote = async (candidateId, price) => {
    alert(`Redirecting to Mobile Money for GHS ${price}...`);
    await supabase.rpc('increment_vote', { candidate_id: candidateId });
  };

  if (loading) return <div style={centerText}>Initializing OUSTED Choice Engine...</div>;

  // VIEW 1: CONTEST LIST (With Search)
  if (!selectedContest) {
    const filteredContests = contests.filter(c => 
      c.title.toLowerCase().includes(searchQuery) || 
      c.candidates.some(can => can.name.toLowerCase().includes(searchQuery))
    );

    return (
      <div style={container}>
        <header style={headerStyle}>
          <h1 style={mainTitle}>Live <span style={{color:'#0ea5e9'}}>Contests.</span></h1>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input 
              placeholder="Search contests or nominees..." 
              style={searchBar}
              onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            />
          </div>
        </header>

        <div style={contestGrid}>
          {filteredContests.map(c => (
            <div key={c.id} onClick={() => setSelectedContest(c)} style={contestCard}>
              <div style={contestIcon}><Trophy size={24} color="#0ea5e9"/></div>
              <h2 style={{margin:'15px 0 5px', fontWeight:900}}>{c.title}</h2>
              <p style={{color:'#666', fontSize:'14px', marginBottom:'20px'}}>{c.description}</p>
              <div style={categoryBadge}>{c.candidates?.length} Total Nominees</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ... (rest of the code above stays the same)

  // VIEW 2: CATEGORY SELECTION
  if (selectedContest && !selectedCategory) {
    // You named this 'categories'
    const categories = [...new Set(selectedContest.candidates.map(c => c.category || 'General Nominees'))];
    
    return (
      <div style={container}>
        <button onClick={() => setSelectedContest(null)} style={backBtn}>
          <ArrowLeft size={18}/> Back to Contests
        </button>
        <h1 style={mainTitle}>{selectedContest.title}</h1>
        
        {/* CHANGED: Ensure style={categoryListStyle} exists and matches */}
        <div style={categoryListStyle}> 
          {categories.map(cat => (
            <div key={cat} onClick={() => setSelectedCategory(cat)} style={categoryRow}>
              <span style={{fontWeight:800, fontSize:'18px'}}>{cat}</span>
              <ChevronRight color="#ccc" />
            </div>
          ))}
        </div>
      </div>
    );
  }

// ... (rest of the code)


  // VIEW 3: LIVE LEADERBOARD
  const filteredCandidates = selectedContest.candidates
    .filter(c => (c.category || 'General Nominees') === selectedCategory)
    .sort((a, b) => b.vote_count - a.vote_count);

  const totalVotes = filteredCandidates.reduce((acc, curr) => acc + curr.vote_count, 0);

  return (
    <div style={container}>
      <div style={navHeader}>
        <button onClick={() => setSelectedCategory(null)} style={backBtn}><ArrowLeft size={18}/> All Categories</button>
        <button onClick={() => handleShare(selectedContest.title, selectedCategory)} style={shareBtn}>
          <Share2 size={18}/> SHARE
        </button>
      </div>

      <div style={leaderboardHead}>
        <div>
          <h1 style={{...mainTitle, fontSize:'40px', marginBottom:0}}>{selectedCategory}</h1>
          <p style={{color:'#0ea5e9', fontWeight:800, letterSpacing:'1px'}}><BarChart3 size={16} inline/> LIVE LEADERBOARD</p>
        </div>
        <div style={totalBadge}>{totalVotes.toLocaleString()} VOTES</div>
      </div>

      

      <div style={leaderboardBox}>
        {filteredCandidates.map((can, index) => {
          const percentage = totalVotes > 0 ? (can.vote_count / totalVotes) * 100 : 0;
          return (
            <div key={can.id} style={candidateRow}>
              <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
                <div style={rankText}>{index + 1}</div>
                <div style={avatarCircle}><img src={can.image_url} style={avatarImg} /></div>
                <div style={{flex:1}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                    <span style={{fontWeight:900, fontSize:'18px'}}>{can.name}</span>
                    <span style={{fontWeight:900, color:'#0ea5e9'}}>{can.vote_count}</span>
                  </div>
                  <div style={barContainer}><div style={{...barFill, width: `${percentage}%`}} /></div>
                </div>
                <button onClick={() => handleVote(can.id, selectedContest.vote_price)} style={voteActionBtn}>VOTE</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// STYLES
const container = { maxWidth: '1000px', margin: '0 auto', padding: '140px 20px' };
const headerStyle = { textAlign:'center', marginBottom:'60px' };
const mainTitle = { fontSize: '64px', fontWeight: 900, letterSpacing: '-3px', marginBottom: '20px' };
const searchContainer = { display: 'flex', alignItems: 'center', gap: '15px', maxWidth: '500px', margin: '0 auto', background: '#fff', padding: '15px 25px', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.05)' };
const searchBar = { border: 'none', background: 'none', width: '100%', fontSize: '16px', outline: 'none', fontWeight: 600 };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' };
const contestCard = { background: '#fff', padding: '40px', borderRadius: '40px', border: '1px solid #eee', cursor: 'pointer', transition: 'transform 0.2s ease' };
const contestIcon = { width:'50px', height:'50px', background:'#f0f9ff', borderRadius:'15px', display:'flex', alignItems:'center', justifyContent:'center' };
const categoryBadge = { display:'inline-block', background:'#000', color:'#fff', padding:'5px 15px', borderRadius:'10px', fontSize:'11px', fontWeight:800 };
const backBtn = { background:'none', border:'none', cursor:'pointer', fontWeight:800, display:'flex', alignItems:'center', gap:'8px', color:'#aaa' };
const categoryRow = { background: '#fff', padding: '30px 40px', borderRadius: '30px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1px solid #eee' };
const navHeader = { display:'flex', justifyContent:'space-between', marginBottom:'20px' };
const shareBtn = { background:'#f8f8f8', border:'none', padding:'10px 20px', borderRadius:'15px', fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' };
const leaderboardHead = { display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'50px' };
const totalBadge = { background:'#0ea5e9', color:'#fff', padding:'12px 25px', borderRadius:'20px', fontWeight:900, fontSize:'14px' };
const candidateRow = { background:'#fff', padding:'25px', borderRadius:'35px', marginBottom:'15px', border:'1px solid #f0f0f0' };
const rankText = { fontSize:'24px', fontWeight:900, color:'#ddd', width:'30px' };
const avatarCircle = { width:'60px', height:'60px', borderRadius:'20px', overflow:'hidden', background:'#f0f0f0' };
const avatarImg = { width:'100%', height:'100%', objectFit:'cover' };
const barContainer = { background:'#f5f5f5', height:'8px', borderRadius:'10px', overflow:'hidden' };
const barFill = { background: 'linear-gradient(to right, #0ea5e9, #6366f1)', height:'100%', transition:'width 1.5s cubic-bezier(0.19, 1, 0.22, 1)' };
const voteActionBtn = { background:'#000', color:'#fff', border:'none', padding:'12px 25px', borderRadius:'15px', fontWeight:900, cursor:'pointer' };
const centerText = { padding: '150px', textAlign: 'center', fontWeight: 800, color: '#aaa', fontSize: '20px' };

// ADD THIS TO YOUR STYLES AT THE BOTTOM
const categoryListStyle = { 
  display: 'flex', 
  flexDirection: 'column', 
  gap: '10px',
  marginTop: '30px' 
};
