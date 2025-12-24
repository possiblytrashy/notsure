"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Zap, Trophy, Heart } from 'lucide-react';

export default function VotingPortal() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContests() {
      const { data } = await supabase.from('contests').select('*, candidates(*)').eq('is_active', true);
      setContests(data || []);
      setLoading(false);
    }
    loadContests();
  }, []);

  const handleVote = async (candidateId, price) => {
    // This would trigger Paystack/MoMo in a real scenario
    alert(`Redirecting to payment for GHS ${price}...`);
    // After payment success:
    await supabase.rpc('increment_vote', { candidate_id: candidateId });
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading Contests...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      <h1 style={{ fontSize: '60px', fontWeight: 900, letterSpacing: '-3px', marginBottom: '40px' }}>
        Live <span style={{ color: '#0ea5e9' }}>Contests.</span>
      </h1>

      {contests.map(contest => (
        <div key={contest.id} style={{ marginBottom: '80px' }}>
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>{contest.title}</h2>
            <p style={{ color: '#666' }}>{contest.description} • <b>GHS {contest.vote_price} per vote</b></p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
            {contest.candidates?.map(candidate => (
              <div key={candidate.id} style={candidateCard}>
                <div style={{ height: '300px', borderRadius: '25px', backgroundImage: `url(${candidate.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ padding: '20px 10px' }}>
                  <h3 style={{ margin: '0 0 5px 0', fontWeight: 900, fontSize: '22px' }}>{candidate.name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#888' }}>{candidate.vote_count} VOTES</span>
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
      ))}
    </div>
  );
}

const candidateCard = { background: 'white', padding: '15px', borderRadius: '35px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' };
const voteBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '15px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
