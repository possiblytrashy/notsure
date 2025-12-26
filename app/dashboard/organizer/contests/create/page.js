"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Layers, Plus, Trash2, Upload, ChevronDown, 
  ChevronUp, Sparkles, Trophy, Loader2, ArrowLeft 
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setUser(user);
    }
    getAuth();
  }, [router]);

  // 2. NESTED LOGIC HANDLERS
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
    if (!user) return;
    setLoading(true);
    try {
      // STEP 1: Create Grand Competition
      const { data: grandComp, error: compErr } = await supabase
        .from('competitions')
        .insert([{ ...compData, organizer_id: user.id }])
        .select().single();
      if (compErr) throw compErr;

      // STEP 2: Loop through Contests
      for (const ct of contests) {
        const { data: insertedContest, error: ctErr } = await supabase
          .from('contests')
          .insert([{ 
            title: ct.title, 
            vote_price: ct.vote_price, 
            competition_id: grandComp.id, // THE NESTING LINK
            organizer_id: user.id 
          }])
          .select().single();
        if (ctErr) throw ctErr;

        // STEP 3: Loop through Candidates per Contest
        for (const cand of ct.candidates) {
          let url = '';
          if (cand.file) {
            const path = `${user.id}/nested/${Date.now()}-${cand.name}`;
            await supabase.storage.from('event-images').upload(path, cand.file);
            url = supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
          }

          await supabase.from('candidates').insert([{
            contest_id: insertedContest.id,
            name: cand.name,
            image_url: url,
            vote_count: 0
          }]);
        }
      }
      router.push('/dashboard/organizer');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <header style={header}>
        <button onClick={() => router.back()} style={backBtn}><ArrowLeft size={16}/> BACK</button>
        <h1 style={mainTitle}>Grand Competition Builder</h1>
        <p style={subTitle}>Create one event, nest multiple voting categories inside.</p>
      </header>

      {/* PARENT DETAILS */}
      <div style={grandCard}>
        <label style={label}>GRAND COMPETITION TITLE</label>
        <input 
          style={luxuryInput} 
          placeholder="e.g. West Africa Excellence Awards 2026" 
          onChange={e => setCompData({...compData, title: e.target.value})}
        />
      </div>

      {/* NESTED CONTESTS LIST */}
      <div style={nestedSection}>
        {contests.map((ct, cIdx) => (
          <div key={cIdx} style={contestWrapper}>
            <div style={contestHead} onClick={() => {
              const n = [...contests]; n[cIdx].isOpen = !n[cIdx].isOpen; setContests(n);
            }}>
              <div style={flexRow}>
                <Trophy size={18} color="#d4af37"/>
                <input 
                  placeholder="Category Name (e.g. Best Female Vocalist)" 
                  style={ghostInput}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {const n = [...contests]; n[cIdx].title = e.target.value; setContests(n);}}
                />
              </div>
              {ct.isOpen ? <ChevronUp/> : <ChevronDown/>}
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
                  {ct.candidates.map((cand, candIdx) => (
                    <div key={candIdx} style={candRow}>
                      <div style={miniUpload}>
                        <input 
                          type="file" 
                          id={`f-${cIdx}-${candIdx}`} 
                          style={{display:'none'}} 
                          onChange={e => {
                            const file = e.target.files[0];
                            updateCandidate(cIdx, candIdx, 'file', file);
                            updateCandidate(cIdx, candIdx, 'preview', URL.createObjectURL(file));
                          }}
                        />
                        <label htmlFor={`f-${cIdx}-${candIdx}`} style={uploadCircle}>
                          {cand.preview ? <img src={cand.preview} style={imgFill}/> : <Plus size={14}/>}
                        </label>
                      </div>
                      <input 
                        placeholder="Candidate Name" 
                        style={candInput}
                        onChange={e => updateCandidate(cIdx, candIdx, 'name', e.target.value)}
                      />
                      <button style={delBtn} onClick={() => {
                        const n = [...contests]; n[cIdx].candidates.splice(candIdx, 1); setContests(n);
                      }}><Trash2 size={14}/></button>
                    </div>
                  ))}
                  <button style={addCandBtn} onClick={() => addCandidate(cIdx)}>+ ADD CANDIDATE</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button style={addContestBtn} onClick={addContest}>+ ADD NEW CATEGORY</button>

      <footer style={footer}>
        <button style={submitBtn(loading)} onClick={handleSaveAll} disabled={loading}>
          {loading ? <Loader2 className="animate-spin"/> : <><Sparkles size={18}/> PUBLISH COMPETITION</>}
        </button>
      </footer>
    </div>
  );
}

// STYLES (Luxury Theme)
const container = { maxWidth: '800px', margin: '0 auto', padding: '80px 20px' };
const header = { marginBottom: '40px' };
const backBtn = { background: 'none', border: 'none', color: '#94a3b8', fontWeight: 800, fontSize: '11px', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '5px' };
const mainTitle = { fontSize: '32px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const subTitle = { color: '#94a3b8', fontSize: '14px', marginTop: '5px' };
const grandCard = { background: '#000', padding: '40px', borderRadius: '30px', color: '#fff', marginBottom: '40px' };
const label = { fontSize: '10px', fontWeight: 900, letterSpacing: '1px', color: '#94a3b8', display: 'block', marginBottom: '10px' };
const luxuryInput = { width: '100%', padding: '18px', borderRadius: '15px', border: 'none', background: '#1a1a1a', color: '#fff', fontSize: '16px', fontWeight: 700, outline: 'none' };
const nestedSection = { display: 'flex', flexDirection: 'column', gap: '20px' };
const contestWrapper = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const contestHead = { padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fafafa' };
const flexRow = { display: 'flex', alignItems: 'center', gap: '15px', flex: 1 };
const ghostInput = { background: 'none', border: 'none', fontSize: '18px', fontWeight: 850, outline: 'none', width: '80%' };
const contestBody = { padding: '25px', borderTop: '1px solid #f0f0f0' };
const priceRow = { marginBottom: '25px', width: '150px' };
const smallInput = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #eee', fontWeight: 800 };
const candList = { display: 'flex', flexDirection: 'column', gap: '12px' };
const candRow = { display: 'flex', alignItems: 'center', gap: '15px', background: '#fcfcfc', padding: '10px', borderRadius: '15px', border: '1px solid #f5f5f5' };
const uploadCircle = { width: '45px', height: '45px', borderRadius: '12px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' };
const imgFill = { width: '100%', height: '100%', objectFit: 'cover' };
const candInput = { flex: 1, background: 'none', border: 'none', outline: 'none', fontWeight: 600, fontSize: '14px' };
const delBtn = { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' };
const addCandBtn = { padding: '10px', background: 'none', border: '1px dashed #eee', borderRadius: '10px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', cursor: 'pointer' };
const addContestBtn = { width: '100%', padding: '20px', borderRadius: '20px', border: '2px dashed #eee', background: 'none', color: '#94a3b8', fontWeight: 800, marginTop: '20px', cursor: 'pointer' };
const footer = { marginTop: '50px' };
const submitBtn = (l) => ({ width: '100%', padding: '25px', background: l ? '#eee' : '#000', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 900, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' });
