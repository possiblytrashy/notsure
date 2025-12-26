"use client";
import { useState, useEffect, useCallback } from 'react';
// IMPORT NOTE: Ensure your supabase client is exported from this path
import { supabase } from '@/lib/supabase'; 
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE DATA STATE ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. FINANCIAL & ANALYTICS STATE ---
  const [stats, setStats] = useState({
    totalGross: 0,
    organizerShare: 0,
    commissionPaid: 0,
    ticketCount: 0,
    activeContests: 0,
    totalVotes: 0
  });

  // --- 3. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", 
    isVerified: false
  });

  // --- 4. THE DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // 2. Parallel Fetch Data
      const [eventsRes, contestsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      // Filter tickets owned by this organizer's events
      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // Calculate Financial Splits (95/5)
      const totalGross = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      
      // Calculate Votes
      const totalVotes = contestsRes.data?.reduce((acc, c) => 
        acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0;

      // Set Stats
      setStats({
        totalGross,
        organizerShare: totalGross * 0.95,
        commissionPaid: totalGross * 0.05,
        ticketCount: myTickets.length,
        activeContests: contestsRes.data?.length || 0,
        totalVotes: totalVotes
      });

      // Set Main Data
      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profile }
      });

      // Set Onboarding Config
      if (profile?.paystack_subaccount_code) {
        setPaystackConfig({
          businessName: profile.business_name || "",
          bankCode: profile.bank_code || "",
          accountNumber: profile.account_number || "",
          subaccountCode: profile.paystack_subaccount_code,
          isVerified: true
        });
      }

    } catch (err) {
      console.error("Dashboard Engine Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 5. ACTION HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
      alert("Details saved! Automated payouts are active.");
      setShowSettingsModal(false);
      loadDashboardData(true);
    } catch (err) {
      alert("Error updating details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyLink = (path, id) => {
    const url = `${window.location.origin}/${path}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const filteredTickets = data.tickets.filter(t => {
    const searchStr = ticketSearch.toLowerCase();
    const matchesSearch = t.guest_name?.toLowerCase().includes(searchStr) || 
                          t.reference?.toLowerCase().includes(searchStr);
    const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
    return matchesSearch && matchesEvent;
  });

  if (loading) return (
    <div style={fullPageCenter}>
      <Loader2 className="animate-spin" size={48} color="#0ea5e9"/>
      <h2 style={{marginTop: '24px', fontWeight: 900, letterSpacing: '-1px'}}>SECURE ACCESS...</h2>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* HEADER */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               {paystackConfig.subaccountCode ? <ShieldCheck size={12}/> : <AlertCircle size={12}/>}
               {paystackConfig.subaccountCode ? 'SPLITS ACTIVE' : 'ONBOARDING REQUIRED'}
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

      {/* FINANCE SECTION */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <p style={financeLabel}>YOUR 95% SHARE</p>
              <h2 style={balanceValue}>GHS {(stats.organizerShare || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              <div style={autoPayoutTag}>
                <Zap size={14} fill="#0ea5e9"/> Automated by Paystack
              </div>
            </div>
            <div style={iconCircleLarge}><Wallet size={32} color="#0ea5e9"/></div>
          </div>
          
          <div style={financeActionRow}>
            <div style={miniStatSplit}>
               <span style={miniLabel}>GROSS SALES</span>
               <span style={miniValue}>GHS {(stats.totalGross || 0).toLocaleString()}</span>
            </div>
            <div style={miniStatSplit}>
               <span style={miniLabel}>5% FEE</span>
               <span style={miniValue}>GHS {(stats.commissionPaid || 0).toLocaleString()}</span>
            </div>
            <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
              <Settings size={20}/>
            </button>
          </div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <div>
              <p style={statLabel}>TICKETS</p>
              <p style={statNumber}>{stats.ticketCount || 0}</p>
            </div>
            <Ticket size={24} color="#0ea5e9"/>
          </div>
          <div style={statBox}>
            <div>
              <p style={statLabel}>VOTES</p>
              <p style={statNumber}>{(stats.totalVotes || 0).toLocaleString()}</p>
            </div>
            <Award size={24} color="#f59e0b"/>
          </div>
          {!paystackConfig.subaccountCode && (
            <div style={alertBox} onClick={() => setShowSettingsModal(true)}>
              <Info size={18}/>
              <span>Setup Payouts to receive 95% share</span>
              <ChevronRight size={18}/>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={tabBar}>
        <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>
          <Calendar size={18}/> EVENTS
        </button>
        <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>
          <History size={18}/> SALES LEDGER
        </button>
        <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}>
          <Trophy size={18}/> CONTESTS
        </button>
      </div>

      {/* VIEWS */}
      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Your Events</h2>
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
                      <span style={metaLine}><MapPin size={14}/> {event.location || 'Accra'}</span>
                    </div>
                    <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                      VIEW SALES <ChevronRight size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
              <h2 style={viewTitle}>Sales Breakdown</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input style={searchInputField} placeholder="Guest name..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
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
                    <th style={tableTh}>GUEST</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>GROSS</th>
                    <th style={tableTh}>YOUR 95%</th>
                    <th style={tableTh}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={tableTr}>
                      <td style={tableTd}>
                        <p style={guestBold}>{t.guest_name}</p>
                        <p style={guestMuted}>{t.guest_email}</p>
                      </td>
                      <td style={tableTd}>{t.events?.title}</td>
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd} style={{fontWeight: 700, color: '#16a34a'}}>
                        GHS {(t.amount * 0.95).toFixed(2)}
                      </td>
                      <td style={tableTd}>
                        {t.is_scanned ? <span style={scannedPill}>USED</span> : <span style={activePill}>ACTIVE</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <div><h2 style={modalTitle}>Payout Settings</h2></div>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={onboardingPromo}>
              <Zap size={24} color="#0ea5e9"/>
              <p style={{margin: 0, fontSize: '13px'}}>Funds are split 95/5 automatically at point of sale.</p>
            </div>
            <div style={{margin: '25px 0'}}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS NAME</label>
                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>BANK / NETWORK</label>
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
            </div>
            <button style={actionSubmitBtn(isProcessing)} onClick={saveOnboardingDetails} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin"/> : 'SAVE PAYOUT DETAILS'}
            </button>
          </div>
        </div>
      )}

      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={qrContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '20px', fontWeight: 900}}>Share QR Code</h3>
            <div style={qrBorder}><img src={showQR} style={{width: '100%'}} alt="QR"/></div>
            <button style={downloadBtn} onClick={() => window.open(showQR)}>DOWNLOAD</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const mainWrapper = { padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', background: '#fcfdfe', minHeight: '100vh' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const logoText = { fontSize: '24px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', marginLeft: '10px' };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700 };
const circleAction = { width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e11d48' };
const onboardingBadge = (onboarded) => ({ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: onboarded ? '#16a34a' : '#e11d48' });
const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '40px' };
const balanceCard = { background: '#000', borderRadius: '25px', padding: '30px', color: '#fff' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#666' };
const balanceValue = { fontSize: '40px', fontWeight: 950, margin: '10px 0' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0ea5e9', fontWeight: 600 };
const iconCircleLarge = { width: '60px', height: '60px', borderRadius: '20px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const financeActionRow = { display: 'flex', gap: '20px', marginTop: '25px', alignItems: 'center' };
const miniStatSplit = { display: 'flex', flexDirection: 'column' };
const miniLabel = { fontSize: '9px', fontWeight: 800, color: '#666' };
const miniValue = { fontSize: '13px', fontWeight: 700 };
const settingsIconBtn = { marginLeft: 'auto', width: '45px', height: '45px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer' };
const statsOverview = { display: 'grid', gap: '10px' };
const statBox = { background: '#fff', padding: '15px 20px', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statLabel = { margin: 0, fontSize: '11px', fontWeight: 800, color: '#94a3b8' };
const statNumber = { margin: '5px 0 0', fontSize: '20px', fontWeight: 900 };
const alertBox = { background: '#fff1f2', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 700, color: '#e11d48', cursor: 'pointer' };
const tabBar = { display: 'flex', gap: '25px', borderBottom: '1px solid #e2e8f0', marginBottom: '30px' };
const tabItem = (active) => ({ padding: '12px 0', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '3px solid #0ea5e9' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '8px' });
const viewPort = { minHeight: '400px' };
const fadeAnim = { animation: 'fadeIn 0.3s ease-in' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const viewTitle = { margin: 0, fontSize: '22px', fontWeight: 900 };
const addBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' };
const itemCard = { background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const itemImage = (url) => ({ height: '160px', background: url ? `url(${url}) center/cover` : '#f1f5f9', position: 'relative' });
const cardQuickActions = { position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' };
const miniAction = { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '20px' };
const itemTitle = { margin: '0 0 10px', fontSize: '16px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '15px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' };
const fullWidthBtn = { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const filterGroup = { display: 'flex', gap: '10px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 10px' };
const searchInputField = { border: 'none', padding: '10px', outline: 'none', fontSize: '12px' };
const eventDropdown = { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 10px', fontSize: '12px', fontWeight: 600 };
const tableWrapper = { background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '15px', background: '#f8fafc', fontSize: '10px', fontWeight: 800, color: '#94a3b8' };
const tableTr = { borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '15px', fontSize: '13px' };
const guestBold = { margin: 0, fontWeight: 700 };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8' };
const scannedPill = { background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800 };
const activePill = { background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800 };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '25px', padding: '30px' };
const modalHead = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const modalTitle = { margin: 0, fontSize: '18px', fontWeight: 900 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer' };
const onboardingPromo = { background: '#f0f9ff', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px' };
const inputStack = { marginBottom: '15px' };
const fieldLabel = { display: 'block', fontSize: '10px', fontWeight: 800, marginBottom: '5px', color: '#64748b' };
const modalInput = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' };
const actionSubmitBtn = (disabled) => ({ width: '100%', background: disabled ? '#f1f5f9' : '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' });
const qrContent = { background: '#fff', padding: '30px', borderRadius: '25px', textAlign: 'center' };
const qrBorder = { border: '1px solid #f1f5f9', padding: '15px', borderRadius: '15px', marginBottom: '15px' };
const downloadBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800 };
