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
  Image as ImageIcon, MoreVertical, ExternalLink
} from 'lucide-react';

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

  // --- 2. MODAL VISIBILITY STATE ---
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showAddContestModal, setShowAddContestModal] = useState(null); // stores comp_id
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(null); // stores contest_id
  const [editingItem, setEditingItem] = useState(null); // { type: 'comp'|'contest'|'cand', data: {} }
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 3. FORM STATES FOR CREATION ---
  const [compForm, setCompForm] = useState({ title: '', description: '' });
  const [contestForm, setContestForm] = useState({ title: '', vote_price: 1.00 });
  const [candidateForm, setCandidateForm] = useState({ name: '', image_url: '' });

  // --- 4. DATA FETCHING ENGINE (TRIPLE-LEVEL HIERARCHY) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetch Profile, Events, Nested Competitions, and Tickets
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

      // Filter tickets to only show those belonging to this organizer's events
      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });
    } catch (err) {
      console.error("Critical Sync Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 5. HIERARCHICAL CRUD HANDLERS (FULL LOGIC) ---

  // --- CREATE ---
  const handleCreateComp = async () => {
    if (!compForm.title) return alert("Title is required");
    setIsProcessing(true);
    const { error } = await supabase.from('competitions').insert([
      { title: compForm.title, description: compForm.description, organizer_id: data.profile.id }
    ]);
    if (!error) {
      setShowAddCompModal(false);
      setCompForm({ title: '', description: '' });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  const handleCreateContest = async () => {
    if (!contestForm.title) return alert("Category title is required");
    setIsProcessing(true);
    const { error } = await supabase.from('contests').insert([
      { title: contestForm.title, vote_price: contestForm.vote_price, competition_id: showAddContestModal }
    ]);
    if (!error) {
      setShowAddContestModal(null);
      setContestForm({ title: '', vote_price: 1.00 });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  const handleCreateCandidate = async () => {
    if (!candidateForm.name) return alert("Name is required");
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([
      { name: candidateForm.name, image_url: candidateForm.image_url, contest_id: showAddCandidateModal, vote_count: 0 }
    ]);
    if (!error) {
      setShowAddCandidateModal(null);
      setCandidateForm({ name: '', image_url: '' });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  // --- UPDATE ---
  const handleUpdate = async () => {
    if (!editingItem) return;
    setIsProcessing(true);
    const table = editingItem.type === 'comp' ? 'competitions' : editingItem.type === 'contest' ? 'contests' : 'candidates';
    
    // Clean data for Supabase (remove nested objects if they exist)
    const { contests, candidates, ...updateData } = editingItem.data;

    const { error } = await supabase.from(table).update(updateData).eq('id', updateData.id);
    if (!error) {
      setEditingItem(null);
      loadDashboardData(true);
    } else {
      alert("Update failed: " + error.message);
    }
    setIsProcessing(false);
  };

  // --- DELETE ---
  const handleDelete = async (type, id) => {
    const msg = type === 'comp' ? "Delete entire Grand Competition and all categories?" : "Delete this item?";
    if (!confirm(msg)) return;
    
    const table = type === 'comp' ? 'competitions' : type === 'contest' ? 'contests' : 'candidates';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      loadDashboardData(true);
    } else {
      alert("Delete failed. Check if child records exist.");
    }
  };

  // --- 6. ANALYTICS ENGINE (5% COMMISSION CALCULATIONS) ---
  const analytics = useMemo(() => {
    // Ticket revenue calculation
    const ticketRev = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    // Voting revenue calculation
    let voteRev = 0;
    let totalVotes = 0;
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const votes = ct.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) || 0;
        totalVotes += votes;
        voteRev += (votes * (ct.vote_price || 0));
      });
    });

    const gross = ticketRev + voteRev;
    return {
      gross,
      net: gross * 0.95,
      fees: gross * 0.05,
      ticketRev,
      voteRev,
      totalVotes,
      ticketCount: data.tickets.length
    };
  }, [data]);

  // --- 7. RENDER LOGIC ---

  if (loading) return (
    <div style={loaderPage}>
      <Loader2 className="animate-spin" size={40} color="#000"/>
      <p style={loaderText}>OUSTED LUXE ENGINE STARTING...</p>
    </div>
  );

  return (
    <div style={wrapper}>
      {/* SIDEBAR NAVIGATION */}
      <aside style={sidebar}>
        <div style={sidebarLogo}>OUSTED <span style={luxeBadge}>PLATINUM</span></div>
        <nav style={sideNav}>
          <button onClick={() => setActiveTab('events')} style={sideTab(activeTab === 'events')}>
            <Calendar size={18}/> Events
          </button>
          <button onClick={() => setActiveTab('competitions')} style={sideTab(activeTab === 'competitions')}>
            <Trophy size={18}/> Competitions
          </button>
          <button onClick={() => setActiveTab('analytics')} style={sideTab(activeTab === 'analytics')}>
            <Activity size={18}/> Analytics
          </button>
          <button onClick={() => setActiveTab('tickets')} style={sideTab(activeTab === 'tickets')}>
            <Ticket size={18}/> Sales Ledger
          </button>
        </nav>
        <div style={sidebarFooter}>
          <button style={logoutBtn} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            <LogOut size={16}/> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={mainContent}>
        {/* TOP BAR */}
        <header style={topBar}>
          <div>
            <h2 style={viewTitle}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <p style={viewSub}>Logged in as {data.profile?.email}</p>
          </div>
          <div style={topActions}>
            <div style={payoutStatus(data.profile?.paystack_subaccount_code)}>
              {data.profile?.paystack_subaccount_code ? 'SPLITS ACTIVE' : 'PAYOUTS PENDING'}
            </div>
            <button style={refreshCircle} onClick={() => loadDashboardData(true)}>
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
            </button>
          </div>
        </header>

        {/* FINANCIAL HERO CARDS */}
        <section style={heroGrid}>
          <div style={balanceCard}>
            <p style={cardLabel}>ESTIMATED NET SETTLEMENT (95%)</p>
            <h1 style={balanceVal}>GHS {analytics.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</h1>
            <div style={balanceFooter}>
              <span style={footerItem}><ArrowUpRight size={14}/> Tickets: GHS {analytics.ticketRev.toFixed(2)}</span>
              <span style={footerItem}><Zap size={14} color="#d4af37"/> Votes: GHS {analytics.voteRev.toFixed(2)}</span>
            </div>
          </div>
          <div style={statsCard}>
            <div style={statBox}>
              <p style={cardLabel}>SYSTEM FEES (5%)</p>
              <h3 style={statValText}>GHS {analytics.fees.toFixed(2)}</h3>
            </div>
            <div style={statBox}>
              <p style={cardLabel}>TOTAL TICKETS / VOTES</p>
              <h3 style={statValText}>{analytics.ticketCount} / {analytics.totalVotes}</h3>
            </div>
          </div>
        </section>

        {/* DYNAMIC TAB VIEWPORT */}
        <div style={viewPort}>

          {/* --- COMPETITIONS VIEW (DETAILED & ORGANIZED) --- */}
          {activeTab === 'competitions' && (
            <div style={fadeAnim}>
              <div style={tabHeader}>
                <h3 style={tabTitle}>Competition Hierarchy</h3>
                <button style={primaryBtn} onClick={() => setShowAddCompModal(true)}>
                  <Plus size={18}/> CREATE GRAND COMPETITION
                </button>
              </div>

              <div style={compList}>
                {data.competitions.map(comp => (
                  <div key={comp.id} style={grandCard}>
                    <div style={grandHead}>
                      <div>
                        <h4 style={itemTitleText}>{comp.title}</h4>
                        <p style={itemSubText}>{comp.description || 'No description provided.'}</p>
                      </div>
                      <div style={grandActions}>
                        <button style={editActionBtn} onClick={() => setEditingItem({ type: 'comp', data: comp })}>
                          <Edit3 size={16}/> Edit
                        </button>
                        <button style={addCategoryBtn} onClick={() => setShowAddContestModal(comp.id)}>
                          <Layers size={16}/> Add Category
                        </button>
                        <button style={deleteActionBtn} onClick={() => handleDelete('comp', comp.id)}>
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>

                    <div style={contestGrid}>
                      {comp.contests?.map(ct => (
                        <div key={ct.id} style={contestContainer}>
                          <div style={ctHeader}>
                            <div>
                              <h5 style={ctTitleText}>{ct.title}</h5>
                              <p style={ctPriceTag}>GHS {ct.vote_price} / vote</p>
                            </div>
                            <div style={ctActionGroup}>
                              <button style={iconBtn} onClick={() => setEditingItem({ type: 'contest', data: ct })}><Edit3 size={14}/></button>
                              <button style={iconBtn} onClick={() => setShowAddCandidateModal(ct.id)}><UserPlus size={14}/></button>
                              <button style={iconBtnDel} onClick={() => handleDelete('contest', ct.id)}><Trash2 size={14}/></button>
                            </div>
                          </div>

                          <div style={candList}>
                            {ct.candidates?.length > 0 ? ct.candidates.map(cand => (
                              <div key={cand.id} style={candRow}>
                                <div style={candInfo}>
                                  <div style={candAvatar(cand.image_url)}></div>
                                  <span style={candNameText}>{cand.name}</span>
                                </div>
                                <div style={candStats}>
                                  <span style={candVoteBadge}>{cand.vote_count} votes</span>
                                  <button style={miniEdit} onClick={() => setEditingItem({ type: 'cand', data: cand })}><Edit3 size={12}/></button>
                                  <button style={miniDel} onClick={() => handleDelete('cand', cand.id)}><X size={12}/></button>
                                </div>
                              </div>
                            )) : <p style={emptyText}>No contestants added.</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- ANALYTICS VIEW --- */}
          {activeTab === 'analytics' && (
            <div style={fadeAnim}>
              <div style={anaGrid}>
                <div style={anaSection}>
                  <h3 style={tabTitle}>Revenue Intelligence</h3>
                  <div style={anaCard}>
                    <div style={anaRow}><span>Ticket Gross Sales</span> <span>GHS {analytics.ticketRev.toFixed(2)}</span></div>
                    <div style={anaRow}><span>Voting Gross Sales</span> <span>GHS {analytics.voteRev.toFixed(2)}</span></div>
                    <div style={divider}></div>
                    <div style={anaRow}><span>Platform Fee (5%)</span> <span style={{color: '#ef4444'}}>- GHS {analytics.fees.toFixed(2)}</span></div>
                    <div style={anaRow}><strong style={{fontSize: '18px'}}>Net Revenue</strong> <strong style={{fontSize: '18px', color: '#16a34a'}}>GHS {analytics.net.toFixed(2)}</strong></div>
                  </div>
                </div>

                <div style={anaSection}>
                   <h3 style={tabTitle}>Voting Distribution</h3>
                   <div style={anaCard}>
                     {data.competitions.map(comp => (
                       <div key={comp.id} style={anaRow}>
                         <span>{comp.title}</span>
                         <span>{comp.contests?.reduce((a, b) => a + (b.candidates?.reduce((s, c) => s + (c.vote_count || 0), 0) || 0), 0)} Votes</span>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* --- EVENTS VIEW --- */}
          {activeTab === 'events' && (
            <div style={fadeAnim}>
              <div style={tabHeader}>
                <h3 style={tabTitle}>Your Events</h3>
                <button style={primaryBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                  <Plus size={18}/> CREATE EVENT
                </button>
              </div>
              <div style={eventGrid}>
                {data.events.map(ev => (
                  <div key={ev.id} style={eventCard}>
                    <div style={evImg(ev.images?.[0])}></div>
                    <div style={evBody}>
                      <h4 style={evTitleText}>{ev.title}</h4>
                      <p style={evMeta}><MapPin size={12}/> {ev.location}</p>
                      <div style={evFooter}>
                        <button style={evManageBtn} onClick={() => router.push(`/events/${ev.id}`)}>View Public</button>
                        <button style={evDeleteBtn} onClick={() => handleDelete('event', ev.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- ALL MODALS (TRIPLE CHECKED) --- */}

      {/* 1. GRAND COMPETITION MODAL */}
      {showAddCompModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHead}>
              <h3 style={modalTitle}>Create Grand Competition</h3>
              <button style={closeBtn} onClick={() => setShowAddCompModal(false)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
              <label style={mLabel}>COMPETITION TITLE</label>
              <input style={mInput} placeholder="e.g. Ghana Music Awards" value={compForm.title} onChange={e => setCompForm({...compForm, title: e.target.value})}/>
              <label style={mLabel}>DESCRIPTION</label>
              <textarea style={mInput} placeholder="Brief summary of the competition..." value={compForm.description} onChange={e => setCompForm({...compForm, description: e.target.value})}/>
              <button style={mSaveBtn(isProcessing)} onClick={handleCreateComp}>{isProcessing ? 'CREATING...' : 'SAVE COMPETITION'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CATEGORY (CONTEST) MODAL */}
      {showAddContestModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHead}>
              <h3 style={modalTitle}>Add Category</h3>
              <button style={closeBtn} onClick={() => setShowAddContestModal(null)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
              <label style={mLabel}>CATEGORY NAME</label>
              <input style={mInput} placeholder="e.g. Artist of the Year" value={contestForm.title} onChange={e => setContestForm({...contestForm, title: e.target.value})}/>
              <label style={mLabel}>VOTE PRICE (GHS)</label>
              <input style={mInput} type="number" step="0.5" value={contestForm.vote_price} onChange={e => setContestForm({...contestForm, vote_price: e.target.value})}/>
              <button style={mSaveBtn(isProcessing)} onClick={handleCreateContest}>{isProcessing ? 'ADDING CATEGORY...' : 'SAVE CATEGORY'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CONTESTANT (CANDIDATE) MODAL */}
      {showAddCandidateModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHead}>
              <h3 style={modalTitle}>Register Contestant</h3>
              <button style={closeBtn} onClick={() => setShowAddCandidateModal(null)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
              <label style={mLabel}>CONTESTANT NAME</label>
              <input style={mInput} placeholder="e.g. John Doe" value={candidateForm.name} onChange={e => setCandidateForm({...candidateForm, name: e.target.value})}/>
              <label style={mLabel}>IMAGE URL</label>
              <input style={mInput} placeholder="https://image-link.com" value={candidateForm.image_url} onChange={e => setCandidateForm({...candidateForm, image_url: e.target.value})}/>
              <button style={mSaveBtn(isProcessing)} onClick={handleCreateCandidate}>{isProcessing ? 'REGISTERING...' : 'ADD CONTESTANT'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. UNIVERSAL EDIT MODAL */}
      {editingItem && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={modalHead}>
              <h3 style={modalTitle}>Edit {editingItem.type.toUpperCase()}</h3>
              <button style={closeBtn} onClick={() => setEditingItem(null)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
              <label style={mLabel}>TITLE / NAME</label>
              <input 
                style={mInput} 
                value={editingItem.data.title || editingItem.data.name || ''} 
                onChange={e => {
                  const key = editingItem.type === 'cand' ? 'name' : 'title';
                  setEditingItem({...editingItem, data: {...editingItem.data, [key]: e.target.value}});
                }}
              />
              
              {editingItem.type === 'contest' && (
                <>
                  <label style={mLabel}>VOTE PRICE (GHS)</label>
                  <input style={mInput} type="number" value={editingItem.data.vote_price} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, vote_price: e.target.value}})}/>
                </>
              )}

              {editingItem.type === 'cand' && (
                <>
                  <label style={mLabel}>IMAGE URL</label>
                  <input style={mInput} value={editingItem.data.image_url} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, image_url: e.target.value}})}/>
                </>
              )}

              <button style={mSaveBtn(isProcessing)} onClick={handleUpdate}>{isProcessing ? 'SAVING...' : 'UPDATE CHANGES'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- COMPLETE LUXURY STYLES (TRIPLE CHECKED) ---
const wrapper = { display: 'flex', minHeight: '100vh', background: '#fcfcfc', color: '#000', fontFamily: 'Inter, sans-serif' };
const sidebar = { width: '280px', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', padding: '30px 20px', position: 'fixed', height: '100vh' };
const sidebarLogo = { fontSize: '20px', fontWeight: 950, marginBottom: '40px', letterSpacing: '-1px' };
const luxeBadge = { background: '#d4af37', color: '#000', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', marginLeft: '5px' };
const sideNav = { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 };
const sideTab = (a) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '12px', background: a ? 'rgba(255,255,255,0.1)' : 'transparent', color: a ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 700, fontSize: '14px', transition: '0.2s' });
const sidebarFooter = { paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' };
const logoutBtn = { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 };

const mainContent = { marginLeft: '280px', flex: 1, padding: '40px 60px' };
const topBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { fontSize: '28px', fontWeight: 950, margin: 0 };
const viewSub = { margin: '5px 0 0', fontSize: '13px', color: '#64748b', fontWeight: 600 };
const topActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const payoutStatus = (on) => ({ background: on ? '#f0fdf4' : '#fee2e2', color: on ? '#16a34a' : '#ef4444', padding: '6px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 });
const refreshCircle = { width: '42px', height: '42px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const heroGrid = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '30px', marginBottom: '50px' };
const balanceCard = { background: '#000', color: '#fff', padding: '40px', borderRadius: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const cardLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '10px' };
const balanceVal = { fontSize: '48px', fontWeight: 900, margin: '10px 0', letterSpacing: '-2px' };
const balanceFooter = { display: 'flex', gap: '25px', marginTop: '20px' };
const footerItem = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 };

const statsCard = { background: '#fff', border: '1px solid #eee', borderRadius: '30px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const statBox = { borderBottom: '1px solid #f8f8f8', paddingBottom: '15px' };
const statValText = { fontSize: '24px', fontWeight: 900, margin: '5px 0' };

const viewPort = { animation: 'fadeIn 0.5s ease-out' };
const tabHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const tabTitle = { fontSize: '20px', fontWeight: 900, margin: 0 };
const primaryBtn = { background: '#000', color: '#fff', padding: '14px 24px', borderRadius: '14px', border: 'none', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const compList = { display: 'flex', flexDirection: 'column', gap: '40px' };
const grandCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', padding: '30px' };
const grandHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f8f8f8', paddingBottom: '25px', marginBottom: '30px' };
const itemTitleText = { fontSize: '20px', fontWeight: 900, margin: 0 };
const itemSubText = { fontSize: '13px', color: '#94a3b8', margin: '6px 0 0', fontWeight: 500, maxWidth: '500px' };
const grandActions = { display: 'flex', gap: '10px' };
const editActionBtn = { background: '#f8fafc', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const addCategoryBtn = { background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const deleteActionBtn = { width: '42px', height: '42px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '25px' };
const contestContainer = { background: '#fcfcfc', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '25px' };
const ctHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const ctTitleText = { fontSize: '15px', fontWeight: 900, margin: 0 };
const ctPriceTag = { fontSize: '11px', fontWeight: 800, color: '#0ea5e9', margin: '4px 0 0' };
const ctActionGroup = { display: 'flex', gap: '6px' };
const iconBtn = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer' };
const iconBtnDel = { width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' };

const candList = { display: 'flex', flexDirection: 'column', gap: '10px' };
const candRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #f8f8f8' };
const candInfo = { display: 'flex', alignItems: 'center', gap: '12px' };
const candAvatar = (u) => ({ width: '32px', height: '32px', borderRadius: '8px', background: u ? `url(${u}) center/cover` : '#eee' });
const candNameText = { fontSize: '13px', fontWeight: 700 };
const candStats = { display: 'flex', alignItems: 'center', gap: '8px' };
const candVoteBadge = { fontSize: '10px', fontWeight: 900, background: '#f1f5f9', color: '#000', padding: '5px 10px', borderRadius: '6px' };
const miniEdit = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const miniDel = { background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' };
const emptyText = { fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px' };

const anaGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px' };
const anaSection = { display: 'flex', flexDirection: 'column', gap: '20px' };
const anaCard = { background: '#fff', border: '1px solid #eee', borderRadius: '24px', padding: '30px', display: 'flex', flexDirection: 'column', gap: '15px' };
const anaRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: '14px', fontWeight: 600 };
const divider = { height: '1px', background: '#f1f5f9' };

const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' };
const eventCard = { background: '#fff', borderRadius: '20px', border: '1px solid #eee', overflow: 'hidden' };
const evImg = (u) => ({ height: '180px', background: u ? `url(${u}) center/cover` : '#f1f5f9' });
const evBody = { padding: '20px' };
const evTitleText = { fontSize: '16px', fontWeight: 900, margin: '0 0 10px' };
const evMeta = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8', marginBottom: '15px' };
const evFooter = { display: 'flex', gap: '10px' };
const evManageBtn = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #eee', fontSize: '11px', fontWeight: 800, cursor: 'pointer' };
const evDeleteBtn = { width: '38px', height: '38px', borderRadius: '8px', background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const modalContent = { background: '#fff', width: '440px', borderRadius: '30px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { fontSize: '20px', fontWeight: 950, margin: 0 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '15px' };
const mLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const mInput = { padding: '14px', borderRadius: '12px', border: '1px solid #eee', fontSize: '14px', fontWeight: 600, outline: 'none' };
const mSaveBtn = (p) => ({ background: '#000', color: '#fff', padding: '16px', borderRadius: '14px', border: 'none', fontWeight: 900, cursor: p ? 'not-allowed' : 'pointer', fontSize: '13px', marginTop: '10px' });
const loaderPage = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const loaderText = { fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '2px', marginTop: '20px' };
const fadeAnim = { animation: 'fadeIn 0.5s ease-out' };
