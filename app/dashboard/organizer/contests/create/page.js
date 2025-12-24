"use client";
import { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';

export default function CreateContest() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(1);
  const [candidates, setCandidates] = useState([{ name: '', image_url: '' }]);

  const addCandidate = () => setCandidates([...candidates, { name: '', image_url: '' }]);

  const saveContest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // 1. Create Contest
    const { data: contest, error } = await supabase.from('contests').insert([
      { title, vote_price: price, organizer_id: user.id }
    ]).select().single();

    if (contest) {
      // 2. Create Candidates
      const candidateData = candidates.map(c => ({ ...c, contest_id: contest.id }));
      await supabase.from('candidates').insert(candidateData);
      window.location.href = '/dashboard/organizer';
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 20px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '30px' }}>
        <h2 style={{ fontWeight: 900, marginBottom: '20px' }}>Start a Contest</h2>
        <input placeholder="Contest Title (e.g. Artiste of the Year)" style={inputS} onChange={e => setTitle(e.target.value)} />
        <input type="number" placeholder="Vote Price (GHS)" style={inputS} onChange={e => setPrice(e.target.value)} />
        
        <h3 style={{ marginTop: '30px', fontWeight: 800 }}>Candidates</h3>
        {candidates.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input placeholder="Name" style={inputS} onChange={e => {
              const newC = [...candidates]; newC[i].name = e.target.value; setCandidates(newC);
            }} />
            <input placeholder="Image URL" style={inputS} onChange={e => {
              const newC = [...candidates]; newC[i].image_url = e.target.value; setCandidates(newC);
            }} />
          </div>
        ))}
        
        <button onClick={addCandidate} style={{ background: '#eee', border: 'none', padding: '10px', borderRadius: '10px', width: '100%', cursor: 'pointer', fontWeight: 700 }}>+ Add Candidate</button>
        <button onClick={saveContest} style={{ background: '#000', color: '#fff', padding: '20px', borderRadius: '15px', width: '100%', marginTop: '20px', fontWeight: 900, border: 'none', cursor: 'pointer' }}>PUBLISH CONTEST</button>
      </div>
    </div>
  );
}
const inputS = { width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #eee', marginBottom: '10px' };
