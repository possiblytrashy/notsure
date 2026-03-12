"use client";
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Plus, Trash2, DollarSign, Image as ImageIcon } from 'lucide-react';

export default function CreateVotingPage({ searchParams }) {
  const eventId = searchParams.eventId; // Pass eventId in URL
  const [fee, setFee] = useState(0);
  const [options, setOptions] = useState([{ title: '', description: '' }]);
  const [saving, setSaving] = useState(false);

  const addOption = () => setOptions([...options, { title: '', description: '' }]);

  const handleSaveVoting = async () => {
    setSaving(true);
    try {
      // 1. Update the event with the voting fee
      await supabase.from('events').update({ vote_fee: fee }).eq('id', eventId);

      // 2. Insert the voting options
      const optionsToInsert = options.map(opt => ({ ...opt, event_id: eventId }));
      const { error } = await supabase.from('voting_options').insert(optionsToInsert);

      if (error) throw error;
      alert("Voting session live!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '120px auto', padding: '20px' }}>
      <h1 style={{ fontWeight: 950, fontSize: '32px', letterSpacing: '-1.5px' }}>SET UP VOTING</h1>
      
      <div style={cardS}>
        <h3 style={labelS}>VOTING FEE (USD)</h3>
        <div style={{ position: 'relative' }}>
          <DollarSign style={iconS} size={16} />
          <input 
            type="number" 
            placeholder="0.00" 
            style={{ ...inputS, paddingLeft: '35px' }} 
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <p style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>Users must pay this amount to cast a vote.</p>
      </div>

      <div style={{ ...cardS, marginTop: '20px' }}>
        <h3 style={labelS}>NOMINEES / OPTIONS</h3>
        {options.map((opt, i) => (
          <div key={i} style={optionRowS}>
            <input 
              placeholder="Title" 
              style={inputS} 
              onChange={e => {
                const n = [...options]; n[i].title = e.target.value; setOptions(n);
              }} 
            />
            <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))} style={delBtnS}>
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button onClick={addOption} style={addBtnS}>+ ADD OPTION</button>
      </div>

      <button onClick={handleSaveVoting} disabled={saving} style={submitBtnS}>
        {saving ? "INITIALIZING..." : "CONFIRM VOTING SESSION"}
      </button>
    </div>
  );
}

const cardS = { background: 'rgba(255,255,255,0.7)', padding: '25px', borderRadius: '20px', border: '1px solid #eee' };
const labelS = { fontSize: '10px', fontWeight: 900, letterSpacing: '1px', marginBottom: '10px' };
const inputS = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #eee', outline: 'none', fontWeight: 600 };
const iconS = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#888' };
const optionRowS = { display: 'flex', gap: '10px', marginBottom: '10px' };
const delBtnS = { background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer' };
const addBtnS = { width: '100%', padding: '10px', borderRadius: '12px', border: '2px dashed #ddd', background: 'none', fontWeight: 800, cursor: 'pointer', marginTop: '10px' };
const submitBtnS = { width: '100%', marginTop: '30px', padding: '20px', background: '#000', color: '#fff', borderRadius: '20px', fontWeight: 900, border: 'none', cursor: 'pointer' };
