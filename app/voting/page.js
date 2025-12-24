"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap, Trophy, Search, TrendingUp, Filter, XCircle } from 'lucide-react';

export default function VotingPortal() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadContests() {
      const { data } = await supabase
        .from('contests')
        .select('*, candidates(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      setContests(data || []);
      setLoading(false);
    }
    loadContests();
  }, []);

  const handleVote = async (candidateId, price) => {
    alert(`Initiating payment for GHS ${price}...`);
    const { error } = await supabase.rpc('increment_vote', { candidate_id: candidateId });
    if (error) alert("Voting error: " + error.message);
  };

  // Logic to filter contests OR candidates based on search
  const filteredContests = contests.filter(contest => {
    const contestMatches = contest.title.toLowerCase().includes(searchQuery);
    const nomineeMatches = contest.candidates?.some(c => 
      c.name.toLowerCase().includes(searchQuery)
    );
    return contestMatches || nomineeMatches;
  });

  if (loading) return <div style={centerText}>Loading Choice Engine...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '140px 20px' }}>
      
      {/* HEADER & SEARCH SECTION */}
      <header style={{ textAlign: 'center', marginBottom: '80px' }}>
        <h1 style={{ fontSize: '72px', fontWeight: 900, letterSpacing: '-4px', margin: 0 }}>
          Live <span style={{ color: '#0ea5e9' }}>Contests.</span>
        </h1>
        
        <div style={searchWrapper}>
          <div style={searchContainer}>
            <Search size={20} color="#0ea5e9" />
            <input 
              type="text" 
              placeholder="Search contests or nominees..." 
              style={searchBar} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toLowerCase())}
            />
            {searchQuery && (
              <XCircle 
                size={20} 
                color="#aaa" 
                style={{ cursor: 'pointer' }} 
                onClick={() => setSearchQuery("")} 
              />
            )}
          </div>
        </div>
      </header>

      {/* NO RESULTS STATE */}
      {filteredContests.length === 0 && (
        <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.5 }}>
          <Filter size={48} style={{ marginBottom: '20px' }} />
          <h2 style={{ fontWeight: 900 }}>No contests or nominees found.</h2>
          <p>Try searching for a different keyword.</p>
        </div>
      )}

      {/* CONTEST LIST */}
      {filteredContests.map(contest => {
        const categories = contest.candidates?.reduce((acc, cand) => {
          const cat = cand.category || 'Nominees';
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(cand);
          return acc;
        }, {});

        return (
          <div key={contest.id} style={contestWrapper}>
            <div style={contestTitleBox}>
              <div>
                <h2 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>{contest.title}</h2>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{contest.description}</p>
              </div>
              <div style={priceTag}>GHS {contest.vote_price} / VOTE</div>
            </div>

            {Object.keys(categories).map(catName => {
              // Only show candidates that match search OR show all if contest title matched
              const contestTitleMatched = contest.title.toLowerCase().includes(searchQuery);
              const filteredCands = categories[catName].filter(c => 
                contestTitleMatched || c.name.toLowerCase().includes(searchQuery)
              );

              if (filteredCands.length === 0) return null;

              return (
                <div key={catName} style={{ marginBottom: '40px' }}>
                  <h3 style={categoryHeader}><Trophy size={18} /> {catName.toUpperCase()}</h3>
                  
                  <div style={candidateGrid}>
                    {filteredCands.sort((a,b) => b.vote_count - a.vote_count).map((candidate, index) => (
                      <div key={candidate.id} style={candidateCard}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ 
                            height: '300px', 
                            borderRadius: '25px', 
                            backgroundImage: `url(${candidate.image_url})`, 
                            backgroundSize: 'cover', 
                            backgroundPosition: 'center',
                            backgroundColor: '#f0f0f0'
                          }} />
                          {index === 0 && <div style={leaderBadge}><TrendingUp size={12}/> LEADER</div>}
                        </div>

                        <div style={{ padding: '20px 10px' }}>
                          <h3 style={{ margin: '0 0 5px 0', fontWeight: 900, fontSize: '22px' }}>{candidate.name}</h3>
                          <p style={bioStyle}>{candidate.description || "Official Nominee"}</p>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                            <span style={voteCount}>{candidate.vote_count.toLocaleString()} VOTES</span>
                            <button 
                              onClick={() => handleVote(candidate.id, contest.vote_price)}
                              style={voteBtn}
                            >
                              <Zap size={16} fill="white" /> VOTE
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// UPDATED STYLES
const searchWrapper = { display: 'flex', justifyContent: 'center', marginTop: '40px' };
const searchContainer = { 
  display: 'flex', 
  alignItems: 'center', 
  gap: '15px', 
  width: '100%',
  maxWidth: '600px', 
  background: '#fff', 
  padding: '18px 30px', 
  borderRadius: '25px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
  border: '1px solid #eee'
};
const searchBar = { border: 'none', background: 'none', width: '100%', fontSize: '18px', outline: 'none', fontWeight: 600, color: '#000' };

// (Previous styles remain the same)
const centerText = { padding: '150px', textAlign: 'center', fontWeight: 800, color: '#888', fontSize: '20px' };
const contestWrapper = { marginBottom: '80px', background: 'rgba(255,255,255,0.8)', padding: '40px', borderRadius: '45px', border: '1px solid white', boxShadow: '0 30px 60px rgba(0,0,0,0.02)', backdropFilter: 'blur(20px)' };
const contestTitleBox = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' };
const priceTag = { background: '#000', color: '#fff', padding: '10px 20px', borderRadius: '15px', fontWeight: 900, fontSize: '14px', whiteSpace: 'nowrap' };
const categoryHeader = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800, color: '#0ea5e9', marginBottom: '25px', letterSpacing: '1px' };
const candidateGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' };
const candidateCard = { background: 'white', padding: '15px', borderRadius: '35px', border: '1px solid #f0f0f0', transition: 'transform 0.2s ease' };
const leaderBadge = { position: 'absolute', top: '15px', left: '15px', background: '#22c55e', color: '#fff', padding: '8px 15px', borderRadius: '12px', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 10px 20px rgba(34, 197, 94, 0.3)' };
const bioStyle = { margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.4, height: '36px', overflow: 'hidden' };
const voteCount = { fontSize: '14px', fontWeight: 800, color: '#000' };
const voteBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
