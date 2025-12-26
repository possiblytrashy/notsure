"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Trash2, Plus, Upload, X, UserPlus, 
  Layers, Trophy, ArrowLeft, Loader2, 
  Sparkles, ShieldCheck, Info 
} from 'lucide-react';

export default function AdvancedContestCreator() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // 1. STATE MANAGEMENT
  const [contestData, setContestData] = useState({ 
    title: '', 
    vote_price: 1.00, // Explicitly named for Supabase schema
    description: '' 
  });
  
  const [candidates, setCandidates] = useState([
    { name: '', category: '', description: '', file: null, preview: null }
  ]);

  // 2. AUTH CHECK ON LOAD
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    }
    checkUser();
  }, [router]);

  // 3. HANDLERS
  const addCandidate = () => setCandidates([...candidates, { name: '', category: '', description: '', file: null, preview: null }]);
  
  const removeCandidate = (index) => {
    if (candidates.length > 1) {
      setCandidates(candidates.filter((_, i) => i !== index));
    }
  };

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
    if (!user) return alert("Session expired. Please login again.");
    if (!contestData.title) return alert("Please enter a contest title.");

    setUploading(true);
    try {
      // STEP A: Insert Contest Header
      const { data: contest, error: contestError } = await supabase
        .from('contests')
        .insert([{ 
          title: contestData.title,
          description: contestData.description,
          vote_price: parseFloat(contestData.vote_price),
          organizer_id: user.id 
        }])
        .select()
        .single();

      if (contestError) throw contestError;

      // STEP B: Loop through Candidates
      for (const cand of candidates) {
        if (!cand.name) continue; // Skip empty candidate rows

        let publicUrl = '';
        if (cand.file) {
          const fileExt = cand.file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const path = `${user.id}/contestants/${Date.now()}-${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('event-images')
            .upload(path, cand.file);

          if (uploadError) console.error("Upload error:", uploadError);
          else {
            publicUrl = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
          }
        }

        const { error: candError } = await supabase.from('candidates').insert([{
          contest_id: contest.id,
          name: cand.name,
          category: cand.category,
          description: cand.description,
          image_url: publicUrl,
          vote_count: 0
        }]);

        if (candError) throw candError;
      }

      router.push('/dashboard/organizer');
    } catch (err) {
      console.error("Critical Error:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={container}>
      {/* HEADER ACTIONS */}
      <div style={topBar}>
        <button onClick={() => router.back()} style={backBtn}>
          <ArrowLeft size={18}/> BACK
        </button>
        <div style={badgeLuxury}>LUXURY ENGINE</div>
      </div>

      <div style={mainCard}>
        <header style={headerSection}>
          <div style={iconCircle}><Trophy size={32} color="#d4af37"/></div>
          <h1 style={mainTitle}>New Contest</h1>
          <p style={subTitle}>Structure your categories and assign contestants.</p>
        </header>

        {/* CONTEST CORE INFO */}
        <section style={formSection}>
          <div style={inputRow}>
            <div style={inputGroup}>
              <label style={labelStyle}>CONTEST TITLE</label>
              <input 
                placeholder="e.g. Best Dressed Male" 
                style={luxuryInput} 
                onChange={e => setContestData({...contestData, title: e.target.value})} 
              />
            </div>
            <div style={inputGroup}>
              <label style={labelStyle}>VOTE PRICE (GHS)</label>
              <input 
                type="number" 
                placeholder="1.00" 
                style={luxuryInput} 
                onChange={e => setContestData({...contestData, vote_price: e.target.value})} 
              />
            </div>
          </div>
          <div style={inputGroup}>
            <label style={labelStyle}>GLOBAL DESCRIPTION</label>
            <textarea 
              placeholder="Contest rules or details..." 
              style={{...luxuryInput, minHeight: '80px', resize: 'none'}} 
              onChange={e => setContestData({...contestData, description: e.target.value})} 
            />
          </div>
        </section>

        <div style={divider}></div>

        {/* CANDIDATES LIST */}
        <section>
          <div style={sectionHeader}>
            <h3 style={sectionTitle}><UserPlus size={18}/> Contestants</h3>
            <span style={countTag}>{candidates.length} slots</span>
          </div>
          
          {candidates.map((cand, i) => (
            <div key={i} style={candidateCard}>
              <div style={cardTop}>
                <span style={candNum}>CONTESTANT #{String(i + 1).padStart(2, '0')}</span>
                <button onClick={() => removeCandidate(i)} style={deleteBtn}><X size={16}/></button>
              </div>

              <div style={candGrid}>
                {/* IMAGE UPLOAD */}
                <div style={uploadZone}>
                  <input type="file" id={`file-${i}`} style={{ display: 'none' }} onChange={(e) => handleImgChange(i, e)} />
                  <label htmlFor={`file-${i}`} style={uploadLabel}>
                    {cand.preview ? (
                      <img src={cand.preview} style={previewImg} />
                    ) : (
                      <div style={uploadPlaceholder}>
                        <Upload size={20} color="#94a3b8" />
                        <span>PHOTO</span>
                      </div>
                    )}
                  </label>
                </div>

                <div style={candInputs}>
                  <input 
                    placeholder="Full Name" 
                    style={luxuryInput} 
                    onChange={e => {
                      const n = [...candidates]; n[i].name = e.target.value; setCandidates(n);
                    }} 
                  />
                  <input 
                    placeholder="Category (e.g. Best DJ)" 
                    style={luxuryInput} 
                    onChange={e => {
                      const n = [...candidates]; n[i].category = e.target.value; setCandidates(n);
                    }} 
                  />
                  <textarea 
                    placeholder="Bio..." 
                    style={{...luxuryInput, height: '100%'}} 
                    onChange={e => {
                      const n = [...candidates]; n[i].description = e.target.value; setCandidates(n);
                    }} 
                  />
                </div>
              </div>
            </div>
          ))}

          <button onClick={addCandidate} style={addBtn}>
            <Plus size={18}/> ADD ANOTHER SLOT
          </button>
        </section>

        {/* FOOTER ACTION */}
        <div style={footerSection}>
          <div style={payoutNote}>
            <ShieldCheck size={18} color="#16a34a"/>
            <p>5% Platform fee applies. 95% is routed to your subaccount.</p>
          </div>
          <button onClick={handleSave} disabled={uploading} style={submitBtn(uploading)}>
            {uploading ? <Loader2 className="animate-spin"/> : <><Sparkles size={18}/> PUBLISH CONTEST</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- LUXURY STYLING SYSTEM ---
const container = { maxWidth: '1000px', margin: '0 auto', padding: '60px 20px', fontFamily: 'Inter, sans-serif', background: '#fcfcfc', minHeight: '100vh' };
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const backBtn = { background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '10px', padding: '6px 15px', borderRadius: '30px', fontWeight: 900, letterSpacing: '1px' };
const mainCard = { background: '#fff', padding: '50px', borderRadius: '40px', border: '1px solid #f0f0f0', boxShadow: '0 30px 60px rgba(0,0,0,0.03)' };
const headerSection = { textAlign: 'center', marginBottom: '50px' };
const iconCircle = { width: '80px', height: '80px', background: '#000', borderRadius: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 15px 30px rgba(0,0,0,0.2)' };
const mainTitle = { fontSize: '32px', fontWeight: 950, margin: '0 0 10px', letterSpacing: '-1.5px' };
const subTitle = { fontSize: '15px', color: '#94a3b8', fontWeight: 500 };
const formSection = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputRow = { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '10px' };
const labelStyle = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const luxuryInput = { width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #eee', background: '#fafafa', fontSize: '14px', fontWeight: 600, outline: 'none', transition: '0.3s' };
const divider = { height: '1px', background: '#eee', margin: '40px 0' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const sectionTitle = { fontSize: '18px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px' };
const countTag = { fontSize: '12px', fontWeight: 700, color: '#94a3b8', background: '#f5f5f5', padding: '4px 12px', borderRadius: '10px' };
const candidateCard = { padding: '30px', borderRadius: '30px', border: '1px solid #f0f0f0', background: '#fff', marginBottom: '25px', transition: '0.3s' };
const cardTop = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' };
const candNum = { fontSize: '11px', fontWeight: 900, color: '#000', background: '#f0f0f0', padding: '5px 12px', borderRadius: '8px' };
const deleteBtn = { background: '#fff1f2', color: '#e11d48', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' };
const candGrid = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '25px' };
const uploadZone = { position: 'relative' };
const uploadLabel = { cursor: 'pointer', width: '140px', height: '180px', borderRadius: '20px', border: '2px dashed #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', overflow: 'hidden' };
const uploadPlaceholder = { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', fontSize: '10px', fontWeight: 900, color: '#94a3b8' };
const previewImg = { width: '100%', height: '100%', objectFit: 'cover' };
const candInputs = { display: 'flex', flexDirection: 'column', gap: '12px' };
const addBtn = { width: '100%', padding: '18px', borderRadius: '18px', border: '2px dashed #eee', background: 'none', fontWeight: 800, cursor: 'pointer', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#94a3b8' };
const footerSection = { borderTop: '1px solid #eee', paddingTop: '40px', display: 'flex', flexDirection: 'column', gap: '20px' };
const payoutNote = { background: '#f0fdf4', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', fontWeight: 600, color: '#166534' };
const submitBtn = (up) => ({ width: '100%', padding: '22px', background: up ? '#eee' : '#000', color: '#fff', border: 'none', borderRadius: '22px', fontWeight: 900, fontSize: '16px', cursor: up ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.4s' });
