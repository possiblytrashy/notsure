"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, 
  Check, QrCode, Download, X,
  TrendingUp, Clock, Loader2, Trash2,
  LogOut, RefreshCcw, ChevronRight, 
  Banknote, Award, ShieldCheck, History, Info, Sparkles, Building2,
  Eye, MoreVertical, Search, Filter, MapPin, ExternalLink,
  ChevronDown, ArrowDownRight, CreditCard, HelpCircle, Bell,
  FileText, Share2, PieChart, Activity, Briefcase
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal States
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showEventActions, setShowEventActions] = useState(null); 
  
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    payouts: [], 
    tickets: [], 
    profile: null 
  });

  const [stats, setStats] = useState({
    netRevenue: 0, 
    grossRevenue: 0,
    totalVotes: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    withdrawnToDate: 0,
    ticketCount: 0,
    activeEvents: 0,
    conversionRate: 0
  });

  // --- 2. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // Force refresh the session to catch recent onboarding updates
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      const user = session?.user;

      if (sessionError || !user) {
        router.push('/login');
        return;
      }

      // Fetch Profile to verify subaccount status from DB vs Metadata
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // GATE LOGIC: Check if the subaccount code exists in metadata OR the profile table
      const subaccountCode = user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code;
      
      if (subaccountCode) {
        setIsOnboarded(true);
      } else {
        setIsOnboarded(false);
        setLoading(false);
        return; // Stop here if they aren't onboarded
      }

      // Fetch Dashboard Data
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // Calculations (95/5 Split)
      const grossRev = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const netRev = grossRev * 0.95; 
      
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;
      
      const pendingPayouts = payoutsRes.data
        ?.filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;

      setStats({
        grossRevenue: grossRev,
        netRevenue: netRev,
        totalVotes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0,
        availableBalance: Math.max(0, netRev - successfulPayouts - pendingPayouts),
        pendingWithdrawals: pendingPayouts,
        withdrawnToDate: successfulPayouts,
        ticketCount: myTickets.length,
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0,
        conversionRate: 0
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileData }
      });

    } catch (err) {
      console.error("Critical Dashboard Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // --- 3. LIFECYCLE & NAVIGATION ---
  useEffect(() => {
    loadDashboardData();

    // Listen for the moment they finish onboarding (metadata update)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
        loadDashboardData(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadDashboardData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // --- 4. FILTER ENGINE ---
  const filteredEvents = useMemo(() => {
    return data.events.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.events, searchQuery]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => 
      t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.includes(searchQuery) ||
      t.events?.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.tickets, searchQuery]);

  // --- 5. ACTION HANDLERS ---
  const handleDeleteEvent = async (id) => {
    if (!confirm("This will permanently remove the event and all sales records. Proceed?")) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) loadDashboardData(true);
  };

  const handleDownloadReport = () => {
    const headers = ["Ticket ID", "Event", "Customer", "Gross", "Net (95%)", "Date"];
    const rows = data.tickets.map(t => [t.id, t.events?.title, t.customer_email, t.amount, (t.amount * 0.95).toFixed(2), new Date(t.created_at).toLocaleDateString()]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ousted_Sales_Report.csv`;
    a.click();
  };

  // --- 6. COMPONENTS ---

  const TicketDetailModal = () => {
    if (!selectedTicket) return null;
    return (
      <div style={modalOverlay} onClick={() => setSelectedTicket(null)}>
        <div style={modalContent} onClick={e => e.stopPropagation()}>
          <div style={modalHeader}>
            <div style={modalTitleSection}><Ticket size={20}/><h3 style={modalTitle}>Ticket Info</h3></div>
            <button style={closeBtn} onClick={() => setSelectedTicket(null)}><X size={20}/></button>
          </div>
          <div style={modalBody}>
            <div style={ticketPreviewCard}>
               <div style={previewTop}><p style={previewEventName}>{selectedTicket.events?.title}</p> <span style={statusBadge('active')}>PAID</span></div>
               <div style={previewMid}>
                  <div style={qrContainer}><QrCode size={120} strokeWidth={1}/></div>
                  <div style={previewInfo}>
                    <p style={previewLabel}>HOLDER</p>
                    <p style={previewValue}>{selectedTicket.customer_email}</p>
                    <p style={previewLabel} style={{marginTop: '15px'}}>ID</p>
                    <p style={previewValue}>#{selectedTicket.id.slice(0,10).toUpperCase()}</p>
                  </div>
               </div>
               <div style={previewBottom}>
                 <div style={previewStat}><span>NET CREDIT</span><p>GHS {(selectedTicket.amount * 0.95).toFixed(2)}</p></div>
                 <div style={previewStat}><span>TYPE</span><p>{selectedTicket.ticket_type || 'Standard'}</p></div>
               </div>
            </div>
          </div>
          <button style={modalActionBtn} onClick={() => setSelectedTicket(null)}>CLOSE VIEW</button>
        </div>
      </div>
    );
  };

  // --- 7. RENDER LOGIC ---

  if (loading) {
    return (
      <div style={fullPageCenter}>
        <div style={loaderContainer}>
          <div style={luxuryLoaderRing}></div>
          <h2 style={loadingLogo}>OUSTED</h2>
          <p style={loadingText}>VERIFYING CREDENTIALS</p>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return (
      <div style={mainWrapper}>
        <div style={topNav}>
          <h1 style={logoText}>OUSTED <span style={badgePro}>SETUP</span></h1>
          <button style={logoutCircle} onClick={handleLogout}><LogOut size={20}/></button>
        </div>
        <div style={onboardingContainer}>
          <div style={onboardHero}>
            <div style={heroDecoration}><Sparkles size={40} color="#0ea5e9"/></div>
            <h2 style={onboardTitle}>Unlock Organizer Tools</h2>
            <p style={onboardSub}>Complete your merchant profile to start creating events and receiving 95% of every ticket sale directly to your account.</p>
            <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
              GO TO ONBOARDING <ChevronRight size={20}/>
            </button>
          </div>
          <div style={howItWorksGrid}>
              <div style={howCard}>
                <div style={howIcon}><Building2 size={24}/></div>
                <h3 style={howTitle}>95% Revenue</h3>
                <p style={howText}>You keep 95% of ticket prices. Paid automatically.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><ShieldCheck size={24}/></div>
                <h3 style={howTitle}>5% Fee</h3>
                <p style={howText}>Platform and processing fees are bundled into 5%.</p>
              </div>
              <div style={howCard}>
                <div style={howIcon}><Banknote size={24}/></div>
                <h3 style={howTitle}>Direct Payout</h3>
                <p style={howText}>Funds settle to your bank via Paystack infrastructure.</p>
              </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={mainWrapper}>
      <TicketDetailModal />
      
      {/* Header */}
      <div style={topNav}>
        <div style={logoSection}><h1 style={logoText}>OUSTED <span style={badgePro}>PRO</span></h1></div>
        <div style={headerActions}>
           <div style={searchWrapper}>
              <Search size={18} style={searchIcon}/>
              <input type="text" placeholder="Search..." style={searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
           </div>
           <div style={userBrief}><p style={userEmail}>{data.profile?.email}</p><p style={userRole}>Organizer</p></div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}><RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/></button>
           <button style={logoutCircle} onClick={handleLogout}><LogOut size={18}/></button>
        </div>
      </div>

      {/* Stats */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}><p style={financeLabel}>TOTAL NET REVENUE (95%)</p><div style={statusDot}>LIVE</div></div>
          <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={revenueBreakdown}>
             <div style={breakdownItem}><span>Gross Sales</span><span>GHS {stats.grossRevenue.toLocaleString()}</span></div>
             <div style={breakdownItem}><span>Ousted Fee (5%)</span><span>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span></div>
          </div>
          <div style={financeActionRow}>
            <button style={withdrawBtn}>SETTLEMENTS <History size={18}/></button>
            <button style={settingsIconBtn}><Settings size={20}/></button>
          </div>
          <div style={cardDecoration}></div>
        </div>
        <div style={statsOverview}>
          <div style={statBox}><div style={statInfo}><p style={statLabel}>TICKETS</p><p style={statNumber}>{stats.ticketCount}</p></div><div style={statIconBox}><Ticket size={24}/></div></div>
          <div style={statBox}><div style={statInfo}><p style={statLabel}>VOTES</p><p style={statNumber}>{stats.totalVotes}</p></div><div style={statIconBox}><Award size={24}/></div></div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabContainer}>
        <div style={tabBar}>
          <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}><Calendar size={16}/> EVENTS</button>
          <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}><BarChart3 size={16}/> LEDGER</button>
        </div>
        <div style={tabActions}>
          <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}><Plus size={18}/> NEW EVENT</button>
        </div>
      </div>

      {/* Table Content */}
      <div style={viewPort}>
        {activeTab === 'events' ? (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead>
                <tr><th style={thStyle}>EVENT</th><th style={thStyle}>DATE</th><th style={thStyle}>NET (95%)</th><th style={thStyle}>ACTIONS</th></tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => (
                  <tr key={event.id} style={trStyle}>
                    <td style={tdStyle}><p style={eventTitleText}>{event.title}</p></td>
                    <td style={tdStyle}>{new Date(event.date).toLocaleDateString()}</td>
                    <td style={tdStyle}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s,t) => s+t.amount, 0) * 0.95).toFixed(2)}</td>
                    <td style={tdStyle}>
                      <div style={actionGroup}>
                        <button style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/${event.id}`)}><Eye size={16}/></button>
                        <button style={deleteAction} onClick={() => handleDeleteEvent(event.id)}><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead>
                <tr><th style={thStyle}>ID</th><th style={thStyle}>BUYER</th><th style={thStyle}>NET (95%)</th><th style={thStyle}>DATE</th><th style={thStyle}>VIEW</th></tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} style={trStyle}>
                    <td style={tdStyle}><span style={ticketCode}>#{ticket.id.slice(0,8)}</span></td>
                    <td style={tdStyle}>{ticket.customer_email}</td>
                    <td style={tdStyle}><span style={netSaleText}>GHS {(ticket.amount * 0.95).toFixed(2)}</span></td>
                    <td style={tdStyle}>{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td style={tdStyle}><button style={iconAction} onClick={() => setSelectedTicket(ticket)}><QrCode size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 8. FULL STYLES ---
const mainWrapper = { padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const logoText = { fontSize: '24px', fontWeight: 900, letterSpacing: '-1.5px' };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '6px', marginLeft: '10px' };
const headerActions = { display: 'flex', alignItems: 'center', gap: '15px' };
const searchWrapper = { position: 'relative' };
const searchIcon = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInput = { padding: '10px 10px 10px 40px', borderRadius: '12px', border: '1px solid #f1f5f9', outline: 'none' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '12px', fontWeight: 800 };
const userRole = { margin: 0, fontSize: '10px', color: '#94a3b8' };
const circleAction = { width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoutCircle = { width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', border: 'none', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px', marginBottom: '40px' };
const balanceCard = { background: '#000', borderRadius: '35px', padding: '40px', color: '#fff', position: 'relative', overflow: 'hidden' };
const cardHeader = { display: 'flex', justifyContent: 'space-between' };
const financeLabel = { fontSize: '11px', letterSpacing: '2px', color: '#737373' };
const statusDot = { background: '#22c55e', padding: '4px 10px', borderRadius: '20px', fontSize: '9px' };
const balanceValue = { fontSize: '50px', fontWeight: 900, margin: '20px 0' };
const revenueBreakdown = { borderTop: '1px solid #262626', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8c8c8c' };
const financeActionRow = { display: 'flex', gap: '15px', marginTop: '30px' };
const withdrawBtn = { flex: 1, padding: '15px', borderRadius: '15px', border: 'none', background: '#fff', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
const settingsIconBtn = { width: '50px', borderRadius: '15px', background: '#333', border: 'none', color: '#fff', cursor: 'pointer' };
const cardDecoration = { position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%' };
const statsOverview = { display: 'flex', flexDirection: 'column', gap: '20px' };
const statBox = { background: '#fff', border: '1px solid #f1f5f9', padding: '25px', borderRadius: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statInfo = { display: 'flex', flexDirection: 'column' };
const statLabel = { fontSize: '11px', color: '#94a3b8', fontWeight: 800 };
const statNumber = { fontSize: '28px', fontWeight: 900, margin: '5px 0 0' };
const statIconBox = { width: '50px', height: '50px', background: '#f8fafc', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tabContainer = { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', marginBottom: '30px' };
const tabBar = { display: 'flex', gap: '30px' };
const tabItem = (active) => ({ padding: '20px 0', border: 'none', background: 'none', color: active ? '#000' : '#94a3b8', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const addBtn = { background: '#000', color: '#fff', padding: '12px 20px', borderRadius: '12px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
const luxuryTableContainer = { background: '#fff', borderRadius: '25px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { padding: '20px', background: '#fafafa', textAlign: 'left', fontSize: '11px', color: '#94a3b8', fontWeight: 900 };
const trStyle = { borderBottom: '1px solid #f8fafc' };
const tdStyle = { padding: '20px', fontSize: '14px' };
const eventTitleText = { fontWeight: 800, margin: 0 };
const actionGroup = { display: 'flex', gap: '10px' };
const iconAction = { padding: '8px', borderRadius: '8px', border: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer' };
const deleteAction = { padding: '8px', borderRadius: '8px', border: 'none', background: '#fff1f2', color: '#e11d48', cursor: 'pointer' };
const onboardingContainer = { maxWidth: '800px', margin: '0 auto', textAlign: 'center' };
const onboardHero = { background: '#fff', padding: '80px 40px', borderRadius: '40px', border: '1px solid #f1f5f9', marginBottom: '40px' };
const heroDecoration = { marginBottom: '20px' };
const onboardTitle = { fontSize: '36px', fontWeight: 900 };
const onboardSub = { color: '#64748b', marginBottom: '40px' };
const primaryOnboardBtn = { background: '#000', color: '#fff', padding: '20px 40px', borderRadius: '20px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' };
const howItWorksGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' };
const howCard = { background: '#fff', padding: '30px', borderRadius: '25px', border: '1px solid #f1f5f9' };
const howIcon = { marginBottom: '20px', color: '#0ea5e9' };
const howTitle = { fontSize: '18px', fontWeight: 800, margin: '0 0 10px' };
const howText = { fontSize: '13px', color: '#64748b', margin: 0 };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', padding: '30px', borderRadius: '30px', width: '90%', maxWidth: '400px' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const modalTitleSection = { display: 'flex', alignItems: 'center', gap: '10px' };
const modalTitle = { fontSize: '20px', fontWeight: 900, margin: 0 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer' };
const ticketPreviewCard = { background: '#fafafa', padding: '20px', borderRadius: '20px', border: '1px solid #eee' };
const previewTop = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const previewEventName = { fontWeight: 800, margin: 0 };
const previewMid = { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' };
const qrContainer = { background: '#fff', padding: '10px', borderRadius: '15px' };
const previewInfo = { display: 'flex', flexDirection: 'column' };
const previewLabel = { fontSize: '10px', color: '#94a3b8', margin: 0 };
const previewValue = { fontSize: '12px', fontWeight: 700, margin: 0 };
const previewBottom = { display: 'flex', justifyContent: 'space-between' };
const previewStat = { display: 'flex', flexDirection: 'column' };
const statusBadge = (s) => ({ fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px' });
const modalActionBtn = { width: '100%', padding: '15px', borderRadius: '15px', background: '#000', color: '#fff', border: 'none', fontWeight: 800, marginTop: '20px', cursor: 'pointer' };
const ticketCode = { fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' };
const netSaleText = { color: '#16a34a', fontWeight: 800 };
const fullPageCenter = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const loaderContainer = { textAlign: 'center' };
const luxuryLoaderRing = { width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' };
const loadingLogo = { letterSpacing: '4px', fontWeight: 900 };
const loadingText = { fontSize: '10px', color: '#94a3b8', letterSpacing: '2px' };
