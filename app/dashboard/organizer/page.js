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
  Filter, Download, ChevronDown, Eye
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

  // --- 2. MODAL & UI STATE ---
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [showAddContestModal, setShowAddContestModal] = useState(null); // ID of parent Comp
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(null); // ID of parent Contest
  const [editingItem, setEditingItem] = useState(null); // { type: 'comp'|'contest'|'cand', data: {} }
  const [isProcessing, setIsProcessing] = useState(false);

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

      // Filter tickets logic for 5% split visibility
      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });
    } catch (err) {
      console.error("Critical Sync Failure:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // --- 5. HIERARCHICAL CRUD HANDLERS ---

  const handleCreateComp = async () => {
    if (!compForm.title) return;
    setIsProcessing(true);
    const { error } = await supabase.from('competitions').insert([
      { ...compForm, organizer_id: data.profile.id }
    ]);
    if (!error) { 
      setShowAddCompModal(false); 
      setCompForm({ title: '', description: '' }); 
      loadDashboardData(true); 
    }
    setIsProcessing(false);
  };

  const handleCreateContest = async () => {
    if (!contestForm.title) return;
    setIsProcessing(true);
    const { error } = await supabase.from('contests').insert([
      { ...contestForm, competition_id: showAddContestModal }
    ]);
    if (!error) { 
      setShowAddContestModal(null); 
      setContestForm({ title: '', vote_price: 1.00 }); 
      loadDashboardData(true); 
    }
    setIsProcessing(false);
  };

  const handleCreateCandidate = async () => {
    if (!candidateForm.name) return;
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([
      { ...candidateForm, contest_id: showAddCandidateModal, vote_count: 0 }
    ]);
    if (!error) { 
      setShowAddCandidateModal(null); 
      setCandidateForm({ name: '', image_url: '' }); 
      loadDashboardData(true); 
    }
    setIsProcessing(false);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    setIsProcessing(true);
    const table = editingItem.type === 'comp' ? 'competitions' : editingItem.type === 'contest' ? 'contests' : 'candidates';
    
    // De-structure to avoid sending nested relation objects back to Supabase
    const { contests, candidates, ...cleanData } = editingItem.data;
    
    const { error } = await supabase.from(table).update(cleanData).eq('id', cleanData.id);
    if (!error) { 
      setEditingItem(null); 
      loadDashboardData(true); 
    }
    setIsProcessing(false);
  };

  const handleDelete = async (type, id) => {
    const confirmation = confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`);
    if (!confirmation) return;

    const table = type === 'comp' ? 'competitions' : type === 'contest' ? 'contests' : 'candidates';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) loadDashboardData(true);
    else alert("Error: Ensure children are deleted first or check permissions.");
  };

  // --- 6. LUXURY ANALYTICS ENGINE (5% PAYSTACK SPLIT) ---
  const analytics = useMemo(() => {
    const ticketRevenue = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    let voteRevenue = 0;
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const votes = ct.candidates?.reduce((sum, cand) => sum + (cand.vote_count || 0), 0) || 0;
        voteRevenue += (votes * (ct.vote_price || 0));
      });
    });

    const grossTotal = ticketRevenue + voteRevenue;
    const platformFees = grossTotal * 0.05;
    const netPayout = grossTotal - platformFees;

    return {
      gross: grossTotal,
      fees: platformFees,
      net: netPayout,
      ticketRevenue,
      voteRevenue,
      totalTickets: data.tickets.length
    };
  }, [data]);

  // --- 7. SKELETON LOADER COMPONENT ---
  const SkeletonLoader = () => (
    <div style={skeletonContainer}>
      <div style={skeletonSidebar}></div>
      <div style={skeletonMain}>
        <div style={skeletonHeader}></div>
        <div style={skeletonHeroCard}></div>
        <div style={skeletonGrid}>
          {[1, 2, 3].map(i => <div key={i} style={skeletonCard}></div>)}
        </div>
      </div>
    </div>
  );

  if (loading) return <SkeletonLoader />;

  return (
    <div style={container}>
      {/* SIDEBAR NAVIGATION */}
      <aside style={sidebar}>
        <div style={brand}>OUSTED <span style={goldText}>PLATINUM</span></div>
        <nav style={sideNav}>
          <button onClick={() => setActiveTab('events')} style={tabBtn(activeTab === 'events')}>
            <Calendar size={18}/> Events
          </button>
          <button onClick={() => setActiveTab('competitions')} style={tabBtn(activeTab === 'competitions')}>
            <Trophy size={18}/> Competitions
          </button>
          <button onClick={() => setActiveTab('analytics')} style={tabBtn(activeTab === 'analytics')}>
            <Activity size={18}/> Revenue
          </button>
          <button onClick={() => setActiveTab('settings')} style={tabBtn(activeTab === 'settings')}>
            <Settings size={18}/> Account
          </button>
        </nav>
        <div style={profileMini}>
          <div style={pInfo}>
            <p style={pEmail}>{data.profile?.email}</p>
            <p style={pStatus}>Verified Organizer</p>
          </div>
          <button style={logoutBtn} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            <LogOut size={18}/>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={main}>
        <header style={header}>
          <div>
            <h1 style={viewTitle}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p style={viewSub}>Real-time management & payout tracking</p>
          </div>
          <button style={refreshCircle} onClick={() => loadDashboardData(true)}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
          </button>
        </header>

        {/* REVENUE OVERVIEW CARDS */}
        <section style={heroGrid}>
          <div style={blackCard}>
            <div style={cardHeader}>
              <p style={cardLabel}>ESTIMATED NET SETTLEMENT (95%)</p>
              <Zap size={16} color="#d4af37"/>
            </div>
            <h2 style={revenueVal}>GHS {analytics.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            <div style={revenueBreakdown}>
              <span style={revItem}><Ticket size={14}/> Tickets: {analytics.ticketRevenue.toFixed(2)}</span>
              <span style={revItem}><Star size={14} color="#d4af37"/> Votes: {analytics.voteRevenue.toFixed(2)}</span>
            </div>
          </div>
          <div style={whiteCard}>
            <div style={statRow}>
              <p style={cardLabel}>TOTAL GROSS VOLUME</p>
              <h3 style={statVal}>GHS {analytics.gross.toFixed(2)}</h3>
            </div>
            <div style={statRow}>
              <p style={cardLabel}>PLATFORM COMMISSION (5%)</p>
              <h3 style={{...statVal, color: '#ef4444'}}>- GHS {analytics.fees.toFixed(2)}</h3>
            </div>
          </div>
        </section>

        {/* TAB CONTENT */}
        <div style={contentArea}>
          {activeTab === 'competitions' && (
            <div style={fadeIn}>
              <div style={sectionHeader}>
                <h2 style={sectionTitle}>Multi-Tier Competitions</h2>
                <button style={primaryBtn} onClick={() => setShowAddCompModal(true)}>
                  <Plus size={18}/> NEW GRAND COMPETITION
                </button>
              </div>

              <div style={compStack}>
                {data.competitions.length > 0 ? data.competitions.map(comp => (
                  <div key={comp.id} style={grandCompCard}>
                    <div style={compHeader}>
                      <div>
                        <h3 style={itemTitle}>{comp.title}</h3>
                        <p style={itemDesc}>{comp.description || 'No description provided.'}</p>
                      </div>
                      <div style={compActions}>
                        <button style={actionBtn} onClick={() => setEditingItem({ type: 'comp', data: comp })}><Edit3 size={16}/></button>
                        <button style={addLayerBtn} onClick={() => setShowAddContestModal(comp.id)}><Layers size={16}/> ADD CATEGORY</button>
                        <button style={delBtn} onClick={() => handleDelete('comp', comp.id)}><Trash2 size={16}/></button>
                      </div>
                    </div>

                    <div style={contestGrid}>
                      {comp.contests?.map(ct => (
                        <div key={ct.id} style={contestContainer}>
                          <div style={ctHeader}>
                            <div>
                              <h4 style={ctTitle}>{ct.title}</h4>
                              <p style={ctPrice}>GHS {ct.vote_price} per vote</p>
                            </div>
                            <div style={ctMiniActions}>
                              <button style={tinyIcon} onClick={() => setEditingItem({ type: 'contest', data: ct })}><Edit3 size={14}/></button>
                              <button style={tinyIcon} onClick={() => setShowAddCandidateModal(ct.id)}><UserPlus size={14}/></button>
                              <button style={tinyIconDel} onClick={() => handleDelete('contest', ct.id)}><X size={14}/></button>
                            </div>
                          </div>

                          <div style={candidateStack}>
                            {ct.candidates?.map(cand => (
                              <div key={cand.id} style={candRow}>
                                <div style={candFlex}>
                                  <div style={avatar(cand.image_url)}></div>
                                  <span style={candName}>{cand.name}</span>
                                </div>
                                <div style={candFlex}>
                                  <span style={voteBadge}>{cand.vote_count || 0} votes</span>
                                  <button style={subtleBtn} onClick={() => setEditingItem({ type: 'cand', data: cand })}><Edit3 size={12}/></button>
                                  <button style={subtleBtnDel} onClick={() => handleDelete('cand', cand.id)}><Trash2 size={12}/></button>
                                </div>
                              </div>
                            ))}
                            {(!ct.candidates || ct.candidates.length === 0) && <p style={emptyText}>No contestants yet.</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div style={emptyState}>
                    <Trophy size={48} color="#eee"/>
                    <p>No competitions found. Start by creating one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div style={fadeIn}>
              <div style={sectionHeader}>
                <h2 style={sectionTitle}>Live Events</h2>
                <button style={primaryBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                  <Plus size={18}/> CREATE NEW EVENT
                </button>
              </div>
              <div style={eventGrid}>
                {data.events.map(ev => (
                  <div key={ev.id} style={eventCard}>
                    <div style={evImage(ev.images?.[0])}></div>
                    <div style={evInfo}>
                      <h4 style={evTitle}>{ev.title}</h4>
                      <p style={evMeta}><MapPin size={14}/> {ev.location}</p>
                      <div style={evFooter}>
                        <button style={manageBtn} onClick={() => router.push(`/events/${ev.id}`)}>VIEW PUBLIC</button>
                        <button style={evDelBtn} onClick={() => handleDelete('event', ev.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- ALL MODALS --- */}

      {/* MODAL 1: ADD COMPETITION */}
      {showAddCompModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={mHeader}>
              <h3 style={mTitle}>New Grand Competition</h3>
              <button style={mClose} onClick={() => setShowAddCompModal(false)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <div style={inputGrp}>
                <label style={mLabel}>COMPETITION TITLE</label>
                <input style={mInput} placeholder="e.g. Ghana Highlife Awards 2026" value={compForm.title} onChange={e => setCompForm({...compForm, title: e.target.value})}/>
              </div>
              <div style={inputGrp}>
                <label style={mLabel}>DESCRIPTION</label>
                <textarea style={mInput} rows={3} placeholder="Provide details about this competition..." value={compForm.description} onChange={e => setCompForm({...compForm, description: e.target.value})}/>
              </div>
              <button style={mSubmit(isProcessing)} onClick={handleCreateComp}>
                {isProcessing ? 'CREATING...' : 'CREATE COMPETITION'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CATEGORY */}
      {showAddContestModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={mHeader}>
              <h3 style={mTitle}>Add New Category</h3>
              <button style={mClose} onClick={() => setShowAddContestModal(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <div style={inputGrp}>
                <label style={mLabel}>CATEGORY TITLE</label>
                <input style={mInput} placeholder="e.g. Best Vocalist" value={contestForm.title} onChange={e => setContestForm({...contestForm, title: e.target.value})}/>
              </div>
              <div style={inputGrp}>
                <label style={mLabel}>VOTE PRICE (GHS)</label>
                <input style={mInput} type="number" step="0.5" value={contestForm.vote_price} onChange={e => setContestForm({...contestForm, vote_price: e.target.value})}/>
              </div>
              <button style={mSubmit(isProcessing)} onClick={handleCreateContest}>
                {isProcessing ? 'ADDING...' : 'SAVE CATEGORY'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CONTESTANT */}
      {showAddCandidateModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={mHeader}>
              <h3 style={mTitle}>Register Contestant</h3>
              <button style={mClose} onClick={() => setShowAddCandidateModal(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <div style={inputGrp}>
                <label style={mLabel}>CONTESTANT NAME</label>
                <input style={mInput} placeholder="Enter full name" value={candidateForm.name} onChange={e => setCandidateForm({...candidateForm, name: e.target.value})}/>
              </div>
              <div style={inputGrp}>
                <label style={mLabel}>IMAGE URL</label>
                <input style={mInput} placeholder="Link to portrait photo" value={candidateForm.image_url} onChange={e => setCandidateForm({...candidateForm, image_url: e.target.value})}/>
              </div>
              <button style={mSubmit(isProcessing)} onClick={handleCreateCandidate}>
                {isProcessing ? 'REGISTERING...' : 'ADD CONTESTANT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: UNIVERSAL EDIT */}
      {editingItem && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={mHeader}>
              <h3 style={mTitle}>Edit {editingItem.type.toUpperCase()}</h3>
              <button style={mClose} onClick={() => setEditingItem(null)}><X size={20}/></button>
            </div>
            <div style={mBody}>
              <div style={inputGrp}>
                <label style={mLabel}>TITLE / NAME</label>
                <input 
                  style={mInput} 
                  value={editingItem.data.title || editingItem.data.name || ''} 
                  onChange={e => {
                    const key = editingItem.type === 'cand' ? 'name' : 'title';
                    setEditingItem({...editingItem, data: {...editingItem.data, [key]: e.target.value}});
                  }}
                />
              </div>
              {editingItem.type === 'contest' && (
                <div style={inputGrp}>
                  <label style={mLabel}>VOTE PRICE (GHS)</label>
                  <input style={mInput} type="number" value={editingItem.data.vote_price} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, vote_price: e.target.value}})}/>
                </div>
              )}
              {editingItem.type === 'cand' && (
                <div style={inputGrp}>
                  <label style={mLabel}>IMAGE URL</label>
                  <input style={mInput} value={editingItem.data.image_url} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, image_url: e.target.value}})}/>
                </div>
              )}
              <button style={mSubmit(isProcessing)} onClick={handleUpdate}>
                {isProcessing ? 'SAVING...' : 'UPDATE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- FULL STYLING ENGINE (NO OMISSIONS) ---

const container = { display: 'flex', minHeight: '100vh', background: '#fcfcfc', color: '#000', fontFamily: 'Inter, sans-serif' };
const sidebar = { width: '280px', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', padding: '40px 20px', position: 'fixed', height: '100vh', zIndex: 100 };
const brand = { fontSize: '20px', fontWeight: 950, letterSpacing: '-1px', marginBottom: '50px' };
const goldText = { color: '#d4af37' };
const sideNav = { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' };
const tabBtn = (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '14px', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', transition: '0.2s', textAlign: 'left' });
const profileMini = { paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const pInfo = { overflow: 'hidden' };
const pEmail = { fontSize: '12px', fontWeight: 700, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden' };
const pStatus = { fontSize: '10px', color: '#94a3b8', margin: 0, fontWeight: 600 };
const logoutBtn = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '10px' };

const main = { marginLeft: '280px', flex: 1, padding: '40px 60px' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { fontSize: '32px', fontWeight: 950, margin: 0, letterSpacing: '-1px' };
const viewSub = { fontSize: '14px', color: '#64748b', margin: '4px 0 0', fontWeight: 500 };
const refreshCircle = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const heroGrid = { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '25px', marginBottom: '50px' };
const blackCard = { background: '#000', color: '#fff', borderRadius: '30px', padding: '40px', position: 'relative', overflow: 'hidden' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const cardLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px' };
const revenueVal = { fontSize: '52px', fontWeight: 900, margin: '10px 0', letterSpacing: '-2px' };
const revenueBreakdown = { display: 'flex', gap: '20px', marginTop: '20px' };
const revItem = { fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' };

const whiteCard = { background: '#fff', border: '1px solid #eee', borderRadius: '30px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const statRow = { padding: '15px 0', borderBottom: '1px solid #f8f8f8' };
const statVal = { fontSize: '24px', fontWeight: 900, margin: '5px 0' };

const contentArea = { position: 'relative' };
const fadeIn = { animation: 'fadeIn 0.5s ease-out' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const sectionTitle = { fontSize: '20px', fontWeight: 900, margin: 0 };
const primaryBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '14px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const compStack = { display: 'flex', flexDirection: 'column', gap: '40px' };
const grandCompCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', padding: '30px' };
const compHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f8f8f8', paddingBottom: '25px', marginBottom: '30px' };
const itemTitle = { fontSize: '22px', fontWeight: 900, margin: 0 };
const itemDesc = { fontSize: '13px', color: '#94a3b8', margin: '6px 0 0', maxWidth: '500px' };
const compActions = { display: 'flex', gap: '10px' };
const actionBtn = { background: '#f8fafc', border: 'none', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 };
const addLayerBtn = { background: '#e0f2fe', color: '#0369a1', border: 'none', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' };
const delBtn = { background: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer' };

const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '25px' };
const contestContainer = { background: '#fcfcfc', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '25px' };
const ctHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const ctTitle = { fontSize: '16px', fontWeight: 900, margin: 0 };
const ctPrice = { fontSize: '11px', fontWeight: 700, color: '#0ea5e9', marginTop: '4px' };
const ctMiniActions = { display: 'flex', gap: '6px' };
const tinyIcon = { width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tinyIconDel = { width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const candidateStack = { display: 'flex', flexDirection: 'column', gap: '10px' };
const candRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '14px', border: '1px solid #f8f8f8' };
const candFlex = { display: 'flex', alignItems: 'center', gap: '12px' };
const avatar = (url) => ({ width: '32px', height: '32px', borderRadius: '10px', background: url ? `url(${url}) center/cover` : '#f1f5f9' });
const candName = { fontSize: '13px', fontWeight: 700 };
const voteBadge = { fontSize: '10px', fontWeight: 900, background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px' };
const subtleBtn = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const subtleBtnDel = { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' };

const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' };
const eventCard = { background: '#fff', borderRadius: '24px', border: '1px solid #eee', overflow: 'hidden' };
const evImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f1f5f9' });
const evInfo = { padding: '20px' };
const evTitle = { fontSize: '18px', fontWeight: 900, margin: '0 0 8px' };
const evMeta = { fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' };
const evFooter = { display: 'flex', gap: '10px' };
const manageBtn = { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #eee', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };
const evDelBtn = { width: '42px', height: '42px', borderRadius: '10px', background: '#fee2e2', color: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', width: '440px', borderRadius: '30px', padding: '40px', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' };
const mHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const mTitle = { fontSize: '20px', fontWeight: 950, margin: 0 };
const mClose = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const mBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputGrp = { display: 'flex', flexDirection: 'column', gap: '8px' };
const mLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const mInput = { padding: '16px', borderRadius: '14px', border: '1px solid #eee', fontSize: '14px', fontWeight: 600, outline: 'none' };
const mSubmit = (p) => ({ background: '#000', color: '#fff', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: 900, fontSize: '14px', cursor: p ? 'not-allowed' : 'pointer', marginTop: '10px' });

const skeletonContainer = { display: 'flex', minHeight: '100vh', background: '#fff' };
const skeletonSidebar = { width: '280px', background: '#f8f8f8', borderRight: '1px solid #eee' };
const skeletonMain = { flex: 1, padding: '60px' };
const skeletonHeader = { height: '40px', width: '200px', background: '#f1f5f9', borderRadius: '10px', marginBottom: '40px' };
const skeletonHeroCard = { height: '240px', background: '#f1f5f9', borderRadius: '30px', marginBottom: '50px' };
const skeletonGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' };
const skeletonCard = { height: '300px', background: '#f1f5f9', borderRadius: '24px' };
const emptyText = { fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px' };
const emptyState = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', padding: '100px', opacity: 0.5 };
