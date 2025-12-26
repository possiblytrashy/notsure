"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase'; // Standard build-safe client
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap, TrendingUp, Users, 
  BarChart3, ArrowUpRight, Filter, DownloadCloud,
  Eye, MousePointer2, Share2, Star, Clock, Trash2, Edit3
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE STATE ---
  const [activeTab, setActiveTab] = useState('events'); // Events was first in the 710-line flow
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
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
  
  // Payout/Onboarding State
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false
  });

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

      // Fetch Profile & Parallel Data
      const [profileRes, eventsRes, contestsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
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
      console.error("Critical Dashboard Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 4. COMPUTED ANALYTICS (95/5 INTEGRATED) ---
  const stats = useMemo(() => {
    const totalGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const totalVotes = data.contests.reduce((acc, c) => 
      acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0);
    
    return {
      totalGross,
      organizerShare: totalGross * 0.95,
      platformFee: totalGross * 0.05,
      ticketCount: data.tickets.length,
      activeEvents: data.events.length,
      totalVotes,
      avgTicketValue: data.tickets.length ? totalGross / data.tickets.length : 0
    };
  }, [data]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => {
      const matchesSearch = t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                            t.reference?.toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
      return matchesSearch && matchesEvent;
    });
  }, [data.tickets, ticketSearch, selectedEventFilter]);

  // --- 5. ACTION HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const copyLink = (path, id) => {
    const url = `${window.location.origin}/${path}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const saveOnboardingDetails = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
      }).eq('id', data.profile.id);
      if (error) throw error;
      setShowSettingsModal(false);
      loadDashboardData(true);
    } catch (err) {
      alert("Update failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div style={fullPageCenter}>
      <Loader2 className="animate-spin" size={48} color="#0ea5e9"/>
      <h2 style={{marginTop: '24px', fontWeight: 950, letterSpacing: '-1.5px'}}>INITIALIZING OUSTED...</h2>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* HEADER SECTION */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               {paystackConfig.subaccountCode ? <ShieldCheck size={12}/> : <AlertCircle size={12}/>}
               {paystackConfig.subaccountCode ? 'SPLITS ACTIVE' : 'COMPLETE ONBOARDING'}
             </div>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={20} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={20}/>
           </button>
        </div>
      </div>

      {/* FINANCE HERO (95/5 SPLIT FOCUS) */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <p style={financeLabel}>YOUR EARNINGS (95% SHARE)</p>
            <div style={iconCircleLarge}><Wallet size={28} color="#0ea5e9"/></div>
          </div>
          <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={statsRow}>
            <div style={miniStat}><TrendingUp size={14}/> <span>Payouts automated</span></div>
            <div style={autoPayoutTag}><Zap size={14} fill="#0ea5e9"/> Paystack Subaccount Active</div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Settings size={18}/> Update Bank Details
          </button>
        </div>

        <div style={quickStatsGrid}>
          <div style={glassStatCard}>
            <Ticket size={20} color="#0ea5e9"/>
            <p style={statLabel}>TICKETS SOLD</p>
            <h3 style={statVal}>{stats.ticketCount}</h3>
          </div>
          <div style={glassStatCard}>
            <Users size={20} color="#8b5cf6"/>
            <p style={statLabel}>TOTAL VOTES</p>
            <h3 style={statVal}>{stats.totalVotes.toLocaleString()}</h3>
          </div>
          <div style={glassStatCard}>
            <BarChart3 size={20} color="#f59e0b"/>
            <p style={statLabel}>AVG. REVENUE</p>
            <h3 style={statVal}>GHS {stats.avgTicketValue.toFixed(2)}</h3>
          </div>
          <div style={glassStatCard}>
            <Calendar size={20} color="#ec4899"/>
            <p style={statLabel}>EVENTS LIVE</p>
            <h3 style={statVal}>{stats.activeEvents}</h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS (Strict Order: Events -> Sales -> Contests -> Analytics) */}
      <div style={tabBar}>
        {['events', 'sales', 'contests', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* VIEWPORT AREA */}
      <div style={viewPort}>
        
        {/* 1. EVENTS VIEW (Management First) */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Management</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={20}/> NEW EVENT
              </button>
            </div>
            <div style={cardGrid}>
              {data.events.map(event => (
                <div key={event.id} style={itemCard}>
                  <div style={itemImage(event.images?.[0])}>
                    <div style={cardQuickActions}>
                      <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                        {copying === event.id ? <Check size={14} color="#22c55e"/> : <LinkIcon size={14}/>}
                      </button>
                      <button style={miniAction} onClick={() => setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/events/${event.id}`)}>
                        <QrCode size={14}/>
                      </button>
                    </div>
                  </div>
                  <div style={itemBody}>
                    <h3 style={itemTitle}>{event.title}</h3>
                    <div style={itemMeta}>
                      <span style={metaLine}><Calendar size={14}/> {new Date(event.date).toLocaleDateString()}</span>
                      <span style={metaLine}><MapPin size={14}/> {event.location}</span>
                    </div>
                    <div style={cardActionRow}>
                      <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                        SALES LEDGER
                      </button>
                      <button style={editBtnCircle}><Edit3 size={18}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. SALES LEDGER VIEW */}
        {activeTab === 'sales' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
              <h2 style={viewTitle}>Sales Ledger</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input style={searchInputField} placeholder="Guest or Ref..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
                </div>
                <select style={eventDropdown} value={selectedEventFilter} onChange={(e) => setSelectedEventFilter(e.target.value)}>
                  <option value="all">All Events</option>
                  {data.events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
            </div>
            <div style={tableWrapper}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableTh}>GUEST / REF</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>GROSS (100%)</th>
                    <th style={tableTh}>NET (95%)</th>
                    <th style={tableTh}>DATE</th>
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
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd} style={{fontWeight: 900, color: '#16a34a'}}>
                        GHS {(t.amount * 0.95).toFixed(2)}
                      </td>
                      <td style={tableTd}>{new Date(t.created_at).toLocaleDateString()}</td>
                      <td style={tableTd}>
                        {t.is_scanned ? <span style={scannedPill}>USED</span> : <span style={activePill}>VALID</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. CONTESTS VIEW (With Candidate Management Flow) */}
        {activeTab === 'contests' && (
          <div style={fadeAnim}>
             <div style={sectionTitleRow}>
                <h2 style={viewTitle}>Contest Management</h2>
                <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={20}/> NEW CATEGORY
                </button>
             </div>
             <div style={contestGrid}>
                {data.contests.map(contest => {
                  const sortedCandidates = [...(contest.candidates || [])].sort((a,b) => b.vote_count - a.vote_count);
                  return (
                    <div key={contest.id} style={contestCard}>
                       <div style={contestHeader}>
                          <div>
                            <h3 style={{margin:0}}>{contest.title}</h3>
                            <p style={perfSub}>{contest.candidates?.length} Candidates</p>
                          </div>
                          <button style={miniAction} onClick={() => router.push(`/dashboard/organizer/contests/${contest.id}`)}><Plus size={16}/></button>
                       </div>
                       <div style={candidateList}>
                          {sortedCandidates.map((cand, idx) => (
                            <div key={cand.id} style={candidateRow}>
                               <span style={rankNum}>#{idx + 1}</span>
                               <div style={candInfo}>
                                  <p style={candName}>{cand.name}</p>
                                  <p style={candVotes}>{cand.vote_count} votes</p>
                               </div>
                               <div style={voteBarContainer}>
                                  <div style={voteBarFill(idx === 0 ? 100 : (cand.vote_count / sortedCandidates[0].vote_count) * 100)}></div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {/* 4. ANALYTICS VIEW (Bottom of flow) */}
        {activeTab === 'analytics' && (
          <div style={fadeAnim}>
             <div style={sectionTitleRow}>
                <h2 style={viewTitle}>Performance Insights</h2>
                <button style={outlineBtn}><DownloadCloud size={16}/> EXPORT REPORT</button>
             </div>
             <div style={analyticsGrid}>
                {data.events.map(event => {
                  const eventSales = data.tickets.filter(t => t.event_id === event.id);
                  const revenue = eventSales.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
                  return (
                    <div key={event.id} style={eventPerformanceCard}>
                       <div style={perfHeader}>
                          <h4 style={perfName}>{event.title}</h4>
                          <span style={perfTag}>LIVE</span>
                       </div>
                       <div style={perfMain}>
                          <p style={perfLabel}>Total Revenue Generated</p>
                          <h3 style={perfValue}>GHS {revenue.toLocaleString()}</h3>
                          <p style={{fontSize: '12px', color: '#16a34a', fontWeight: 700}}>
                            Your Share: GHS {(revenue * 0.95).toLocaleString()}
                          </p>
                       </div>
                       <div style={perfFooter}>
                          <div style={{display: 'flex', justifyContent: 'space-between'}}>
                             <span>Sales Capacity</span>
                             <span>{eventSales.length} Tickets</span>
                          </div>
                          <div style={progressBar}><div style={progressFill(65)}></div></div>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}
      </div>

      {/* SETTINGS MODAL (Onboarding) */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Settings</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={onboardingPromo}>
              <Zap size={24} color="#0ea5e9"/>
              <p>Configure your bank account for automated 95/5 payouts via Paystack.</p>
            </div>
            <div style={modalBody}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS NAME</label>
                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>SETTLEMENT NETWORK</label>
                <select style={modalInput} value={paystackConfig.bankCode} onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}>
                  <option value="">Select Bank</option>
                  <option value="MTN">MTN MoMo</option>
                  <option value="VOD">Vodafone Cash</option>
                  <option value="058">GT Bank</option>
                </select>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>ACCOUNT NUMBER</label>
                <input style={modalInput} value={paystackConfig.accountNumber} onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}/>
              </div>
              <button style={actionSubmitBtn(isProcessing)} onClick={saveOnboardingDetails} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="animate-spin"/> : 'SAVE PAYOUT DETAILS'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES (Luxury Theme Restored) ---
const mainWrapper = { padding: '40px 20px', maxWidth: '1440px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' };
const logoText = { fontSize: '28px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '8px', verticalAlign: 'middle', marginLeft: '10px' };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 600, color: '#64748b' };
const onboardingBadge = (onboarded) => ({ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: onboarded ? '#16a34a' : '#e11d48', marginTop: '4px' });
const circleAction = { width: '48px', height: '48px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '48px', height: '48px', borderRadius: '15px', border: 'none', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: '24px', marginBottom: '50px' };
const balanceCard = { background: '#000', borderRadius: '35px', padding: '40px', color: '#fff', position: 'relative', overflow: 'hidden' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const financeLabel = { fontSize: '12px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px' };
const iconCircleLarge = { width: '60px', height: '60px', borderRadius: '20px', background: 'rgba(14, 165, 233, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const balanceValue = { fontSize: '54px', fontWeight: 950, margin: '20px 0', letterSpacing: '-2px' };
const statsRow = { display: 'flex', gap: '20px', alignItems: 'center' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#16a34a' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#0ea5e9', fontWeight: 600 };
const settingsIconBtn = { marginTop: '30px', padding: '14px 24px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '14px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' };
const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '28px', borderRadius: '30px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const statLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', margin: '0 0 5px' };
const statVal = { fontSize: '28px', fontWeight: 900, margin: 0 };
const tabBar = { display: 'flex', gap: '40px', borderBottom: '1px solid #e2e8f0', marginBottom: '50px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '14px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '4px solid #0ea5e9' : '4px solid transparent' });
const viewPort = { minHeight: '600px' };
const fadeAnim = { animation: 'fadeIn 0.5s ease-out' };
const sectionTitleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const outlineBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };
const analyticsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' };
const eventPerformanceCard = { background: '#fff', borderRadius: '28px', padding: '30px', border: '1px solid #e2e8f0' };
const perfHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '25px' };
const perfName = { margin: 0, fontSize: '18px', fontWeight: 800 };
const perfTag = { background: '#000', color: '#fff', padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const perfMain = { marginBottom: '30px' };
const perfLabel = { fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 };
const perfValue = { fontSize: '28px', fontWeight: 900, margin: 0 };
const perfFooter = { display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600 };
const progressBar = { height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' };
const progressFill = (w) => ({ width: `${w}%`, height: '100%', background: '#0ea5e9' });
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const viewTitle = { margin: 0, fontSize: '26px', fontWeight: 950 };
const addBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const itemCard = { background: '#fff', borderRadius: '30px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const itemImage = (url) => ({ height: '220px', background: url ? `url(${url}) center/cover` : '#f1f5f9', position: 'relative' });
const cardQuickActions = { position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '10px' };
const miniAction = { width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' };
const itemBody = { padding: '30px' };
const itemTitle = { margin: '0 0 15px', fontSize: '20px', fontWeight: 800 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748b', fontWeight: 500 };
const cardActionRow = { display: 'flex', gap: '10px' };
const fullWidthBtn = { flex: 1, background: '#000', color: '#fff', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' };
const editBtnCircle = { width: '50px', height: '50px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const filterGroup = { display: 'flex', gap: '15px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0 20px' };
const searchInputField = { border: 'none', padding: '14px', outline: 'none', fontSize: '14px', width: '220px' };
const eventDropdown = { border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0 20px', fontSize: '14px', fontWeight: 600, background: '#fff' };
const tableWrapper = { background: '#fff', borderRadius: '30px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '25px', background: '#f8fafc', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' };
const tableTr = { borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '25px', fontSize: '14px', verticalAlign: 'middle' };
const guestBold = { margin: 0, fontWeight: 700, color: '#0f172a' };
const guestMuted = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const scannedPill = { background: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '30px' };
const contestCard = { background: '#fff', borderRadius: '30px', padding: '30px', border: '1px solid #e2e8f0' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' };
const candidateList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const candidateRow = { display: 'grid', gridTemplateColumns: '40px 1.2fr 150px', alignItems: 'center', gap: '20px' };
const rankNum = { fontWeight: 950, color: '#cbd5e1', fontSize: '16px' };
const candInfo = { overflow: 'hidden' };
const candName = { margin: 0, fontWeight: 700, fontSize: '15px' };
const candVotes = { margin: 0, fontSize: '12px', color: '#64748b' };
const voteBarContainer = { height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' };
const voteBarFill = (w) => ({ width: `${w}%`, height: '100%', background: '#f59e0b', borderRadius: '10px' });
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '90%', maxWidth: '500px', borderRadius: '40px', padding: '45px' };
const modalHead = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const modalTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const onboardingPromo = { background: '#f0f9ff', padding: '25px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '35px' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '25px' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '10px' };
const fieldLabel = { fontSize: '11px', fontWeight: 800, color: '#64748b', marginLeft: '5px' };
const modalInput = { padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' };
const actionSubmitBtn = (disabled) => ({ background: disabled ? '#94a3b8' : '#000', color: '#fff', padding: '18px', borderRadius: '18px', border: 'none', fontWeight: 800, fontSize: '15px', cursor: 'pointer', marginTop: '10px' });
const perfSub = { margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' };
