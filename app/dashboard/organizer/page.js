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
  BarChart, PieChart, CreditCard, Layout
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE STATE ---
  const [activeTab, setActiveTab] = useState('events'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], // NEW: Grand Competitions
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

  // --- 3. DATA ENGINE (NESTED FETCH) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

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
      console.error("Critical Dashboard Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 4. COMPUTED ANALYTICS ---
  const stats = useMemo(() => {
    const ticketGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    
    // Calculate Vote Revenue from Nested Structure
    let totalVotes = 0;
    let voteGross = 0;
    data.competitions.forEach(comp => {
      comp.contests?.forEach(ct => {
        const cVotes = ct.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0;
        totalVotes += cVotes;
        voteGross += (cVotes * (ct.vote_price || 0));
      });
    });

    const totalGross = ticketGross + voteGross;
    const scannedCount = data.tickets.filter(t => t.is_scanned).length;
    
    return {
      totalGross,
      organizerShare: totalGross * 0.95,
      platformFee: totalGross * 0.05,
      ticketCount: data.tickets.length,
      activeEvents: data.events.length,
      totalVotes,
      avgTicketValue: data.tickets.length ? ticketGross / data.tickets.length : 0,
      checkInRate: data.tickets.length ? Math.round((scannedCount / data.tickets.length) * 100) : 0
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
      alert("Update failed. Please check your connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addCandidate = async (contestId) => {
    if (!newCandidate.name) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('candidates').insert([
        { contest_id: contestId, name: newCandidate.name, image_url: newCandidate.image_url, vote_count: 0 }
      ]);
      if (error) throw error;
      setNewCandidate({ name: '', image_url: '' });
      setShowCandidateModal(null);
      loadDashboardData(true);
    } catch (err) {
      alert("Failed to add candidate.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div style={fullPageCenter}>
      <div style={shimmerLogo}>OUSTED</div>
      <Loader2 className="animate-spin" size={32} color="#000"/>
      <p style={loadingText}>PREPARING YOUR LUXURY DASHBOARD...</p>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* HEADER SECTION */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgeLuxury}>ORGANIZER</span></h1>
          <p style={subLabel}>System v2.0 • Luxury Event Management</p>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               <div style={dot(paystackConfig.subaccountCode)}></div>
               {paystackConfig.subaccountCode ? 'PAYSTACK SPLITS ACTIVE (95/5)' : 'PENDING ONBOARDING'}
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

      {/* FINANCE HERO */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={balanceInfo}>
              <p style={financeLabel}>YOUR EARNINGS (95% SHARE)</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={iconCircleGold}><Sparkles size={24} color="#d4af37"/></div>
          </div>
          <div style={statsRow}>
            <div style={miniStat}><TrendingUp size={14}/> <span>Payouts automated</span></div>
            <div style={autoPayoutTag}><Zap size={14} fill="#0ea5e9"/> Paystack Subaccount {paystackConfig.subaccountCode ? 'Active' : 'Missing'}</div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={16}/> SETTINGS & BANK SETUP
          </button>
        </div>

        <div style={quickStatsGrid}>
          <div style={glassStatCard}>
            <div style={glassHeader}><Ticket size={20} color="#0ea5e9"/><span style={statPercent}>+12%</span></div>
            <p style={statLabel}>TICKETS SOLD</p>
            <h3 style={statVal}>{stats.ticketCount}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><Users size={20} color="#8b5cf6"/><span style={statPercent}>Hot</span></div>
            <p style={statLabel}>TOTAL VOTES</p>
            <h3 style={statVal}>{stats.totalVotes.toLocaleString()}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><BarChart3 size={20} color="#f59e0b"/><span style={statPercent}>Active</span></div>
            <p style={statLabel}>AVG. TICKET VALUE</p>
            <h3 style={statVal}>GHS {stats.avgTicketValue.toFixed(2)}</h3>
          </div>
          <div style={glassStatCard}>
            <div style={glassHeader}><ShieldCheck size={20} color="#16a34a"/><span style={statPercent}>{stats.checkInRate}%</span></div>
            <p style={statLabel}>CHECK-IN RATE</p>
            <h3 style={statVal}>{stats.checkInRate}%</h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={tabBar}>
        {['events', 'sales', 'competitions', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* VIEWPORT AREA */}
      <div style={viewPort}>
        
        {/* 1. EVENTS VIEW */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Event Portfolio</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={18}/> CREATE NEW EVENT
              </button>
            </div>
            <div style={cardGrid}>
              {data.events.map(event => (
                <div key={event.id} style={itemCard}>
                  <div style={itemImage(event.images?.[0])}>
                    <div style={imageOverlay}>
                      <div style={cardQuickActions}>
                        <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                          {copying === event.id ? <Check size={14} color="#22c55e"/> : <LinkIcon size={14}/>}
                        </button>
                        <button style={miniAction} onClick={() => setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/events/${event.id}`)}>
                          <QrCode size={14}/>
                        </button>
                      </div>
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
              {data.events.length === 0 && <div style={emptyState}>No events created yet.</div>}
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
                <button style={outlineBtn}><Download size={16}/> EXPORT CSV</button>
              </div>
            </div>
            <div style={tableWrapper}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableTh}>GUEST / REFERENCE</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>GROSS (100%)</th>
                    <th style={tableTh}>YOUR NET (95%)</th>
                    <th style={tableTh}>STATUS</th>
                    <th style={tableTh}>DATE</th>
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
                      <td style={tableTd}>
                        {t.is_scanned ? <span style={scannedPill}>CHECKED IN</span> : <span style={activePill}>VALID</span>}
                      </td>
                      <td style={tableTd}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTickets.length === 0 && <div style={emptyTableState}>No sales records found.</div>}
            </div>
          </div>
        )}

        {/* 3. COMPETITIONS VIEW (NESTED) */}
        {activeTab === 'competitions' && (
          <div style={fadeAnim}>
             <div style={sectionTitleRow}>
                <h2 style={viewTitle}>Grand Competitions</h2>
                <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={20}/> NEW GRAND COMPETITION
                </button>
             </div>
             <div style={contestGrid}>
                {data.competitions.map(comp => (
                  <div key={comp.id} style={contestCard}>
                     <div style={contestHeader}>
                        <h3 style={{margin:0, fontSize: '18px', fontWeight: 900}}>{comp.title}</h3>
                        <div style={badgeLuxury}>NESTED</div>
                     </div>
                     <div style={nestedCategoryList}>
                        {comp.contests?.map(ct => (
                          <div key={ct.id} style={categoryRow}>
                             <div style={catHeader}>
                                <p style={catTitle}>{ct.title}</p>
                                <button style={miniAction} onClick={() => setShowCandidateModal(ct)}>
                                   <UserPlus size={16}/>
                                </button>
                             </div>
                             <div style={candidateScroll}>
                                {ct.candidates?.map(cand => (
                                  <div key={cand.id} style={miniCandCard}>
                                     <p style={candName}>{cand.name}</p>
                                     <p style={candVotes}>{cand.vote_count} Votes</p>
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
      </div>

      {/* --- MODALS --- */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Config</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={onboardingPromo}>
              <CreditCard size={20} color="#0ea5e9"/>
              <p style={{margin:0, fontSize: '13px'}}>Ensure bank details match your Paystack dashboard for 95% automated settlement.</p>
            </div>
            <div style={modalBody}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS LEGAL NAME</label>
                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})} placeholder="e.g. Ousted Events Ltd"/>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>SETTLEMENT DESTINATION</label>
                <select style={modalInput} value={paystackConfig.bankCode} onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}>
                  <option value="">Select Network</option>
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="VOD">Telecel (Vodafone) Cash</option>
                  <option value="058">GT Bank</option>
                  <option value="044">Access Bank</option>
                </select>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>ACCOUNT / WALLET NUMBER</label>
                <input style={modalInput} value={paystackConfig.accountNumber} onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})} placeholder="055XXXXXXX"/>
              </div>
              <button style={actionSubmitBtn(isProcessing)} onClick={saveOnboardingDetails} disabled={isProcessing}>
                {isProcessing ? 'UPDATING...' : 'CONFIRM SETTINGS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCandidateModal && (
        <div style={overlay} onClick={() => setShowCandidateModal(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Add Candidate</h2>
              <button style={closeBtn} onClick={() => setShowCandidateModal(null)}><X size={20}/></button>
            </div>
            <p style={{fontSize: '13px', color: '#64748b', marginBottom: '20px'}}>Adding to: <strong>{showCandidateModal.title}</strong></p>
            <div style={modalBody}>
               <div style={inputStack}>
                  <label style={fieldLabel}>FULL NAME</label>
                  <input style={modalInput} value={newCandidate.name} onChange={(e) => setNewCandidate({...newCandidate, name: e.target.value})} placeholder="Candidate Name"/>
               </div>
               <div style={inputStack}>
                  <label style={fieldLabel}>IMAGE URL (OPTIONAL)</label>
                  <input style={modalInput} value={newCandidate.image_url} onChange={(e) => setNewCandidate({...newCandidate, image_url: e.target.value})} placeholder="https://..."/>
               </div>
               <button style={actionSubmitBtn(isProcessing)} onClick={() => addCandidate(showCandidateModal.id)} disabled={isProcessing}>
                  {isProcessing ? 'ADDING...' : 'ADD TO CONTEST'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
               <h2 style={modalTitle}>Portal QR</h2>
               <button style={closeBtn} onClick={() => setShowQR(null)}><X size={20}/></button>
            </div>
            <div style={{display: 'flex', justifyContent: 'center', padding: '20px'}}>
              <img src={showQR} alt="QR Code" style={{width: '250px', height: '250px', borderRadius: '20px'}} />
            </div>
            <p style={{textAlign: 'center', fontSize: '12px', color: '#64748b'}}>Scan this to open the event portal.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- FULL STYLES OBJECT ---
const mainWrapper = { padding: '50px 30px', maxWidth: '1440px', margin: '0 auto', background: '#fcfcfc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const shimmerLogo = { fontSize: '32px', fontWeight: 950, letterSpacing: '-2px', marginBottom: '10px' };
const loadingText = { fontSize: '12px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' };
const logoText = { fontSize: '30px', fontWeight: 950, letterSpacing: '-2px', margin: 0 };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px' };
const subLabel = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' };
const headerActions = { display: 'flex', gap: '20px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700, color: '#000' };
const onboardingBadge = (on) => ({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 800, color: on ? '#16a34a' : '#e11d48', marginTop: '6px' });
const dot = (on) => ({ width: '6px', height: '6px', borderRadius: '50%', background: on ? '#16a34a' : '#e11d48' });
const circleAction = { width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.4fr 2fr', gap: '30px', marginBottom: '60px' };
const balanceCard = { background: '#000', borderRadius: '30px', padding: '50px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const balanceInfo = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px' };
const balanceValue = { fontSize: '56px', fontWeight: 950, margin: '20px 0', letterSpacing: '-3px' };
const iconCircleGold = { width: '64px', height: '64px', borderRadius: '22px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statsRow = { display: 'flex', gap: '25px', marginBottom: '30px' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#16a34a' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0ea5e9', fontWeight: 600 };
const settingsIconBtn = { padding: '15px 30px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start' };
const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '30px', borderRadius: '25px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' };
const glassHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const statPercent = { fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px' };
const statLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', margin: '0 0 8px', letterSpacing: '1px' };
const statVal = { fontSize: '28px', fontWeight: 950, margin: 0, color: '#000' };
const tabBar = { display: 'flex', gap: '45px', borderBottom: '1px solid #eee', marginBottom: '60px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '4px solid #000' : '4px solid transparent', transition: '0.3s' });
const viewPort = { minHeight: '600px' };
const fadeAnim = { animation: 'fadeIn 0.6s ease' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const sectionTitleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const itemCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const itemImage = (url) => ({ height: '240px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imageOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))' };
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' };
const miniAction = { width: '40px', height: '40px', borderRadius: '12px', background: '#fff', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 12px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748b', fontWeight: 600 };
const cardActionRow = { display: 'flex', gap: '10px' };
const fullWidthBtn = { flex: 1, background: '#f5f5f5', color: '#000', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };
const editBtnCircle = { width: '48px', height: '48px', borderRadius: '12px', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const filterGroup = { display: 'flex', gap: '15px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '0 15px' };
const searchInputField = { border: 'none', padding: '12px', outline: 'none', fontSize: '14px', width: '220px' };
const eventDropdown = { border: '1px solid #eee', borderRadius: '12px', padding: '0 15px', fontWeight: 700, fontSize: '13px' };
const outlineBtn = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderRadius: '12px', border: '1px solid #eee', background: '#fff', fontWeight: 800, fontSize: '12px', cursor: 'pointer' };

// --- TABLE STYLES ---
const tableWrapper = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableTh = { padding: '20px', background: '#fcfcfc', borderBottom: '1px solid #f0f0f0', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const tableTr = { borderBottom: '1px solid #f8f8f8' };
const tableTd = { padding: '20px', fontSize: '13px', color: '#000' };
const guestBold = { margin: 0, fontWeight: 800 };
const guestMuted = { margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' };
const scannedPill = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#eff6ff', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const emptyTableState = { padding: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' };

// --- CONTEST / CANDIDATE STYLES ---
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '30px' };
const contestCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', padding: '30px' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const nestedCategoryList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const categoryRow = { background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '16px', padding: '20px' };
const catHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' };
const catTitle = { margin: 0, fontSize: '14px', fontWeight: 800 };
const candidateScroll = { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' };
const miniCandCard = { minWidth: '120px', background: '#fff', border: '1px solid #eee', padding: '12px', borderRadius: '12px' };
const candName = { margin: 0, fontSize: '12px', fontWeight: 800 };
const candVotes = { margin: '4px 0 0', fontSize: '10px', color: '#0ea5e9', fontWeight: 700 };

// --- MODAL STYLES ---
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '450px', borderRadius: '30px', padding: '40px', position: 'relative' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '20px' };
const onboardingPromo = { background: '#f0f9ff', padding: '15px', borderRadius: '16px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', color: '#0369a1' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const modalInput = { padding: '15px', borderRadius: '12px', border: '1px solid #eee', fontSize: '14px', outline: 'none', fontWeight: 600 };
const actionSubmitBtn = (p) => ({ padding: '18px', background: '#000', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: 800, cursor: p ? 'not-allowed' : 'pointer', fontSize: '14px' });
