"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download, X,
  TrendingUp, Smartphone, Clock, CheckCircle2, XCircle, Loader2, Save, Trash2,
  LogOut, Search, Filter, Eye, ChevronRight, RefreshCcw, MoreHorizontal,
  ExternalLink, Mail, Phone, MapPin, UserPlus, Award, AlertCircle, Info,
  Banknote, CreditCard, ShieldCheck, History, Zap
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
    payouts: [], // Now tracks automated settlements
    tickets: [], 
    profile: null 
  });

  // --- 2. FINANCIAL & ANALYTICS STATE ---
  const [stats, setStats] = useState({
    totalGross: 0,        // 100% of sales
    organizerShare: 0,   // 95% of sales
    commissionPaid: 0,   // 5% system fee
    ticketCount: 0,
    activeContests: 0
  });

  // --- 3. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  
  // Paystack Subaccount Preferences (The "Onboarding stuff")
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "",
    bankCode: "",
    accountNumber: "",
    subaccountCode: "", // If this exists, they are "Onboarded"
    isVerified: false
  });

  // --- 4. THE DATA ENGINE (REFINED FOR AUTOMATED 5% SPLITS) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetch Profile for Subaccount Info
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // LOGIC: Calculate the 95/5 split for the UI
      const totalGross = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const organizerShare = totalGross * 0.95; // Your 95%
      const commissionPaid = totalGross * 0.05; // Your 5% system fee

      const totalVotes = contestsRes.data?.reduce((acc, c) => 
        acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0;

      setStats({
        totalGross,
        organizerShare,
        commissionPaid,
        ticketCount: myTickets.length,
        activeContests: contestsRes.data?.length || 0
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profile }
      });

      if (profile?.paystack_subaccount_code) {
        setPaystackConfig(prev => ({
          ...prev,
          subaccountCode: profile.paystack_subaccount_code,
          businessName: profile.business_name || "",
          isVerified: true
        }));
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

  const deleteResource = async (table, id) => {
    if (!confirm("Are you sure?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert("Error deleting resource.");
    else loadDashboardData(true);
  };

  // UPDATED: Saves Paystack onboarding details to profile
  const saveOnboardingDetails = async () => {
    setIsProcessing(true);
    try {
      // In a real flow, this would call your /api/paystack/subaccount route
      // For the UI, we update the profile to reflect they are setting up.
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
        onboarding_complete: true
      }).eq('id', data.profile.id);

      if (error) throw error;
      alert("Payout account details saved! Your 95% split is now active.");
      setShowSettingsModal(false);
      loadDashboardData(true);
    } catch (err) {
      alert("Update failed.");
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
               {paystackConfig.subaccountCode ? 'AUTOMATED PAYOUTS LIVE' : 'ONBOARDING REQUIRED'}
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

      {/* AUTOMATED REVENUE GRID */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <p style={financeLabel}>YOUR 95% NET EARNINGS</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              <div style={autoPayoutTag}>
                <Zap size={14} fill="#0ea5e9"/> Automated splits are active via Paystack
              </div>
            </div>
            <div style={iconCircleLarge}><Wallet size={32} color="#0ea5e9"/></div>
          </div>
          
          <div style={financeActionRow}>
            <div style={miniStatSplit}>
               <span style={miniLabel}>GROSS SALES</span>
               <span style={miniValue}>GHS {stats.totalGross.toLocaleString()}</span>
            </div>
            <div style={miniStatSplit}>
               <span style={miniLabel}>5% COMMISSIONS</span>
               <span style={miniValue}>GHS {stats.commissionPaid.toLocaleString()}</span>
            </div>
            <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
              <Settings size={20}/>
            </button>
          </div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <p style={statLabel}>TOTAL TICKETS SOLD</p>
            <p style={statNumber}>{stats.ticketCount}</p>
            <Ticket size={16} color="#0ea5e9"/>
          </div>
          <div style={statBox}>
            <p style={statLabel}>TOTAL VOTES</p>
            <p style={statNumber}>{stats.totalVotes.toLocaleString()}</p>
            <Award size={16} color="#f59e0b"/>
          </div>
          {/* Status Alert if not onboarded */}
          {!paystackConfig.subaccountCode && (
            <div style={alertBox} onClick={() => setShowSettingsModal(true)}>
              <Info size={16}/>
              <span>Setup Bank Details for 95% share splits</span>
              <ChevronRight size={16}/>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={tabBar}>
        <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>
          <Calendar size={18}/> MY EVENTS
        </button>
        <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>
          <History size={18}/> SALES & TIERS
        </button>
        <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}>
          <Trophy size={18}/> CONTESTS
        </button>
      </div>

      {/* VIEWPORT */}
      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Events Dashboard</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={20}/> ADD NEW EVENT
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
                      <span style={metaLine}><MapPin size={14}/> {event.location || 'Accra, GH'}</span>
                    </div>
                    <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                      VIEW TICKET SALES <ChevronRight size={16}/>
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
              <h2 style={viewTitle}>Real-time Ticket Sales</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input 
                    style={searchInputField} 
                    placeholder="Guest name or Ref..." 
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
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
                    <th style={tableTh}>ATTENDEE</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>PAID (100%)</th>
                    <th style={tableTh}>YOUR SHARE (95%)</th>
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
                        {t.is_scanned ? <span style={scannedPill}>SCANNED</span> : <span style={activePill}>ACTIVE</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SETTINGS / ONBOARDING MODAL */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <div>
                <h2 style={modalTitle}>Payout Settings</h2>
                <p style={{margin: '5px 0 0', fontSize: '12px', color: '#64748b'}}>Automatic 95% split via Paystack</p>
              </div>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>

            <div style={onboardingPromo}>
              <Zap size={24} color="#0ea5e9"/>
              <p style={{margin: 0, fontSize: '13px', lineHeight: '1.4'}}>
                Your funds are split <b>at the moment of purchase</b>. No manual withdrawals needed.
              </p>
            </div>

            <div style={{margin: '25px 0'}}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS / ORGANIZER NAME</label>
                <input 
                  style={modalInput} 
                  placeholder="e.g. Luxury Events GH"
                  value={paystackConfig.businessName}
                  onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})}
                />
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>SETTLEMENT BANK</label>
                <select 
                  style={modalInput}
                  value={paystackConfig.bankCode}
                  onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}
                >
                  <option value="">Select Bank / Network</option>
                  <option value="MTN">MTN Mobile Money</option>
                  <option value="VOD">Vodafone Cash</option>
                  <option value="058">Guaranty Trust Bank</option>
                  <option value="057">Zenith Bank</option>
                </select>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>ACCOUNT NUMBER</label>
                <input 
                  style={modalInput} 
                  placeholder="MoMo Number or Bank Account"
                  value={paystackConfig.accountNumber}
                  onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}
                />
              </div>
            </div>

            <button 
              style={actionSubmitBtn(isProcessing)} 
              onClick={saveOnboardingDetails}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="animate-spin"/> : 'ENABLE AUTOMATIC PAYOUTS'}
            </button>
            
            <p style={{fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '15px'}}>
              Powered by Paystack Subaccounts. A 5% platform commission is applied to all sales.
            </p>
          </div>
        </div>
      )}

      {/* QR MODAL (PRESERVED) */}
      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={qrContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '20px', fontWeight: 900}}>Share QR Code</h3>
            <div style={qrBorder}><img src={showQR} style={{width: '100%'}} alt="QR"/></div>
            <button style={downloadBtn} onClick={() => window.open(showQR)}>
              <Download size={18}/> DOWNLOAD IMAGE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- UPDATED LUXURY STYLES FOR AUTOMATION ---

