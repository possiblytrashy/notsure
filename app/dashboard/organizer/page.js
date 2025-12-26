"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Trophy, Wallet, RefreshCcw, 
  MapPin, Zap, Trash2, Edit3, X, UserPlus, 
  Save, Activity, Loader2, LogOut, Search,
  ArrowUpRight, BarChart3, Star, Layers, Settings,
  ChevronRight, Info, AlertCircle, CheckCircle2,
  ImageIcon, MoreVertical, ExternalLink, Calendar,
  CreditCard, Layout, Users, Mail, QrCode, TrendingUp,
  Upload, Camera, Image as LucideImage, Filter, ChevronDown
} from 'lucide-react';

/**
 * ORGANIZER DASHBOARD - PLATINUM EDITION
 * Features:
 * - Full Analytics with 5% Paystack Split logic
 * - Hierarchical Competition Management (Comp > Category > Candidate)
 * - Direct Supabase Storage Image Uploads
 * - Skeleton Loading States
 * - Luxury Dark/Light UI
 */

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE DATA STATE ---
  const [activeTab, setActiveTab] = useState('events'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. MODAL & UI STATE ---
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showAddContestModal, setShowAddContestModal] = useState(null); // Stores Comp ID
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(null); // Stores Contest ID
  const [editingItem, setEditingItem] = useState(null); // { type: 'comp'|'contest'|'cand', data: {} }
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- 3. FORM STATES ---
  const [compForm, setCompForm] = useState({ title: '', description: '' });
  const [contestForm, setContestForm] = useState({ title: '', vote_price: 1.00 });
  const [candidateForm, setCandidateForm] = useState({ name: '', image_url: '' });

  // --- 4. DATA ENGINE (FULL SYNC) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Parallel Fetch for Luxury Speed
      const [profileRes, eventsRes, compsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select(`
            *,
            contests (
              *,
              candidates (*)
            )
        `).eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false }),
      ]);

      // Filter tickets logic for your organizer ID
      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });
    } catch (err) {
      console.error("Critical Dashboard Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // --- 5. IMAGE UPLOAD ENGINE ---
  const handleFileUpload = async (event, mode = 'create') => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `contestants/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images') // Ensure this bucket exists in Supabase
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (mode === 'edit') {
        setEditingItem({
          ...editingItem,
          data: { ...editingItem.data, image_url: publicUrl }
        });
      } else {
        setCandidateForm({ ...candidateForm, image_url: publicUrl });
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // --- 6. CRUD HANDLERS ---
  const handleCreateComp = async () => {
    if (!compForm.title) return;
    setIsProcessing(true);
    const { error } = await supabase.from('competitions').insert([{ ...compForm, organizer_id: data.profile.id }]);
    if (!error) { setShowAddCompModal(false); setCompForm({ title: '', description: '' }); loadDashboardData(true); }
    setIsProcessing(false);
  };

  const handleCreateContest = async () => {
    if (!contestForm.title) return;
    setIsProcessing(true);
    const { error } = await supabase.from('contests').insert([{ ...contestForm, competition_id: showAddContestModal }]);
    if (!error) { setShowAddContestModal(null); setContestForm({ title: '', vote_price: 1.00 }); loadDashboardData(true); }
    setIsProcessing(false);
  };

  const handleCreateCandidate = async () => {
    if (!candidateForm.name) return;
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([{ ...candidateForm, contest_id: showAddCandidateModal, vote_count: 0 }]);
    if (!error) { setShowAddCandidateModal(null); setCandidateForm({ name: '', image_url: '' }); loadDashboardData(true); }
    setIsProcessing(false);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    setIsProcessing(true);
    const table = editingItem.type === 'comp' ? 'competitions' : editingItem.type === 'contest' ? 'contests' : 'candidates';
    
    // De-structure to prevent sending relation objects back to Supabase
    const { contests, candidates, ...payload } = editingItem.data;
    
    const { error } = await supabase.from(table).update(payload).eq('id', payload.id);
    if (!error) { setEditingItem(null); loadDashboardData(true); }
    setIsProcessing(false);
  };

  const handleDelete = async (type, id) => {
    if (!confirm(`Permanently delete this ${type}?`)) return;
    const table = type === 'comp' ? 'competitions' : type === 'contest' ? 'contests' : 'candidates';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) loadDashboardData(true);
    else alert("Delete failed. Check for existing sub-items.");
  };

  // --- 7. ANALYTICS ENGINE (5% REVENUE SPLIT) ---
  const analytics = useMemo(() => {
    const ticketRev = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    let voteRev = 0;
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const totalVotes = ct.candidates?.reduce((sum, cand) => sum + (cand.vote_count || 0), 0) || 0;
        voteRev += (totalVotes * (ct.vote_price || 0));
      });
    });

    const gross = ticketRev + voteRev;
    const net = gross * 0.95; // Paystack / Platform Split
    const fees = gross * 0.05;

    return { gross, net, fees, ticketRev, voteRev, count: data.tickets.length };
  }, [data]);

  // --- 8. UI COMPONENTS (SKELETON) ---
  const Skeleton = () => (
    <div style={skeletonContainer}>
      <div style={skeletonSidebar}></div>
      <div style={skeletonMain}>
        <div style={skeletonHero}></div>
        <div style={skeletonGrid}>
          <div style={skeletonCard}></div>
          <div style={skeletonCard}></div>
          <div style={skeletonCard}></div>
        </div>
      </div>
    </div>
  );

  if (loading) return <Skeleton />;

  return (
    <div style={container}>
      {/* SIDEBAR */}
      <aside style={sidebar}>
        <div style={brand}>OUSTED <span style={goldBadge}>PLATINUM</span></div>
        <nav style={sideNav}>
          <button onClick={() => setActiveTab('events')} style={tabBtn(activeTab === 'events')}><Calendar size={18}/> Events</button>
          <button onClick={() => setActiveTab('competitions')} style={tabBtn(activeTab === 'competitions')}><Trophy size={18}/> Competitions</button>
          <button onClick={() => setActiveTab('analytics')} style={tabBtn(activeTab === 'analytics')}><TrendingUp size={18}/> Analytics</button>
          <button onClick={() => setActiveTab('settings')} style={tabBtn(activeTab === 'settings')}><Settings size={18}/> Settings</button>
        </nav>
        <div style={sidebarFooter}>
          <p style={userLabel}>{data.profile?.email}</p>
          <button style={logoutBtn} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            <LogOut size={16}/> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={main}>
        <header style={header}>
          <div>
            <h1 style={viewTitle}>{activeTab.toUpperCase()}</h1>
            <p style={viewSub}>Live monitoring for {data.profile?.full_name || 'Organization'}</p>
          </div>
          <button style={refreshBtn} onClick={() => loadDashboardData(true)}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
          </button>
        </header>

        {/* ANALYTICS SECTION */}
        <section style={heroGrid}>
          <div style={blackCard}>
            <div style={cardTop}>
              <p style={cardLabel}>ESTIMATED NET PAYOUT (95%)</p>
              <Zap size={16} color="#d4af37"/>
            </div>
            <h2 style={revenueLarge}>GHS {analytics.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            <div style={revFlex}>
              <span style={revStat}><Ticket size={14}/> Tickets: {analytics.ticketRev.toFixed(2)}</span>
              <span style={revStat}><Star size={14} color="#d4af37"/> Votes: {analytics.voteRev.toFixed(2)}</span>
            </div>
          </div>
          <div style={whiteCard}>
            <div style={statBox}>
              <p style={cardLabel}>TOTAL VOLUME</p>
              <h3 style={statMid}>{analytics.count} Sold</h3>
            </div>
            <div style={statBox}>
              <p style={cardLabel}>FEES (5%)</p>
              <h3 style={{...statMid, color: '#ef4444'}}>- GHS {analytics.fees.toFixed(2)}</h3>
            </div>
          </div>
        </section>

        {/* TAB RENDERING */}
        <div style={contentArea}>
          {activeTab === 'competitions' && (
            <div style={fadeIn}>
              <div style={sectionHeader}>
                <h2 style={sectionTitle}>Multi-Tier Voting Hierarchy</h2>
                <button style={primaryBtn} onClick={() => setShowAddCompModal(true)}><Plus size={18}/> NEW COMPETITION</button>
              </div>

              <div style={compList}>
                {data.competitions.map(comp => (
                  <div key={comp.id} style={grandCard}>
                    <div style={grandHead}>
                      <div>
                        <h3 style={grandTitleText}>{comp.title}</h3>
                        <p style={grandSubText}>{comp.description}</p>
                      </div>
                      <div style={grandActions}>
                        <button style={luxuryEditBtn} onClick={() => setEditingItem({ type: 'comp', data: comp })}><Edit3 size={16}/> Edit</button>
                        <button style={luxuryAddBtn} onClick={() => setShowAddContestModal(comp.id)}><Layers size={16}/> Category</button>
                        <button style={luxuryDelBtn} onClick={() => handleDelete('comp', comp.id)}><Trash2 size={16}/></button>
                      </div>
                    </div>

                    <div style={contestGrid}>
                      {comp.contests?.map(ct => (
                        <div key={ct.id} style={ctContainer}>
                          <div style={ctHead}>
                            <div>
                              <h4 style={ctTitleText}>{ct.title}</h4>
                              <p style={ctPriceText}>GHS {ct.vote_price} / vote</p>
                            </div>
                            <div style={ctActions}>
                              <button style={ctIconBtn} onClick={() => setEditingItem({ type: 'contest', data: ct })}><Edit3 size={14}/></button>
                              <button style={ctIconBtn} onClick={() => setShowAddCandidateModal(ct.id)}><UserPlus size={14}/></button>
                              <button style={ctIconBtnDel} onClick={() => handleDelete('contest', ct.id)}><X size={14}/></button>
                            </div>
                          </div>

                          <div style={candStack}>
                            {ct.candidates?.map(cand => (
                              <div key={cand.id} style={candRow}>
                                <div style={candInfo}>
                                  <div style={candAvatar(cand.image_url)}></div>
                                  <span style={candNameText}>{cand.name}</span>
                                </div>
                                <div style={candMeta}>
                                  <span style={voteBadge}>{cand.vote_count} votes</span>
                                  <button style={candAction} onClick={() => setEditingItem({ type: 'cand', data: cand })}><Edit3 size={12}/></button>
                                  <button style={candActionDel} onClick={() => handleDelete('cand', cand.id)}><Trash2 size={12}/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div style={fadeIn}>
              <div style={sectionHeader}>
                <h2 style={sectionTitle}>Your Events</h2>
                <button style={primaryBtn} onClick={() => router.push('/dashboard/organizer/create')}><Plus size={18}/> CREATE EVENT</button>
              </div>
              <div style={eventGrid}>
                {data.events.map(ev => (
                  <div key={ev.id} style={eventCard}>
                    <div style={evImg(ev.images?.[0])}></div>
                    <div style={evBody}>
                      <h4 style={evTitleText}>{ev.title}</h4>
                      <p style={evMeta}><MapPin size={14}/> {ev.location}</p>
                      <div style={evFooter}>
                        <button style={evMBtn} onClick={() => router.push(`/events/${ev.id}`)}>VIEW LIVE</button>
                        <button style={evDBtn} onClick={() => handleDelete('event', ev.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL ENGINE --- */}

      {/* 1. ADD CANDIDATE (WITH IMAGE UPLOAD) */}
      {showAddCandidateModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={mHead}>
              <h3 style={mTitle}>Register Contestant</h3>
              <button style={mClose} onClick={() => setShowAddCandidateModal(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <label style={mLabel}>NAME</label>
              <input style={mInput} placeholder="e.g. John Doe" value={candidateForm.name} onChange={e => setCandidateForm({...candidateForm, name: e.target.value})}/>
              
              <label style={mLabel}>PORTRAIT IMAGE</label>
              <div style={uploadZone}>
                {candidateForm.image_url ? (
                  <img src={candidateForm.image_url} style={uploadPreview} alt="Preview" />
                ) : (
                  <div style={uploadEmpty}>
                    <Camera size={24} color="#94a3b8"/>
                    <p>Click to Upload</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'create')} style={fileInput} />
                <div style={uploadStatus}>{uploading ? 'UPLOADING...' : 'CHANGE'}</div>
              </div>

              <button style={mSubmit(isProcessing || uploading)} onClick={handleCreateCandidate}>
                {isProcessing ? 'PROCESSING...' : 'ADD CONTESTANT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. UNIVERSAL EDIT MODAL (WITH IMAGE UPLOAD) */}
      {editingItem && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={mHead}>
              <h3 style={mTitle}>Edit {editingItem.type.toUpperCase()}</h3>
              <button style={mClose} onClick={() => setEditingItem(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <label style={mLabel}>TITLE / NAME</label>
              <input 
                style={mInput} 
                value={editingItem.data.title || editingItem.data.name || ''} 
                onChange={e => {
                  const key = editingItem.type === 'cand' ? 'name' : 'title';
                  setEditingItem({...editingItem, data: {...editingItem.data, [key]: e.target.value}});
                }}
              />

              {editingItem.type === 'cand' && (
                <>
                  <label style={mLabel}>PORTRAIT IMAGE</label>
                  <div style={uploadZone}>
                    <img src={editingItem.data.image_url} style={uploadPreview} alt="Preview" />
                    <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'edit')} style={fileInput} />
                    <div style={uploadStatus}>{uploading ? 'UPLOADING...' : 'REPLACE IMAGE'}</div>
                  </div>
                </>
              )}

              {editingItem.type === 'contest' && (
                <>
                  <label style={mLabel}>VOTE PRICE (GHS)</label>
                  <input style={mInput} type="number" value={editingItem.data.vote_price} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, vote_price: e.target.value}})}/>
                </>
              )}

              <button style={mSubmit(isProcessing || uploading)} onClick={handleUpdate}>
                {isProcessing ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD COMPETITION MODAL */}
      {showAddCompModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={mHead}>
              <h3 style={mTitle}>New Grand Competition</h3>
              <button style={mClose} onClick={() => setShowAddCompModal(false)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <label style={mLabel}>COMPETITION TITLE</label>
              <input style={mInput} placeholder="e.g. Ghana Music Awards" value={compForm.title} onChange={e => setCompForm({...compForm, title: e.target.value})}/>
              <label style={mLabel}>DESCRIPTION</label>
              <textarea style={mInput} rows={3} placeholder="Competition details..." value={compForm.description} onChange={e => setCompForm({...compForm, description: e.target.value})}/>
              <button style={mSubmit(isProcessing)} onClick={handleCreateComp}>CREATE</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ADD CATEGORY MODAL */}
      {showAddContestModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={mHead}>
              <h3 style={mTitle}>Add New Category</h3>
              <button style={mClose} onClick={() => setShowAddContestModal(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <label style={mLabel}>CATEGORY NAME</label>
              <input style={mInput} placeholder="e.g. Best Vocalist" value={contestForm.title} onChange={e => setContestForm({...contestForm, title: e.target.value})}/>
              <label style={mLabel}>VOTE PRICE (GHS)</label>
              <input style={mInput} type="number" step="0.5" value={contestForm.vote_price} onChange={e => setContestForm({...contestForm, vote_price: e.target.value})}/>
              <button style={mSubmit(isProcessing)} onClick={handleCreateContest}>SAVE CATEGORY</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- FULL CSS-IN-JS ENGINE ---

const container = { display: 'flex', minHeight: '100vh', background: '#fcfcfc', color: '#000', fontFamily: 'Inter, sans-serif' };
const sidebar = { width: '280px', background: '#000', color: '#fff', padding: '30px 20px', position: 'fixed', height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100 };
const brand = { fontSize: '20px', fontWeight: 950, letterSpacing: '-1px', marginBottom: '40px' };
const goldBadge = { color: '#d4af37', fontSize: '10px', background: 'rgba(212,175,55,0.1)', padding: '4px 8px', borderRadius: '6px', marginLeft: '5px', verticalAlign: 'middle' };
const sideNav = { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' };
const tabBtn = (a) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '14px', background: a ? 'rgba(255,255,255,0.1)' : 'transparent', color: a ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 700, textAlign: 'left', fontSize: '14px' });
const sidebarFooter = { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' };
const userLabel = { fontSize: '11px', color: '#94a3b8', marginBottom: '10px' };
const logoutBtn = { display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px' };

const main = { marginLeft: '280px', flex: 1, padding: '40px 60px' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { fontSize: '28px', fontWeight: 950, margin: 0, letterSpacing: '-1px' };
const viewSub = { fontSize: '13px', color: '#64748b', margin: '4px 0 0', fontWeight: 500 };
const refreshBtn = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const heroGrid = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '30px', marginBottom: '50px' };
const blackCard = { background: '#000', color: '#fff', padding: '40px', borderRadius: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const cardTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const cardLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const revenueLarge = { fontSize: '48px', fontWeight: 900, margin: '10px 0', letterSpacing: '-2px' };
const revFlex = { display: 'flex', gap: '25px', marginTop: '20px' };
const revStat = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 };

const whiteCard = { background: '#fff', border: '1px solid #eee', borderRadius: '30px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const statBox = { borderBottom: '1px solid #f8f8f8', paddingBottom: '15px' };
const statMid = { fontSize: '22px', fontWeight: 900, margin: '5px 0' };

const contentArea = { position: 'relative' };
const fadeIn = { animation: 'fadeIn 0.5s ease-out' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const sectionTitle = { fontSize: '20px', fontWeight: 900, margin: 0 };
const primaryBtn = { background: '#000', color: '#fff', padding: '14px 24px', borderRadius: '14px', border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const compList = { display: 'flex', flexDirection: 'column', gap: '40px' };
const grandCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', padding: '30px' };
const grandHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f8f8f8', paddingBottom: '25px', marginBottom: '30px' };
const grandTitleText = { fontSize: '20px', fontWeight: 900, margin: 0 };
const grandSubText = { fontSize: '13px', color: '#94a3b8', margin: '6px 0 0', fontWeight: 500, maxWidth: '600px' };
const grandActions = { display: 'flex', gap: '10px' };
const luxuryEditBtn = { background: '#f8fafc', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const luxuryAddBtn = { background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const luxuryDelBtn = { width: '42px', height: '42px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '25px' };
const ctContainer = { background: '#fcfcfc', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '25px' };
const ctHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const ctTitleText = { fontSize: '15px', fontWeight: 900, margin: 0 };
const ctPriceText = { fontSize: '11px', fontWeight: 800, color: '#0ea5e9', margin: '4px 0 0' };
const ctActions = { display: 'flex', gap: '6px' };
const ctIconBtn = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const ctIconBtnDel = { width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const candStack = { display: 'flex', flexDirection: 'column', gap: '10px' };
const candRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '14px', border: '1px solid #f8f8f8' };
const candInfo = { display: 'flex', alignItems: 'center', gap: '12px' };
const candAvatar = (u) => ({ width: '32px', height: '32px', borderRadius: '10px', background: u ? `url(${u}) center/cover` : '#eee' });
const candNameText = { fontSize: '13px', fontWeight: 700 };
const candMeta = { display: 'flex', alignItems: 'center', gap: '8px' };
const voteBadge = { fontSize: '10px', fontWeight: 900, background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px' };
const candAction = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const candActionDel = { background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' };

const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' };
const eventCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden' };
const evImg = (u) => ({ height: '180px', background: u ? `url(${u}) center/cover` : '#f1f5f9' });
const evBody = { padding: '20px' };
const evTitleText = { fontSize: '17px', fontWeight: 900, margin: '0 0 10px' };
const evMeta = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', marginBottom: '20px' };
const evFooter = { display: 'flex', gap: '10px' };
const evMBtn = { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #eee', fontSize: '11px', fontWeight: 800, cursor: 'pointer' };
const evDBtn = { width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', width: '440px', borderRadius: '30px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' };
const mHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const mTitle = { fontSize: '20px', fontWeight: 950, margin: 0 };
const mClose = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const mBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const mLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const mInput = { padding: '16px', borderRadius: '14px', border: '1px solid #eee', fontSize: '14px', fontWeight: 600, outline: 'none' };
const mSubmit = (p) => ({ background: '#000', color: '#fff', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: 900, fontSize: '14px', cursor: p ? 'not-allowed' : 'pointer', marginTop: '10px' });

const uploadZone = { height: '150px', border: '2px dashed #eee', borderRadius: '20px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const uploadPreview = { width: '100%', height: '100%', objectFit: 'cover' };
const fileInput = { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 };
const uploadEmpty = { textAlign: 'center' };
const uploadStatus = { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '8px', textAlign: 'center' };

const skeletonContainer = { display: 'flex', minHeight: '100vh', background: '#fff' };
const skeletonSidebar = { width: '280px', background: '#f8f8f8', borderRight: '1px solid #eee' };
const skeletonMain = { flex: 1, padding: '60px' };
const skeletonHero = { height: '240px', background: '#f1f5f9', borderRadius: '30px', marginBottom: '40px', animation: 'pulse 1.5s infinite' };
const skeletonGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' };
const skeletonCard = { height: '300px', background: '#f1f5f9', borderRadius: '24px' };
