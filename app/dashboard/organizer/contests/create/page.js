"use client";
import { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { Trash2, Plus, Upload, X, UserPlus, Layers } from 'lucide-react';

export default function AdvancedContestCreator() {
  const [contestData, setContestData] = useState({ title: '', price: 1, description: '' });
  const [candidates, setCandidates] = useState([
    { name: '', category: '', description: '', file: null, preview: null }
  ]);
  const [uploading, setUploading] = useState(false);

  // Add / Remove Contestants
  const addCandidate = () => setCandidates([...candidates, { name: '', category: '', description: '', file: null, preview: null }]);
  const removeCandidate = (index) => setCandidates(candidates.filter((_, i) => i !== index));

  // Handle Image Selection per Candidate
  const handleImgChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const newCands = [...candidates];
      newCands[index].file = file;
      newCands[index].preview = URL.createObjectURL(file);
      setCandidates(newCands);
    }
  };

  const handleSave = async () => {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Create the Contest Header
    const { data: contest } = await supabase.from('contests').insert([
      { ...contestData, organizer_id: user.id }
    ]).select().single();

    // 2. Upload Candidate Images & Save Data
    for (const cand of candidates) {
      let publicUrl = '';
      if (cand.file) {
        const path = `${user.id}/contestants/${Date.now()}-${cand.name}`;
        await supabase.storage.from('event-images').upload(path, cand.file);
        publicUrl = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
      }

      await supabase.from('candidates').insert([{
        contest_id: contest.id,
        name: cand.name,
        category: cand.category,
        description: cand.description,
        image_url: publicUrl
      }]);
    }

    window.location.href = '/dashboard/organizer';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '120px 20px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontWeight: 900, fontSize: '32px', marginBottom: '30px' }}>Create Contest</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '40px' }}>
          <input placeholder="Contest Title (e.g. Ousted Awards 2025)" style={inputS} onChange={e => setContestData({...contestData, title: e.target.value})} />
          <input type="number" placeholder="Price per Vote (GHS)" style={inputS} onChange={e => setContestData({...contestData, price: e.target.value})} />
        </div>

        <h3 style={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' }}><UserPlus size={20}/> Contestants & Categories</h3>
        
        {candidates.map((cand, i) => (
          <div key={i} style={candidateBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span style={tagStyle}>CONTESTANT #{i + 1}</span>
              <button onClick={() => removeCandidate(i)} style={deleteBtn}><X size={16}/></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '20px' }}>
              {/* Image Upload Area */}
              <div style={uploadCircle}>
                <input type="file" id={`file-${i}`} style={{ display: 'none' }} onChange={(e) => handleImgChange(i, e)} />
                <label htmlFor={`file-${i}`} style={{ cursor: 'pointer' }}>
                  {cand.preview ? <img src={cand.preview} style={imgPrev} /> : <Upload size={20} color="#888" />}
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Contestant Name" style={inputS} onChange={e => {
                  const n = [...candidates]; n[i].name = e.target.value; setCandidates(n);
                }} />
                <input placeholder="Category (e.g. Best DJ)" style={inputS} onChange={e => {
                  const n = [...candidates]; n[i].category = e.target.value; setCandidates(n);
                }} />
              </div>

              <textarea placeholder="Contestant Bio/Description" style={{ ...inputS, height: '100px' }} onChange={e => {
                const n = [...candidates]; n[i].description = e.target.value; setCandidates(n);
              }} />
            </div>
          </div>
        ))}

        <button onClick={addCandidate} style={addBtn}>+ ADD ANOTHER CONTESTANT</button>
        
        <button onClick={handleSave} disabled={uploading} style={submitBtn}>
          {uploading ? 'LAUNCHING CONTEST...' : 'PUBLISH CONTEST'}
        </button>
      </div>
    </div>
  );
}

// STYLES
const inputS = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', fontSize: '15px', outline: 'none' };
const candidateBox = { padding: '25px', borderRadius: '25px', border: '1px solid #f0f0f0', marginBottom: '20px', background: '#fafafa' };
const uploadCircle = { width: '120px', height: '120px', borderRadius: '20px', border: '2px dashed #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff' };
const imgPrev = { width: '100%', height: '100%', objectFit: 'cover' };
const tagStyle = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '20px', fontWeight: 800 };
const deleteBtn = { background: '#fee2e2', color: '#ef4444', border: 'none', padding: '5px', borderRadius: '8px', cursor: 'pointer' };
const addBtn = { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #eee', background: 'none', fontWeight: 800, cursor: 'pointer', marginBottom: '30px' };
const submitBtn = { width: '100%', padding: '20px', background: '#000', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 900, cursor: 'pointer' };
