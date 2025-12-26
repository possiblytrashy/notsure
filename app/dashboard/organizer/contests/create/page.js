"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Layers, Plus, Trash2, Upload, ChevronDown, 
  ChevronUp, Sparkles, Trophy, Loader2, ArrowLeft,
  ShieldCheck, Info, Monitor
} from 'lucide-react';

export default function NestedCompetitionCreator() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // 1. STATE: Parent Competition + Nested Contests
  const [compData, setCompData] = useState({ title: '', description: '' });
  const [contests, setContests] = useState([
    { 
      title: '', 
      vote_price: 1.0, 
      isOpen: true,
      candidates: [{ name: '', category: '', file: null, preview: null }] 
    }
  ]);

  useEffect(() => {
    async function getAuth() {
      const { data: { user: activeUser }, error } = await supabase.auth.getUser();
      if (error || !activeUser) {
        router.push('/login');
      } else {
        setUser(activeUser);
      }
    }
    getAuth();
  }, [router]);

  // 2. LOGIC HANDLERS
  const addContest = () => setContests([...contests, { 
    title: '', vote_price: 1.0, isOpen: true, candidates: [{ name: '', category: '', file: null, preview: null }] 
  }]);

  const addCandidate = (cIdx) => {
    const newContests = [...contests];
    newContests[cIdx].candidates.push({ name: '', category: '', file: null, preview: null });
    setContests(newContests);
  };

  const updateCandidate = (cIdx, candIdx, field, value) => {
    const newContests = [...contests];
    newContests[cIdx].candidates[candIdx][field] = value;
    setContests(newContests);
  };

  const handleSaveAll = async () => {
    if (!user) return alert("Session not found.");
    if (!compData.title) return alert("Grand Competition Title is required.");
    
    setLoading(true);
    try {
      // STEP 1: Create Grand Competition
      const { data: grandComp, error: compErr } = await supabase
        .from('competitions')
        .insert([{ 
            title: compData.title, 
            description: compData.description, 
            organizer_id: user.id 
        }])
        .select().single();
      if (compErr) throw compErr;

      // STEP 2: Loop through Contests
      for (const ct of contests) {
        if (!ct.title) continue;

        const { data: insertedContest, error: ctErr } = await supabase
          .from('contests')
          .insert([{ 
            title: ct.title, 
            vote_price: parseFloat(ct.vote_price), 
            competition_id: grandComp.id, 
            organizer_id: user.id 
          }])
          .select().single();
        if (ctErr) throw ctErr;

        // STEP 3: Loop through Candidates per Contest
        for (const cand of ct.candidates) {
          if (!cand.name) continue;

          let url = '';
          if (cand.file) {
            const path = `${user.id}/nested/${Date.now()}-${cand.name.replace(/\s+/g, '_')}`;
            const { error: uploadError } = await supabase.storage.from('event-images').upload(path, cand.file);
            if (!uploadError) {
                url = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
            }
          }

          const { error: candErr } = await supabase.from('candidates').insert([{
            contest_id: insertedContest.id,
            name: cand.name,
            category: cand.category,
            image_url: url,
            vote_count: 0
          }]);
          if (candErr) throw candErr;
        }
      }
      router.push('/dashboard/organizer');
    } catch (err) {
      console.error(err);
      alert(`Save Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <header style={header}>
        <button onClick={() => router.back()} style={backBtn}><ArrowLeft size={16}/> BACK TO DASHBOARD</button>
        <div style={badgeLuxury}>NESTED ARCHITECTURE</div>
        <h1 style={mainTitle}>Grand Competition Builder</h1>
        <p style={subTitle}>Structure your ceremony by nesting multiple categories and contestants.</p>
      </header>

      {/* PARENT DETAILS */}
      <div style={grandCard}>
        <div style={cardInfoSide}>
            <Trophy size={40} color="#d4af37" style={{marginBottom: '20px'}}/>
            <label style={label}>GRAND COMPETITION TITLE</label>
            <input 
              style={luxuryInput} 
              placeholder="e.g. Ousted Excellence Awards 2025" 
              onChange={e => setCompData({...compData, title: e.target.value})}
            />
            <p style={hintText}>This acts as the main landing page for all categories.</p>
        </div>
      </div>

      {/* NESTED CONTESTS LIST */}
      <div style={nestedSection}>
        <div style={sectionHeader}>
            <h2 style={sectionTitle}><Layers size={20}/> Competition Categories</h2>
            <div style={splitBadge}>95/5 SPLIT ACTIVE</div>
        </div>

        {contests.map((ct, cIdx) => (
          <div key={cIdx} style={contestWrapper}>
            <div style={contestHead} onClick={() => {
              const n = [...contests]; n[cIdx].isOpen = !n[cIdx].isOpen; setContests(n);
            }}>
              <div style={flexRow}>
                <div style={idxCircle}>{cIdx + 1}</div>
                <input 
                  placeholder="Category Name (e.g. Best Female Vocalist)" 
                  style={ghostInput}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {const n = [...contests]; n[cIdx].title = e.target.value; setContests(n);}}
                />
              </div>
              <div style={headActions}>
                <span style={priceTag}>GHS {ct.vote_price}</span>
                {ct.isOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
              </div>
            </div>

            {ct.isOpen && (
              <div style={contestBody}>
                <div style={priceRow}>
                  <label style={label}>VOTE PRICE (GHS)</label>
                  <input 
                    type="number" 
                    style={smallInput} 
                    value={ct.vote_price}
                    onChange={e => {const n = [...contests]; n[cIdx].vote_price = e.target.value; setContests(n);}}
                  />
                </div>

                <div style={candList}>
                  <label style={label}>CONTESTANTS</label>
                  {ct.candidates.map((cand, candIdx) => (
                    <div key={candIdx} style={candRow}>
                      <div style={miniUpload}>
                        <input 
                          type="file" 
                          id={`f-${cIdx}-${candIdx}`} 
                          style={{display:'none'}} 
                          onChange={e => {
                            const file = e.target.files[0];
                            if(file){
                                updateCandidate(cIdx, candIdx, 'file', file);
                                updateCandidate(cIdx, candIdx, 'preview', URL.createObjectURL(file));
                            }
                          }}
                        />
                        <label htmlFor={`f-${cIdx}-${candIdx}`} style={uploadCircle}>
                          {cand.preview ? <img src={cand.preview} style={imgFill} alt="preview"/> : <Upload size={14} color="#94a3b8"/>}
                        </label>
                      </div>
                      <div style={{flex: 1, display: 'flex', gap: '10px'}}>
                        <input 
                            placeholder="Full Name" 
                            style={candInput}
                            onChange={e => updateCandidate(cIdx, candIdx, 'name', e.target.value)}
                        />
                        <input 
                            placeholder="Category Detail" 
                            style={candInput}
                            onChange={e => updateCandidate(cIdx, candIdx, 'category', e.target.value)}
                        />
                      </div>
                      <button style={delBtn} onClick={() => {
                        const n = [...contests]; n[cIdx].candidates.splice(candIdx, 1); setContests(n);
                      }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <button style={addCandBtn} onClick={() => addCandidate(cIdx)}>
                    <Plus size={14}/> ADD ANOTHER CONTESTANT
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button style={addContestBtn} onClick={addContest}>
        <Plus size={18}/> ADD NEW VOTING CATEGORY
      </button>

      <footer style={footer}>
        <div style={disclaimer}>
            <ShieldCheck size={18} color="#16a34a"/>
            <p>Automated Paystack Split: Organizer (95%) | Platform (5%)</p>
        </div>
        <button style={submitBtn(loading)} onClick={handleSaveAll} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={24}/> : <><Sparkles size={20}/> PUBLISH FULL COMPETITION</>}
        </button>
      </footer>
    </div>
  );
}

// --- ALL STYLES DEFINED TO PREVENT REFERENCE ERRORS ---
const container = { maxWidth: '900px', margin: '0 auto', padding: '60px 20px', fontFamily: 'Inter, sans-serif' };
const header = { marginBottom: '50px', textAlign: 'center' };
const backBtn = { background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: '11px', cursor: 'pointer', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px' };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '10px', padding: '6px 15px', borderRadius: '30px', fontWeight: 900, letterSpacing: '1px', width: 'fit-content', margin: '0 auto 20px' };
const mainTitle = { fontSize: '42px', fontWeight: 950, letterSpacing: '-2px', margin: 0 };
const subTitle = { color: '#64748b', fontSize: '16px', marginTop: '10px', fontWeight: 500 };

const grandCard = { background: '#000', padding: '50px', borderRadius: '40px', color: '#fff', marginBottom: '60px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' };
const cardInfoSide = { display: 'flex', flexDirection: 'column', alignItems: 'center' };
const luxuryInput = { width: '100%', padding: '20px', borderRadius: '20px', border: '1px solid #333', background: '#111', color: '#fff', fontSize: '18px', fontWeight: 700, outline: 'none', textAlign: 'center' };
const label = { fontSize: '11px', fontWeight: 900, letterSpacing: '1.5px', color: '#94a3b8', display: 'block', marginBottom: '12px', textTransform: 'uppercase' };
const hintText = { fontSize: '12px', color: '#4b5563', marginTop: '15px', fontWeight: 600 };

const nestedSection = { display: 'flex', flexDirection: 'column', gap: '25px' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' };
const sectionTitle = { fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px' };
const splitBadge = { background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: 900, padding: '6px 12px', borderRadius: '10px' };

const contestWrapper = { background: '#fff', borderRadius: '30px', border: '1px solid #eee', overflow: 'hidden', transition: '0.3s' };
const contestHead = { padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff' };
const flexRow = { display: 'flex', alignItems: 'center', gap: '20px', flex: 1 };
const idxCircle = { width: '32px', height: '32px', borderRadius: '10px', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900 };
const ghostInput = { background: 'none', border: 'none', fontSize: '20px', fontWeight: 900, outline: 'none', width: '80%', color: '#000' };
const headActions = { display: 'flex', alignItems: 'center', gap: '20px' };
const priceTag = { background: '#f8fafc', padding: '8px 15px', borderRadius: '12px', fontSize: '13px', fontWeight: 800, color: '#0ea5e9' };

const contestBody = { padding: '0 30px 30px', borderTop: '1px solid #f9f9f9' };
const priceRow = { margin: '25px 0', width: '180px' };
const smallInput = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #eee', fontWeight: 800, fontSize: '14px', background: '#fafafa' };

const candList = { display: 'flex', flexDirection: 'column', gap: '15px' };
const candRow = { display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '15px', borderRadius: '20px', border: '1px solid #f0f0f0' };
const miniUpload = { position: 'relative' };
const uploadCircle = { width: '50px', height: '50px', borderRadius: '15px', border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: '#f8fafc' };
const imgFill = { width: '100%', height: '100%', objectFit: 'cover' };
const candInput = { flex: 1, background: '#f8fafc', border: '1px solid #eee', outline: 'none', fontWeight: 600, fontSize: '14px', padding: '12px', borderRadius: '12px' };
const delBtn = { color: '#ef4444', background: '#fee2e2', border: 'none', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const addCandBtn = { padding: '15px', background: 'none', border: '2px dashed #f0f0f0', borderRadius: '15px', fontSize: '12px', fontWeight: 800, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };
const addContestBtn = { width: '100%', padding: '25px', borderRadius: '25px', border: '2px dashed #ddd', background: '#fff', color: '#000', fontWeight: 850, marginTop: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' };

const footer = { marginTop: '60px', textAlign: 'center' };
const disclaimer = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#166534', fontSize: '12px', fontWeight: 600, marginBottom: '20px', background: '#f0fdf4', padding: '12px', borderRadius: '15px' };
const submitBtn = (l) => ({ width: '100%', padding: '25px', background: l ? '#eee' : '#000', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: 900, fontSize: '18px', cursor: l ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.3s', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' });
