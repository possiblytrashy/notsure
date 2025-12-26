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
  Image as ImageIconLucide
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
  const [showAddContestModal, setShowAddContestModal] = useState(null); // stores compId
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(null); // stores contestId
  const [editingItem, setEditingItem] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 3. FORM STATES ---
  const [compForm, setCompForm] = useState({ title: '', description: '' });
  const [contestForm, setContestForm] = useState({ title: '', vote_price: 1.00 });
  const [candidateForm, setCandidateForm] = useState({ name: '', image_url: '' });

  // --- 4. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Parallel fetching for high performance
      const [profileRes, eventsRes, compsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*, ticket_tiers(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('competitions').select(`
            *,
            contests (
              *,
              candidates (*)
            )
        `).eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false }),
      ]);

      // Filter tickets where nested event belongs to organizer (Security Layer)
      const organizerTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];

      setData({
        profile: profileRes.data,
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: organizerTickets
      });

    } catch (err) {
      console.error("DASHBOARD_SYNC_ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // --- 5. CALCULATED ANALYTICS ---
  const stats = useMemo(() => {
    const revenue = data.tickets.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const platformFee = revenue * 0.05;
    const netPayout = revenue - platformFee;
    return {
      gross: revenue,
      net: netPayout,
      totalSales: data.tickets.length,
      scanned: data.tickets.filter(t => t.is_scanned).length
    };
  }, [data.tickets]);

  // --- 6. HANDLERS (CRUD) ---
  const handleAddCompetition = async () => {
    setIsProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('competitions').insert([{
      ...compForm,
      organizer_id: user.id
    }]);
    if (!error) {
      setShowAddCompModal(false);
      setCompForm({ title: '', description: '' });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  const handleAddContest = async (compId) => {
    setIsProcessing(true);
    const { error } = await supabase.from('contests').insert([{
      ...contestForm,
      competition_id: compId
    }]);
    if (!error) {
      setShowAddContestModal(null);
      setContestForm({ title: '', vote_price: 1.00 });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  const handleAddCandidate = async (contestId) => {
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([{
      ...candidateForm,
      contest_id: contestId
    }]);
    if (!error) {
      setShowAddCandidateModal(null);
      setCandidateForm({ name: '', image_url: '' });
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  // --- 7. UI COMPONENTS ---
  if (loading) return (
    <div style={skeletonCanvas}>
      <Loader2 className="animate-spin" size={40} color="#000"/>
      <p style={{marginTop: 20, fontWeight: 700}}>Initializing Ousted Systems...</p>
    </div>
  );

  return (
    <div style={canvas}>
      {/* SIDEBAR NAVIGATION */}
      <aside style={sidebar}>
        <div style={sidebarLogo}>OUSTED</div>
        <nav style={sideNav}>
          <button style={navItem(activeTab === 'events')} onClick={() => setActiveTab('events')}><Layout size={20}/> Events</button>
          <button style={navItem(activeTab === 'tickets')} onClick={() => setActiveTab('tickets')}><Ticket size={20}/> Tickets</button>
          <button style={navItem(activeTab === 'competitions')} onClick={() => setActiveTab('competitions')}><Trophy size={20}/> Competitions</button>
          <button style={navItem(activeTab === 'profile')} onClick={() => setActiveTab('profile')}><Settings size={20}/> Profile</button>
        </nav>
        <button style={logoutBtn} onClick={() => router.push('/logout')}><LogOut size={18}/> Logout</button>
      </aside>

      {/* MAIN VIEWPORT */}
      <main style={viewport}>
        <header style={header}>
          <div>
            <h1 style={greeting}>Dashboard</h1>
            <p style={subGreeting}>Managing {data.profile?.business_name || 'Organizer Account'}</p>
          </div>
          <div style={headerActions}>
            <button style={refreshBtn} onClick={() => loadDashboardData(true)}>
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
            </button>
            <div style={userBadge}>
              <div style={avatar}>{data.profile?.business_name?.[0]}</div>
            </div>
          </div>
        </header>

        {/* ANALYTICS RIBBON */}
        <section style={statGrid}>
          <div style={statCard}>
            <p style={statLabel}>GROSS REVENUE</p>
            <h2 style={statValue}>GHS {stats.gross.toLocaleString()}</h2>
            <div style={statTrend}><TrendingUp size={12}/> 5% Split Active</div>
          </div>
          <div style={statCard}>
            <p style={statLabel}>NET PAYOUT</p>
            <h2 style={statValue} sx={{color: '#22c55e'}}>GHS {stats.net.toLocaleString()}</h2>
          </div>
          <div style={statCard}>
            <p style={statLabel}>TICKET SALES</p>
            <h2 style={statValue}>{stats.totalSales}</h2>
          </div>
          <div style={statCard}>
            <p style={statLabel}>CHECK-IN RATE</p>
            <h2 style={statValue}>{((stats.scanned / (stats.totalSales || 1)) * 100).toFixed(0)}%</h2>
          </div>
        </section>

        {/* DYNAMIC TAB CONTENT */}
        <div style={contentBlock}>
          {activeTab === 'events' && (
            <div style={viewContainer}>
              <div style={viewHeader}>
                <h3 style={viewTitle}>Your Events</h3>
                <button style={primaryBtn} onClick={() => router.push('/dashboard/create')}><Plus size={18}/> Create Event</button>
              </div>
              <div style={grid}>
                {data.events.map(event => (
                  <div key={event.id} style={eventCard}>
                    <div style={eventImage(event.images?.[0])}></div>
                    <div style={eventBody}>
                      <h4 style={eventTitle}>{event.title}</h4>
                      <p style={eventMeta}><Calendar size={12}/> {new Date(event.date).toLocaleDateString()}</p>
                      <p style={eventMeta}><MapPin size={12}/> {event.location}</p>
                      <div style={cardFooter}>
                        <button style={manageBtn} onClick={() => router.push(`/dashboard/events/${event.id}`)}>Manage</button>
                        <div style={salesBadge}>{data.tickets.filter(t => t.event_id === event.id).length} Sold</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'competitions' && (
            <div style={viewContainer}>
              <div style={viewHeader}>
                <h3 style={viewTitle}>Competitions & Contests</h3>
                <button style={primaryBtn} onClick={() => setShowAddCompModal(true)}><Plus size={18}/> New Competition</button>
              </div>
              {data.competitions.map(comp => (
                <div key={comp.id} style={compBox}>
                  <div style={compHeader}>
                    <div>
                      <h4 style={compName}>{comp.title}</h4>
                      <p style={compDesc}>{comp.description}</p>
                    </div>
                    <button style={secBtn} onClick={() => setShowAddContestModal(comp.id)}><Plus size={16}/> Add Category</button>
                  </div>
                  
                  <div style={contestGrid}>
                    {comp.contests?.map(contest => (
                      <div key={contest.id} style={contestCard}>
                        <div style={contestHead}>
                          <h5 style={contestTitle}>{contest.title}</h5>
                          <div style={priceTag}>GHS {contest.vote_price} / vote</div>
                        </div>
                        <div style={candidateList}>
                          {contest.candidates?.map(cand => (
                            <div key={cand.id} style={candRow}>
                              <div style={candAvatar(cand.image_url)}></div>
                              <span style={candName}>{cand.name}</span>
                              <span style={voteCount}>{cand.vote_count || 0} Votes</span>
                            </div>
                          ))}
                        </div>
                        <button style={addCandBtn} onClick={() => setShowAddCandidateModal(contest.id)}>
                          <UserPlus size={14}/> Add Candidate
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tickets' && (
             <div style={viewContainer}>
                <h3 style={viewTitle}>Recent Ticket Activity</h3>
                <div style={table}>
                   <div style={tableHead}>
                      <span>Guest</span>
                      <span>Event</span>
                      <span>Tier</span>
                      <span>Amount</span>
                      <span>Status</span>
                   </div>
                   {data.tickets.map(ticket => (
                      <div key={ticket.id} style={tableRow}>
                         <span style={bold}>{ticket.guest_name}</span>
                         <span>{ticket.events?.title}</span>
                         <span style={badge}>{ticket.ticket_tiers?.name || 'Standard'}</span>
                         <span>GHS {ticket.amount}</span>
                         <span style={ticket.is_scanned ? scanned : pending}>
                            {ticket.is_scanned ? 'Scanned' : 'Valid'}
                         </span>
                      </div>
                   ))}
                </div>
             </div>
          )}
        </div>
      </main>

      {/* --- MODAL REPOSITORY --- */}

      {/* 1. Add Competition Modal */}
      {showAddCompModal && (
        <div style={modalOverlay}>
          <div style={modal}>
            <div style={modalHeader}><h3 style={modalTitle}>Create Competition</h3> <X onClick={() => setShowAddCompModal(false)} cursor="pointer"/></div>
            <div style={modalBody}>
              <label style={label}>Competition Title</label>
              <input style={input} placeholder="e.g. Ghana Event Awards" onChange={e => setCompForm({...compForm, title: e.target.value})}/>
              <label style={label}>Description</label>
              <textarea style={textarea} placeholder="Describe the awards..." onChange={e => setCompForm({...compForm, description: e.target.value})}/>
              <button style={submitBtn} onClick={handleAddCompetition} disabled={isProcessing}>
                {isProcessing ? 'Creating...' : 'Launch Competition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Contest (Category) Modal */}
      {showAddContestModal && (
        <div style={modalOverlay}>
          <div style={modal}>
            <div style={modalHeader}><h3 style={modalTitle}>New Category</h3> <X onClick={() => setShowAddContestModal(null)} cursor="pointer"/></div>
            <div style={modalBody}>
              <label style={label}>Category Name</label>
              <input style={input} placeholder="e.g. Best DJ" onChange={e => setContestForm({...contestForm, title: e.target.value})}/>
              <label style={label}>Vote Price (GHS)</label>
              <input style={input} type="number" step="0.5" defaultValue="1.00" onChange={e => setContestForm({...contestForm, vote_price: e.target.value})}/>
              <button style={submitBtn} onClick={() => handleAddContest(showAddContestModal)} disabled={isProcessing}>
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add Candidate Modal */}
      {showAddCandidateModal && (
        <div style={modalOverlay}>
          <div style={modal}>
            <div style={modalHeader}><h3 style={modalTitle}>Add Candidate</h3> <X onClick={() => setShowAddCandidateModal(null)} cursor="pointer"/></div>
            <div style={modalBody}>
              <label style={label}>Candidate Name</label>
              <input style={input} placeholder="e.g. DJ Vyrusky" onChange={e => setCandidateForm({...candidateForm, name: e.target.value})}/>
              <label style={label}>Image URL</label>
              <input style={input} placeholder="https://..." onChange={e => setCandidateForm({...candidateForm, image_url: e.target.value})}/>
              <button style={submitBtn} onClick={() => handleAddCandidate(showAddCandidateModal)} disabled={isProcessing}>
                Add Candidate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- FULL STYLE ENGINE ---

const canvas = { display: 'flex', minHeight: '100vh', background: '#F8F9FA', color: '#1A1D23', fontFamily: 'Inter, system-ui' };
const sidebar = { width: '280px', background: '#FFF', borderRight: '1px solid #E9ECEF', padding: '40px 20px', display: 'flex', flexDirection: 'column' };
const sidebarLogo = { fontSize: '24px', fontWeight: 900, letterSpacing: '-1px', marginBottom: '60px', paddingLeft: '20px' };
const sideNav = { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 };
const navItem = (active) => ({
  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '12px', border: 'none',
  background: active ? '#000' : 'transparent', color: active ? '#FFF' : '#6C757D', fontWeight: 600,
  fontSize: '15px', cursor: 'pointer', textAlign: 'left', transition: '0.2s'
});
const logoutBtn = { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', background: 'none', border: 'none', color: '#DC3545', fontWeight: 600, cursor: 'pointer' };

const viewport = { flex: 1, padding: '40px 60px', overflowY: 'auto' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const greeting = { fontSize: '32px', fontWeight: 800, margin: 0 };
const subGreeting = { color: '#6C757D', margin: '5px 0 0' };
const headerActions = { display: 'flex', alignItems: 'center', gap: '20px' };
const refreshBtn = { background: '#FFF', border: '1px solid #E9ECEF', width: '45px', height: '45px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const userBadge = { display: 'flex', alignItems: 'center', gap: '10px' };
const avatar = { width: '45px', height: '45px', borderRadius: '12px', background: '#000', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 };

const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '25px', marginBottom: '50px' };
const statCard = { background: '#FFF', padding: '30px', borderRadius: '24px', border: '1px solid #E9ECEF', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };
const statLabel = { fontSize: '11px', fontWeight: 800, color: '#ADB5BD', letterSpacing: '1px', marginBottom: '15px' };
const statValue = { fontSize: '24px', fontWeight: 900, margin: 0 };
const statTrend = { fontSize: '11px', color: '#6C757D', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px' };

const viewContainer = { animation: 'fadeIn 0.3s ease' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const viewTitle = { fontSize: '20px', fontWeight: 800 };
const primaryBtn = { background: '#000', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' };
const secBtn = { background: '#F8F9FA', color: '#000', border: '1px solid #E9ECEF', padding: '8px 16px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' };

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const eventCard = { background: '#FFF', borderRadius: '24px', border: '1px solid #E9ECEF', overflow: 'hidden', transition: '0.3s transform' };
const eventImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#EEE', borderBottom: '1px solid #E9ECEF' });
const eventBody = { padding: '25px' };
const eventTitle = { fontSize: '18px', fontWeight: 800, margin: '0 0 15px' };
const eventMeta = { fontSize: '13px', color: '#6C757D', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' };
const cardFooter = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' };
const manageBtn = { background: '#F8F9FA', border: '1px solid #E9ECEF', padding: '8px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };
const salesBadge = { background: '#E7F5FF', color: '#228BE6', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 };

const compBox = { background: '#FFF', padding: '40px', borderRadius: '30px', border: '1px solid #E9ECEF', marginBottom: '40px' };
const compHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '1px solid #F1F3F5', paddingBottom: '30px' };
const compName = { fontSize: '24px', fontWeight: 800, margin: 0 };
const compDesc = { color: '#6C757D', marginTop: '8px' };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const contestCard = { background: '#F8F9FA', padding: '25px', borderRadius: '20px' };
const contestHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const contestTitle = { fontSize: '16px', fontWeight: 800, margin: 0 };
const priceTag = { fontSize: '12px', fontWeight: 700, color: '#40C057' };
const candidateList = { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' };
const candRow = { display: 'flex', alignItems: 'center', gap: '12px', background: '#FFF', padding: '12px', borderRadius: '12px' };
const candAvatar = (url) => ({ width: '32px', height: '32px', borderRadius: '8px', background: url ? `url(${url}) center/cover` : '#EEE' });
const candName = { flex: 1, fontSize: '13px', fontWeight: 600 };
const voteCount = { fontSize: '12px', fontWeight: 700, color: '#6366f1' };
const addCandBtn = { width: '100%', background: 'none', border: '1px dashed #CED4DA', padding: '10px', borderRadius: '10px', color: '#6C757D', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' };

const table = { width: '100%', background: '#FFF', borderRadius: '24px', border: '1px solid #E9ECEF', overflow: 'hidden' };
const tableHead = { display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr', padding: '20px 30px', background: '#F8F9FA', fontWeight: 700, color: '#495057', fontSize: '13px' };
const tableRow = { display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr', padding: '20px 30px', borderBottom: '1px solid #F8F9FA', alignItems: 'center', fontSize: '14px' };
const bold = { fontWeight: 700 };
const badge = { background: '#F1F3F5', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 };
const scanned = { color: '#40C057', fontWeight: 700 };
const pending = { color: '#FAB005', fontWeight: 700 };

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#FFF', width: '480px', borderRadius: '30px', padding: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { fontSize: '20px', fontWeight: 800, margin: 0 };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const label = { fontSize: '13px', fontWeight: 700, color: '#495057' };
const input = { padding: '14px', borderRadius: '12px', border: '1px solid #E9ECEF', background: '#F8F9FA', outline: 'none' };
const textarea = { padding: '14px', borderRadius: '12px', border: '1px solid #E9ECEF', background: '#F8F9FA', outline: 'none', minHeight: '100px', resize: 'none' };
const submitBtn = { background: '#000', color: '#FFF', border: 'none', padding: '16px', borderRadius: '14px', fontWeight: 700, cursor: 'pointer' };
const skeletonCanvas = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