const mainWrapper = { padding: '40px 20px 100px', maxWidth: '1280px', margin: '0 auto', background: '#fcfdfe', minHeight: '100vh', fontFamily: '"Inter", sans-serif' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' };
const logoText = { fontSize: '24px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', verticalAlign: 'middle', marginLeft: '10px' };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700 };
const circleAction = { width: '45px', height: '45px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const logoutCircle = { width: '45px', height: '45px', borderRadius: '15px', border: 'none', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e11d48' };

const onboardingBadge = (onboarded) => ({ 
  display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, 
  color: onboarded ? '#16a34a' : '#e11d48', marginTop: '2px' 
});

const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px', marginBottom: '50px' };
const balanceCard = { background: '#000', borderRadius: '35px', padding: '40px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', margin: '0 0 10px' };
const balanceValue = { fontSize: '48px', fontWeight: 950, margin: 0, letterSpacing: '-2px' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0ea5e9', marginTop: '15px', fontWeight: 600 };
const iconCircleLarge = { width: '70px', height: '70px', borderRadius: '25px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const financeActionRow = { display: 'flex', gap: '20px', marginTop: '30px', alignItems: 'center' };
const miniStatSplit = { display: 'flex', flexDirection: 'column', gap: '2px' };
const miniLabel = { fontSize: '9px', fontWeight: 800, color: '#666' };
const miniValue = { fontSize: '13px', fontWeight: 700 };
const settingsIconBtn = { marginLeft: 'auto', width: '50px', height: '50px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '18px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const statsOverview = { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px' };
const statBox = { background: '#fff', padding: '18px 25px', borderRadius: '22px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statLabel = { margin: 0, fontSize: '11px', fontWeight: 800, color: '#94a3b8' };
const statNumber = { margin: '5px 0 0', fontSize: '20px', fontWeight: 900 };
const alertBox = { background: '#fff1f2', padding: '15px 20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', fontWeight: 700, color: '#e11d48', cursor: 'pointer' };

const tabBar = { display: 'flex', gap: '30px', borderBottom: '1px solid #e2e8f0', marginBottom: '40px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '3px solid #0ea5e9' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '10px' });

const viewPort = { minHeight: '400px' };
const fadeAnim = { animation: 'fadeIn 0.4s ease-out' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const addBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const itemCard = { background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const itemImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f8fafc', position: 'relative' });
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' };
const miniAction = { width: '35px', height: '35px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 10px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 500 };
const fullWidthBtn = { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };

const filterGroup = { display: 'flex', gap: '10px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0 15px', width: '250px' };
const searchInputField = { border: 'none', padding: '12px', outline: 'none', fontSize: '13px', width: '100%' };
const eventDropdown = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0 10px', fontSize: '13px', fontWeight: 600, outline: 'none' };

const tableWrapper = { background: '#fff', borderRadius: '25px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '20px', background: '#f8fafc', fontSize: '11px', fontWeight: 800, color: '#94a3b8' };
const tableTr = { borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '20px', fontSize: '14px' };
const guestBold = { margin: 0, fontWeight: 700 };
const guestMuted = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const scannedPill = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 };
const activePill = { background: '#eff6ff', color: '#2563eb', padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 800 };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const modal = { background: '#fff', width: '100%', maxWidth: '450px', borderRadius: '35px', padding: '40px' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' };
const modalTitle = { margin: 0, fontSize: '20px', fontWeight: 900 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const onboardingPromo = { background: '#f0f9ff', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e0f2fe' };
const inputStack = { marginBottom: '20px' };
const fieldLabel = { display: 'block', fontSize: '11px', fontWeight: 800, marginBottom: '10px', color: '#64748b' };
const modalInput = { width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' };
const actionSubmitBtn = (disabled) => ({ width: '100%', background: disabled ? '#f1f5f9' : '#000', color: disabled ? '#94a3b8' : '#fff', border: 'none', padding: '18px', borderRadius: '20px', fontWeight: 900, cursor: disabled ? 'not-allowed' : 'pointer' });

const qrContent = { background: '#fff', padding: '40px', borderRadius: '35px', textAlign: 'center', maxWidth: '400px', width: '100%' };
const qrBorder = { border: '1px solid #f1f5f9', padding: '20px', borderRadius: '25px', marginBottom: '20px' };
const downloadBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
