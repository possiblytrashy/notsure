"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap, TrendingUp, Users, 
  BarChart3, ArrowUpRight, Filter, DownloadCloud,
  Eye, MousePointer2, Share2, Star, Clock, Trash2, Edit3,
  Layers, Activity, Sparkles, ChevronDown, UserPlus,
  BarChart, PieChart, CreditCard, Layout, Trash, ExternalLink
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE STATE ---
  const [activeTab, setActiveTab] = useState('events'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [showCandidateModal, setShowCandidateModal] = useState(null); 
  
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false
  });

  const [newCandidate, setNewCandidate] = useState({ name: '', image_url: '' });

  // --- 3. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetching profile, events, competitions (with nested contests/candidates), and tickets
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

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        competitions: compsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });

      if (profileRes.data?.paystack_subaccount_code) {
        setPaystackConfig({
          businessName: profileRes.data.business_name || "",
          bankCode: profileRes.data.bank_code || "",
          accountNumber: profileRes.data.account_number || "",
          subaccountCode: profileRes.data.paystack_subaccount_code,
          isVerified: true
        });
      }
    } catch (err) {
      console.error("Dashboard Engine Failure:", err);
    } finally {
      // Small timeout to appreciate the luxury skeletons
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 800);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 4. ACTION HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const copyLink = (type, id) => {
    const url = `${window.location.origin}/${type}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const handleUpdatePayouts = async () => {
    setIsProcessing(true);
    try {
      // In production, this would hit your Edge Function to create/update Paystack subaccount
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
      }).eq('id', data.profile.id);

      if (!error) {
        setShowSettingsModal(false);
        loadDashboardData(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const addCandidate = async (contestId) => {
    if (!newCandidate.name) return alert("Name is required");
    setIsProcessing(true);
    const { error } = await supabase.from('candidates').insert([{
      contest_id: contestId,
      name: newCandidate.name,
      image_url: newCandidate.image_url,
      vote_count: 0
    }]);
    
    if (!error) {
      setNewCandidate({ name: '', image_url: '' });
      setShowCandidateModal(null);
      loadDashboardData(true);
    }
    setIsProcessing(false);
  };

  // --- 5. ANALYTICS & FILTERING ---
  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => {
      const matchesSearch = (t.guest_name || "").toLowerCase().includes(ticketSearch.toLowerCase()) || 
                           (t.reference || "").toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
      return matchesSearch && matchesEvent;
    });
  }, [data.tickets, ticketSearch, selectedEventFilter]);

  const stats = useMemo(() => {
    const ticketGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    let totalVotes = 0;
    let voteGross = 0;
    
    data.competitions.forEach(comp => {
        comp.contests?.forEach(ct => {
            const ctVotes = ct.candidates?.reduce((s, c) => s + (parseInt(c.vote_count) || 0), 0) || 0;
            totalVotes += ctVotes;
            voteGross += (ctVotes * (ct.vote_price || 0));
        });
    });

    const totalGross = ticketGross + voteGross;
    return {
      totalGross,
      organizerShare: totalGross * 0.95,
      platformFee: totalGross * 0.05,
      ticketCount: data.tickets.length,
      voteCount: totalVotes,
      ticketRevenue: ticketGross,
      voteRevenue: voteGross
    };
  }, [data]);

  // --- 6. LUXURY SKELETONS ---
  const SkeletonCard = () => (
    <div style={skeletonCardBase}>
      <div style={skeletonImage}></div>
      <div style={skeletonTextFull}></div>
      <div style={skeletonTextHalf}></div>
    </div>
  );

  const SkeletonTable = () => (
    <div style={skeletonTableBase}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={skeletonTableRow}>
          <div style={skeletonCircle}></div>
          <div style={skeletonTextFull}></div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* 1. HEADER SECTION */}
      <div style={topNav}>
        <div style={brandStack}>
          <h1 style={logoText}>OUSTED <span style={badgeLuxury}>PLATINUM</span></h1>
          <p style={subLabel}>Consolidated Organizer Hub • v2.8.5</p>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email || 'Guest Organizer'}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               <div style={dot(paystackConfig.subaccountCode)}></div>
               {paystackConfig.subaccountCode ? 'PAYOUTS CONFIGURED (5% SPLIT)' : 'PAYMENT SETUP REQUIRED'}
             </div>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* 2. FINANCIAL HERO SECTION */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={balanceInfo}>
              <p style={financeLabel}>NET EARNINGS SETTLEMENT (95%)</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={iconCircleGold}><Sparkles size={24} color="#d4af37"/></div>
          </div>
          <div style={statsRow}>
            <div style={miniStat}><ArrowUpRight size={14}/> <span>Tickets: GHS {stats.ticketRevenue.toFixed(2)}</span></div>
            <div style={{...miniStat, color: '#0ea5e9'}}><Zap size={14}/> <span>Votes: GHS {stats.voteRevenue.toFixed(2)}</span></div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={16}/> SETTINGS & BANK SETUP
          </button>
        </div>

        <div style={quickStatsGrid}>
          <div style={glassStatCard}>
            <div style={statHeader}><Users size={16} color="#94a3b8"/><p style={statLabel}>TOTAL TICKETS</p></div>
            <h3 style={statVal}>{loading ? '...' : stats.ticketCount}</h3>
            <div style={statTrend}><TrendingUp size={12}/> +12% from last week</div>
          </div>
          <div style={glassStatCard}>
             <div style={statHeader}><Award size={16} color="#94a3b8"/><p style={statLabel}>TOTAL VOTES</p></div>
            <h3 style={statVal}>{loading ? '...' : stats.voteCount.toLocaleString()}</h3>
            <div style={statTrend}><TrendingUp size={12}/> High engagement</div>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div style={tabBar}>
        {['events', 'sales', 'competitions', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={viewPort}>
        {/* VIEW 1: EVENTS */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Event Portfolio</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={18}/> CREATE NEW EVENT
              </button>
            </div>
            
            {loading ? (
              <div style={cardGrid}>
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            ) : data.events.length === 0 ? (
              <div style={emptyState}>
                <Calendar size={48} color="#eee" style={{marginBottom: '20px'}}/>
                <h3>No events found</h3>
                <p>Start by creating your first luxury experience.</p>
              </div>
            ) : (
              <div style={cardGrid}>
                {data.events.map(event => (
                  <div key={event.id} style={itemCard}>
                    <div style={itemImage(event.images?.[0])}>
                      <div style={imageOverlay}>
                        <div style={cardQuickActions}>
                          <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                            {copying === event.id ? <Check size={14} color="#16a34a"/> : <LinkIcon size={14}/>}
                          </button>
                          <button style={miniAction} onClick={() => setShowQR(event.id)}>
                             <QrCode size={14}/>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={itemBody}>
                      <div style={itemMeta}>
                        <span style={dateBadge}>{new Date(event.start_date).toLocaleDateString()}</span>
                        <span style={tierBadge}>{event.ticket_tiers?.length || 0} TIERS</span>
                      </div>
                      <h3 style={itemTitle}>{event.title}</h3>
                      <p style={metaLine}><MapPin size={14}/> {event.location}</p>
                      
                      <div style={tierList}>
                        {event.ticket_tiers?.map(tier => (
                          <div key={tier.id} style={tierRow}>
                            <span>{tier.name}</span>
                            <span style={tierPrice}>GHS {tier.price}</span>
                          </div>
                        ))}
                      </div>

                      <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                          VIEW SALES LEDGER
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SALES LEDGER */}
        {activeTab === 'sales' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
              <h2 style={viewTitle}>Transaction Ledger</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input style={searchInputField} placeholder="Search guest or ref..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
                </div>
              </div>
            </div>
            
            {loading ? <SkeletonTable /> : (
              <div style={tableWrapper}>
                <table style={dataTable}>
                  <thead>
                    <tr>
                      <th style={tableTh}>GUEST / REFERENCE</th>
                      <th style={tableTh}>EVENT</th>
                      <th style={tableTh}>GROSS (GHS)</th>
                      <th style={tableTh}>NET (95%)</th>
                      <th style={tableTh}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => (
                      <tr key={t.id} style={tableTr}>
                        <td style={tableTd}>
                          <p style={guestBold}>{t.guest_name}</p>
                          <p style={guestMuted}>{t.reference}</p>
                        </td>
                        <td style={tableTd}>{t.events?.title}</td>
                        <td style={tableTd}>{t.amount}</td>
                        <td style={{...tableTd, fontWeight: 900, color: '#16a34a'}}>{(t.amount * 0.95).toFixed(2)}</td>
                        <td style={tableTd}>{t.is_scanned ? <span style={scannedPill}>USED</span> : <span style={activePill}>VALID</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: COMPETITIONS */}
        {activeTab === 'competitions' && (
           <div style={fadeAnim}>
              <div style={viewHeader}>
                <h2 style={viewTitle}>Global Competitions</h2>
                <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={18}/> NEW COMPETITION
                </button>
              </div>
              
              {data.competitions.map(comp => (
                <div key={comp.id} style={grandCompCard}>
                  <div style={grandHeader}>
                    <h3 style={grandTitle}>{comp.title}</h3>
                    <div style={miniActionGroup}>
                      <button style={iconBtn}><Edit3 size={16}/></button>
                      <button style={iconBtnDelete}><Trash size={16}/></button>
                    </div>
                  </div>
                  <div style={nestedContestGrid}>
                    {comp.contests?.map(ct => (
                      <div key={ct.id} style={contestContainer}>
                        <div style={contestHead}>
                          <h4 style={contestTitle}>{ct.title}</h4>
                          <button style={iconBtn} onClick={() => setShowCandidateModal(ct)}><UserPlus size={14}/></button>
                        </div>
                        {ct.candidates?.map(cand => (
                          <div key={cand.id} style={candRow}>
                            <span style={candNameText}>{cand.name}</span>
                            <span style={voteBadge}>{cand.vote_count} Votes</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
           </div>
        )}
      </div>

      {/* 4. MODALS & OVERLAYS */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Settings</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={modalBody}>
               <div style={inputStack}>
                 <label style={fieldLabel}>LEGAL BUSINESS NAME</label>
                 <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
               </div>
               <div style={inputStack}>
                 <label style={fieldLabel}>BANK CODE</label>
                 <input style={modalInput} placeholder="e.g. 058" value={paystackConfig.bankCode} onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}/>
               </div>
               <div style={inputStack}>
                 <label style={fieldLabel}>ACCOUNT NUMBER</label>
                 <input style={modalInput} value={paystackConfig.accountNumber} onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}/>
               </div>
               <div style={alertBox}>
                 <Info size={16} color="#0ea5e9"/>
                 <p style={alertText}>All sales are split automatically. You receive 95%, Platform fee is 5%.</p>
               </div>
               <button style={actionSubmitBtn(isProcessing)} onClick={handleUpdatePayouts} disabled={isProcessing}>
                 {isProcessing ? 'UPDATING...' : 'SAVE SETTINGS'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showCandidateModal && (
        <div style={overlay} onClick={() => setShowCandidateModal(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
             <h2 style={modalTitle}>Add Contestant</h2>
             <div style={{marginTop: '20px'}} className="space-y-4">
                <input style={modalInput} placeholder="Name" value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})}/>
                <input style={modalInput} placeholder="Image URL" value={newCandidate.image_url} onChange={e => setNewCandidate({...newCandidate, image_url: e.target.value})}/>
                <button style={actionSubmitBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)}>ADD TO CATEGORY</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- LUXURY STYLESHEET (PRODUCTION READY) ---
const mainWrapper = { padding: '40px', maxWidth: '1400px', margin: '0 auto', background: '#fcfcfc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const brandStack = { display: 'flex', flexDirection: 'column' };
const logoText = { fontSize: '28px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '9px', padding: '4px 10px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px', fontWeight: 900 };
const subLabel = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600 };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '13px', fontWeight: 700 };
const onboardingBadge = (on) => ({ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', fontWeight: 900, color: on ? '#16a34a' : '#ef4444', marginTop: '4px' });
const dot = (on) => ({ width: '5px', height: '5px', borderRadius: '50%', background: on ? '#16a34a' : '#ef4444' });
const circleAction = { width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

// Finance Components
const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px', marginBottom: '40px' };
const balanceCard = { background: '#000', borderRadius: '24px', padding: '40px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const cardHeader = { display: 'flex', justifyContent: 'space-between' };
const balanceInfo = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const balanceValue = { fontSize: '48px', fontWeight: 950, margin: '15px 0', letterSpacing: '-2px' };
const iconCircleGold = { width: '50px', height: '50px', borderRadius: '15px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statsRow = { display: 'flex', gap: '20px', marginBottom: '25px' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#16a34a' };
const settingsIconBtn = { padding: '12px 20px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '11px', alignSelf: 'flex-start' };

const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '25px', borderRadius: '24px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const statHeader = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' };
const statLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8' };
const statVal = { fontSize: '32px', fontWeight: 950, margin: 0 };
const statTrend = { fontSize: '11px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px' };

// Tabs
const tabBar = { display: 'flex', gap: '30px', borderBottom: '1px solid #eee', marginBottom: '40px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '12px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '3px solid #000' : '3px solid transparent' });

const viewPort = { minHeight: '500px' };
const fadeAnim = { animation: 'fadeIn 0.5s ease-in-out' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const viewTitle = { margin: 0, fontSize: '22px', fontWeight: 950 };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' };

// Event Cards
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' };
const itemCard = { background: '#fff', borderRadius: '20px', border: '1px solid #f0f0f0', overflow: 'hidden', transition: 'all 0.3s ease' };
const itemImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imageOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))' };
const cardQuickActions = { position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' };
const miniAction = { width: '36px', height: '36px', borderRadius: '10px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '24px' };
const itemMeta = { display: 'flex', gap: '10px', marginBottom: '12px' };
const dateBadge = { background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, color: '#64748b' };
const tierBadge = { background: '#fffbeb', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 900, color: '#b45309' };
const itemTitle = { margin: '0 0 10px', fontSize: '18px', fontWeight: 900 };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginBottom: '20px' };
const tierList = { marginBottom: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' };
const tierRow = { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' };
const tierPrice = { color: '#000', fontWeight: 900 };
const fullWidthBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };

// Table
const tableWrapper = { background: '#fff', borderRadius: '20px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableTh = { padding: '15px 20px', background: '#f8fafc', fontSize: '10px', fontWeight: 900, color: '#94a3b8' };
const tableTr = { borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '15px 20px', fontSize: '13px' };
const guestBold = { margin: 0, fontWeight: 800 };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8' };
const scannedPill = { background: '#f1f5f9', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };

// Search & Filters
const filterGroup = { display: 'flex', gap: '15px' };
const searchBox = { position: 'relative', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '0 15px' };
const searchInputField = { border: 'none', padding: '12px', outline: 'none', fontSize: '13px', fontWeight: 600, width: '250px' };

// Modals
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '420px', borderRadius: '30px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { margin: 0, fontSize: '20px', fontWeight: 950 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldLabel = { fontSize: '9px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const modalInput = { padding: '14px', borderRadius: '12px', border: '1px solid #eee', fontSize: '14px', outline: 'none', fontWeight: 600, width: '100%' };
const actionSubmitBtn = (p) => ({ padding: '16px', background: '#000', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: p ? 'not-allowed' : 'pointer', fontSize: '13px', width: '100%' });
const alertBox = { padding: '15px', borderRadius: '12px', background: '#f0f9ff', display: 'flex', gap: '10px', alignItems: 'center' };
const alertText = { fontSize: '11px', color: '#0ea5e9', fontWeight: 600, margin: 0 };

// Skeleton Styles
const skeletonCardBase = { height: '350px', background: '#fff', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' };
const skeletonImage = { height: '180px', background: '#f1f5f9', borderRadius: '12px', animation: 'pulse 1.5s infinite' };
const skeletonTextFull = { height: '14px', background: '#f1f5f9', borderRadius: '4px', width: '100%', animation: 'pulse 1.5s infinite' };
const skeletonTextHalf = { height: '14px', background: '#f1f5f9', borderRadius: '4px', width: '60%', animation: 'pulse 1.5s infinite' };
const skeletonTableBase = { background: '#fff', borderRadius: '20px', padding: '20px' };
const skeletonTableRow = { display: 'flex', gap: '15px', padding: '15px 0', borderBottom: '1px solid #f1f5f9' };
const skeletonCircle = { width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9' };

// Empty State
const emptyState = { padding: '100px 40px', textAlign: 'center', background: '#fff', borderRadius: '24px', border: '1px dashed #eee', color: '#94a3b8' };

// Competitions
const grandCompCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', padding: '30px', marginBottom: '30px' };
const grandHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '25px' };
const grandTitle = { margin: 0, fontSize: '20px', fontWeight: 900 };
const nestedContestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' };
const contestContainer = { background: '#fcfcfc', border: '1px solid #f1f5f9', borderRadius: '18px', padding: '20px' };
const contestHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const contestTitle = { margin: 0, fontSize: '14px', fontWeight: 900 };
const candRow = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f8f8f8', fontSize: '12px', fontWeight: 700 };
const candNameText = { color: '#64748b' };
const voteBadge = { color: '#0ea5e9', fontWeight: 900 };
const miniActionGroup = { display: 'flex', gap: '8px' };
const iconBtn = { padding: '6px', borderRadius: '6px', border: '1px solid #eee', background: '#fff', cursor: 'pointer' };
const iconBtnDelete = { padding: '6px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer' };
