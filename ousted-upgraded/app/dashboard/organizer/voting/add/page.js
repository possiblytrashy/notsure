"use client";
import { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';

export default function AddVotingOptions({ searchParams }) {
  const eventId = searchParams.eventId;
  const [options, setOptions] = useState([{ title: '', description: '' }]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const optionsWithId = options.map(opt => ({ ...opt, event_id: eventId }));
    const { error } = await supabase.from('voting_options').insert(optionsWithId);
    
    if (!error) {
      window.location.href = `/dashboard/organizer/event?id=${eventId}`;
    } else {
      alert(error.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '120px auto', padding: '20px' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontWeight: 950, fontSize: '32px', letterSpacing: '-1.5px' }}>ADD NOMINEES</h1>
        <p style={{ color: '#666' }}>Define what people are voting for.</p>
      </header>

      {options.map((opt, i) => (
        <div key={i} style={cardS}>
          <input 
            placeholder="Option Title (e.g. Best Artist)" 
            style={inputS} 
            value={opt.title}
            onChange={e => {
              const n = [...options]; n[i].title = e.target.value; setOptions(n);
            }} 
          />
          <textarea 
            placeholder="Short Description" 
            style={{...inputS, height: '80px', marginTop: '10px'}} 
            value={opt.description}
            onChange={e => {
              const n = [...options]; n[i].description = e.target.value; setOptions(n);
            }} 
          />
          {options.length > 1 && (
            <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))} style={removeBtnS}>
              <Trash2 size={16} /> REMOVE
            </button>
          )}
        </div>
      ))}

      <button onClick={() => setOptions([...options, { title: '', description: '' }])} style={addBtnS}>
        <Plus size={18} /> ADD ANOTHER OPTION
      </button>

      <button onClick={handleSave} disabled={saving} style={submitBtnS}>
        {saving ? <Loader2 className="animate-spin" /> : "PUBLISH VOTING OPTIONS"}
      </button>
    </div>
  );
}

const cardS = { background: '#fff', padding: '20px', borderRadius: '20px', marginBottom: '15px', border: '1px solid #eee' };
const inputS = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #eee', fontWeight: 600, outline: 'none' };
const removeBtnS = { background: 'none', border: 'none', color: '#ff4444', fontWeight: 800, fontSize: '12px', cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' };
const addBtnS = { width: '100%', padding: '15px', borderRadius: '15px', border: '2px dashed #ccc', background: 'none', fontWeight: 800, cursor: 'pointer', marginBottom: '30px' };
const submitBtnS = { width: '100%', padding: '20px', background: '#000', color: '#fff', borderRadius: '20px', fontWeight: 950, border: 'none', cursor: 'pointer' };
