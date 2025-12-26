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
  const [isOnboarded, setIsOnboarded] = useState(false); // Default false to prevent flash
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal States
  const [selectedTicket, setSelectedTicket] = useState(null);
  
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

  // --- 2. DATA ENGINE (FIXED FOR 406 & 404 ERRORS) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // 1. Refresh Session to get the latest JWT (fixes the 406 error)
      const { data: { session } } = await supabase.auth.refreshSession();
      const user = session?.user;

      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Fetch Profile with headers that prevent the 406 "Not Acceptable" error
      // We use .maybeSingle() and explicit select to ensure the DB knows what we want
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, paystack_subaccount_code, is_onboarded, email')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) console.error("Profile Fetch Warning:", profileError);

      // 3. ONBOARDING GATE LOGIC (FIXED)
      // Check metadata OR database. If either exists, they are onboarded.
      const subaccount = user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code;
      
      if (subaccount) {
        setIsOnboarded(true);
      } else {
        // If they definitely aren't onboarded, stop here.
        setIsOnboarded(false);
        setLoading(false);
        return;
      }

      // 4. FETCH REAL DATA
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // FINANCIAL CALCULATIONS (95/5 SPLIT)
      const grossRev = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const netRev = grossRev * 0.95; 
      
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;

      setStats({
        grossRevenue: grossRev,
        netRevenue: netRev,
        totalVotes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0,
        availableBalance: Math.max(0, netRev - successfulPayouts),
        ticketCount: myTickets.length,
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0,
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileData }
      });

    } catch (err) {
      console.error("Dashboard Engine Failure:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- 3. UI HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login'; // Force full reload to clear state
  };

  const filteredEvents = useMemo(() => {
    return data.events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data.events, searchQuery]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data.tickets, searchQuery]);

  // --- 4. RENDER: LOADING ---
  if (loading) return (
    <div style={fullPageCenter}>
      <div style={loaderContainer}>
        <div style={luxuryLoaderRing}></div>
        <h2 style={loadingLogo}>OUSTED</h2>
        <p style={loadingText}>PREPARING SECURE DASHBOARD</p>
      </div>
    </div>
  );

  // --- 5. RENDER: ONBOARDING GATE (The "Begin Onboarding" Screen) ---
  if (!isOnboarded) return (
    <div style={mainWrapper}>
      <div style={topNav}>
        <h1 style={logoText}>OUSTED <span style={badgePro}>SETUP</span></h1>
        <button style={logoutCircle} onClick={handleLogout}><LogOut size={20}/></button>
      </div>
      <div style={onboardingContainer}>
        <div style={onboardHero}>
          <div style={heroDecoration}><Sparkles size={40} color="#0ea5e9"/></div>
          <h2 style={onboardTitle}>Activation Required</h2>
          <p style={onboardSub}>Your account is restricted until you connect your payout bank via Paystack. This ensures your 95% split is paid automatically.</p>
          <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
            BEGIN ONBOARDING FORM <ChevronRight size={20}/>
          </button>
        </div>
      </div>
    </div>
  );

  // --- 6. RENDER: MAIN LUXURY DASHBOARD ---
  return (
    <div style={mainWrapper}>
       {/* Header */}
      <div style={topNav}>
        <div style={logoSection}><h1 style={logoText}>OUSTED <span style={badgePro}>PRO</span></h1></div>
        <div style={headerActions}>
           <div style={searchWrapper}>
              <Search size={18} style={searchIcon}/>
              <input type="text" placeholder="Search data..." style={searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/>
           </div>
           <div style={userBrief}><p style={userEmail}>{data.profile?.email}</p><p style={userRole}>ORGANIZER</p></div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}><RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/></button>
           <button style={logoutCircle} onClick={handleLogout}><LogOut size={18}/></button>
        </div>
      </div>

      {/* Financial Section */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}><p style={financeLabel}>TOTAL NET REVENUE (95%)</p><div style={statusDot}>LIVE</div></div>
          <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={revenueBreakdown}>
             <div style={breakdownItem}><span>Gross Sales</span><span>GHS {stats.grossRevenue.toLocaleString()}</span></div>
             <div style={breakdownItem}><span>Ousted Commission (5%)</span><span>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span></div>
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
          <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>EVENTS</button>
          <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>SALES LEDGER</button>
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
                <tr><th style={thStyle}>EVENT</th><th style={thStyle}>DATE</th><th style={thStyle}>NET (95%)</th><th style={thStyle}>STATUS</th></tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => (
                  <tr key={event.id} style={trStyle}>
                    <td style={tdStyle}><p style={eventTitleText}>{event.title}</p></td>
                    <td style={tdStyle}>{new Date(event.date).toLocaleDateString()}</td>
                    <td style={tdStyle}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s,t) => s+t.amount, 0) * 0.95).toFixed(2)}</td>
                    <td style={tdStyle}><span style={statusBadge('active')}>ACTIVE</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead>
                <tr><th style={thStyle}>ID</th><th style={thStyle}>BUYER</th><th style={thStyle}>NET (95%)</th><th style={thStyle}>DATE</th></tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => (
                  <tr key={ticket.id} style={trStyle}>
                    <td style={tdStyle}><span style={ticketCode}>#{ticket.id.slice(0,8)}</span></td>
                    <td style={tdStyle}>{ticket.customer_email}</td>
                    <td style={tdStyle}><span style={netSaleText}>GHS {(ticket.amount * 0.95).toFixed(2)}</span></td>
                    <td style={tdStyle}>{new Date(ticket.created_at).toLocaleDateString()}</td>
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

// --- 7. STYLES (ALL OMITTED CONTENT RESTORED) ---
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
const onboardingContainer = { maxWidth: '800px', margin: '0 auto', textAlign: 'center' };
const onboardHero = { background: '#fff', padding: '80px 40px', borderRadius: '40px', border: '1px solid #f1f5f9', marginBottom: '40px' };
const heroDecoration = { marginBottom: '20px' };
const onboardTitle = { fontSize: '36px', fontWeight: 900 };
const onboardSub = { color: '#64748b', marginBottom: '40px' };
const primaryOnboardBtn = { background: '#000', color: '#fff', padding: '20px 40px', borderRadius: '20px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' };
const ticketCode = { fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' };
const netSaleText = { color: '#16a34a', fontWeight: 800 };
const fullPageCenter = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const loaderContainer = { textAlign: 'center' };
const luxuryLoaderRing = { width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' };
const loadingLogo = { letterSpacing: '4px', fontWeight: 900 };
const loadingText = { fontSize: '10px', color: '#94a3b8', letterSpacing: '2px' };
const statusBadge = (s) => ({ fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px' });
