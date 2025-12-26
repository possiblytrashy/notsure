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
    ticketCount: 0,
    activeEvents: 0
  });

  // --- 2. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { session }, error: authError } = await supabase.auth.refreshSession();
      const user = session?.user;

      if (authError || !user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const subaccount = user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code;
      setIsOnboarded(!!subaccount);

      if (!subaccount) {
        setLoading(false);
        return;
      }

      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
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
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0
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
    router.push('/login');
  };

  const filteredEvents = useMemo(() => {
    return data.events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data.events, searchQuery]);

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

  // --- 5. RENDER: ONBOARDING GATE (HOW IT WORKS) ---
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
          <p style={onboardSub}>Your Ousted Pro account is restricted until you connect your payout bank. This ensures your 95% revenue split is paid automatically.</p>
          
          <button style={primaryOnboardBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
            BEGIN ONBOARDING FORM <ChevronRight size={20}/>
          </button>
        </div>

        <h3 style={sectionHeading}>How Service Fees Work</h3>
        <div style={howItWorksGrid}>
          <div style={howCard}>
            <div style={howIcon}><Building2 size={24}/></div>
            <h3 style={howTitle}>Direct Payouts</h3>
            <p style={howText}>We connect directly to your Bank or Mobile Money. No manual withdrawal requests needed for standard cycles.</p>
          </div>
          <div style={howCard}>
            <div style={howIcon}><ShieldCheck size={24}/></div>
            <h3 style={howTitle}>5% Service Fee</h3>
            <p style={howText}>Ousted retains a flat 5% per transaction. This covers Paystack fees, QR hosting, and 24/7 technical support.</p>
          </div>
          <div style={howCard}>
            <div style={howIcon}><Banknote size={24}/></div>
            <h3 style={howTitle}>Automated Splits</h3>
            <p style={howText}>Our Paystack integration automatically routes your 95% share to your account, ensuring lightning-fast liquidity.</p>
          </div>
        </div>

        <div style={commissionNotice}>
           <Info size={20} color="#0ea5e9"/>
           <div style={{display: 'flex', flexDirection: 'column', textAlign: 'left'}}>
             <p style={{margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b'}}>Transparent Financial Policy</p>
             <p style={{margin: 0, fontSize: '13px', color: '#64748b'}}>
               For every GHS 100.00 sold, you receive <b>GHS 95.00</b>. Ousted handles all transaction processing fees within its 5% share.
             </p>
           </div>
        </div>
      </div>
    </div>
  );

  // --- 6. RENDER: MAIN LUXURY DASHBOARD ---
  return (
    <div style={mainWrapper}>
      <div style={topNav}>
        <div style={logoSection}>
          <h1 style={logoText}>OUSTED <span style={badgePro}>PRO</span></h1>
          <div style={breadcrumb}>Dashboard / Overview</div>
        </div>
        
        <div style={headerActions}>
           <div style={searchWrapper}>
              <Search size={18} style={searchIcon}/>
              <input 
                type="text" 
                placeholder="Search..." 
                style={searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <p style={userRole}>VERIFIED ORGANIZER</p>
           </div>
           <div style={actionButtonsGroup}>
             <button style={circleAction} onClick={() => loadDashboardData(true)}>
               <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
             </button>
             <button style={logoutCircle} onClick={handleLogout}><LogOut size={18}/></button>
           </div>
        </div>
      </div>

      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={cardTitleArea}>
              <p style={financeLabel}>TOTAL NET REVENUE (95%)</p>
              <h2 style={balanceValue}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={statusDot}>LIVE TRACKING</div>
          </div>
          <div style={revenueBreakdown}>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Gross Sales</span>
                <span style={breakdownValue}>GHS {stats.grossRevenue.toLocaleString()}</span>
             </div>
             <div style={breakdownItem}>
                <span style={breakdownLabel}>Ousted Commission (5%)</span>
                <span style={breakdownValue}>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span>
             </div>
          </div>
          <div style={financeActionRow}>
            <button style={withdrawBtn}>SETTLEMENT HISTORY <History size={18}/></button>
            <button style={settingsIconBtn}><Settings size={20}/></button>
          </div>
          <div style={cardDecoration}></div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <div style={statInfo}>
              <p style={statLabel}>TOTAL TICKETS</p>
              <p style={statNumber}>{stats.ticketCount.toLocaleString()}</p>
              <div style={statTrend}><TrendingUp size={12}/> +12% growth</div>
            </div>
            <div style={statIconBox}><Ticket size={24} color="#000"/></div>
          </div>
          <div style={statBox}>
            <div style={statInfo}>
              <p style={statLabel}>CONTEST VOTES</p>
              <p style={statNumber}>{stats.totalVotes.toLocaleString()}</p>
              <div style={statTrend}><Activity size={12}/> Active Now</div>
            </div>
            <div style={statIconBox}><Award size={24} color="#000"/></div>
          </div>
        </div>
      </div>

      <div style={tabContainer}>
        <div style={tabBar}>
          <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>EVENTS</button>
          <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>SALES</button>
          <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}>CONTESTS</button>
        </div>
        <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
          <Plus size={18}/> CREATE NEW
        </button>
      </div>

      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={luxuryTableContainer}>
            <table style={luxuryTable}>
              <thead>
                <tr>
                  <th style={thStyle}>EVENT TITLE</th>
                  <th style={thStyle}>DATE & VENUE</th>
                  <th style={thStyle}>STATUS</th>
                  <th style={thStyle}>NET EARNINGS (95%)</th>
                  <th style={thStyle}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} style={trStyle}>
                    <td style={tdStyle}>
                      <div style={eventBrief}>
                        <div style={eventIcon}><MapPin size={18}/></div>
                        <p style={eventTitleText}>{event.title}</p>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <p style={tableMainText}>{new Date(event.date).toLocaleDateString()}</p>
                      <p style={tableSubText}>{event.location}</p>
                    </td>
                    <td style={tdStyle}><span style={statusBadge('active')}>ACTIVE</span></td>
                    <td style={tdStyle}>
                      <p style={netEarningText}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s,t) => s + (t.amount||0), 0) * 0.95).toFixed(2)}</p>
                    </td>
                    <td style={tdStyle}>
                      <div style={actionGroup}>
                        <button style={iconAction}><Eye size={16}/></button>
                        <button style={iconAction} onClick={() => router.push(`/dashboard/organizer/events/${event.id}`)}><Settings size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sales' && (
          <div style={luxuryTableContainer}>
             <table style={luxuryTable}>
               <thead>
                 <tr>
                   <th style={thStyle}>TICKET REF</th>
                   <th style={thStyle}>CUSTOMER</th>
                   <th style={thStyle}>NET SPLIT (95%)</th>
                   <th style={thStyle}>DATE</th>
                 </tr>
               </thead>
               <tbody>
                 {data.tickets.map(t => (
                   <tr key={t.id} style={trStyle}>
                     <td style={tdStyle}><span style={ticketCode}>#{t.id.slice(0,8)}</span></td>
                     <td style={tdStyle}>{t.customer_email}</td>
                     <td style={tdStyle}><span style={positiveValue}>GHS {(t.amount * 0.95).toFixed(2)}</span></td>
                     <td style={tdStyle}>{new Date(t.created_at).toLocaleString()}</td>
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

// --- 7. STYLES (NO OMISSIONS, FIXED HERO DECORATION ERROR) ---
const mainWrapper = { padding: '40px 30px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif', backgroundColor: '#fafafa', minHeight: '100vh' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const logoSection = { display: 'flex', flexDirection: 'column' };
const logoText = { fontSize: '26px', fontWeight: 950, letterSpacing: '-1.8px', margin: 0 };
const breadcrumb = { fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 10px', borderRadius: '8px', marginLeft: '10px' };
const headerActions = { display: 'flex', alignItems: 'center', gap: '25px' };
const searchWrapper = { position: 'relative' };
const searchIcon = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };
const searchInput = { padding: '12px 12px 12px 42px', borderRadius: '16px', border: '1px solid #e2e8f0', width: '250px', background: '#fff', fontSize: '14px', outline: 'none' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '13px', fontWeight: 800 };
const userRole = { margin: 0, fontSize: '10px', color: '#94a3b8', fontWeight: 700 };
const actionButtonsGroup = { display: 'flex', gap: '10px' };
const circleAction = { width: '45px', height: '45px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const logoutCircle = { ...circleAction, background: '#fff1f2', border: 'none', color: '#e11d48' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '30px', marginBottom: '50px' };
const balanceCard = { background: '#000', borderRadius: '45px', padding: '50px', color: '#fff', position: 'relative', overflow: 'hidden' };
const cardHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const cardTitleArea = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '12px', fontWeight: 800, color: '#71717a', letterSpacing: '2px' };
const balanceValue = { fontSize: '64px', fontWeight: 950, margin: '20px 0', letterSpacing: '-3px' };
const statusDot = { background: '#22c55e', color: '#fff', padding: '6px 14px', borderRadius: '30px', fontSize: '10px', fontWeight: 900 };
const revenueBreakdown = { borderTop: '1px solid #27272a', paddingTop: '25px', marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '12px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between', fontSize: '14px' };
const breakdownLabel = { color: '#a1a1aa' };
const breakdownValue = { fontWeight: 700 };
const financeActionRow = { display: 'flex', gap: '15px', marginTop: '40px' };
const withdrawBtn = { flex: 1, padding: '20px', borderRadius: '22px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '15px' };
const settingsIconBtn = { width: '60px', borderRadius: '22px', background: '#27272a', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const cardDecoration = { position: 'absolute', bottom: '-50px', right: '-50px', width: '250px', height: '250px', background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%)', borderRadius: '50%' };
const statsOverview = { display: 'flex', flexDirection: 'column', gap: '20px' };
const statBox = { background: '#fff', border: '1px solid #e2e8f0', padding: '30px', borderRadius: '35px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statInfo = { display: 'flex', flexDirection: 'column' };
const statLabel = { fontSize: '12px', color: '#94a3b8', fontWeight: 800, letterSpacing: '1px' };
const statNumber = { fontSize: '32px', fontWeight: 950, margin: '5px 0' };
const statTrend = { fontSize: '11px', fontWeight: 800, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' };
const statIconBox = { width: '60px', height: '60px', background: '#f8fafc', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tabContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', marginBottom: '35px' };
const tabBar = { display: 'flex', gap: '40px' };
const tabItem = (active) => ({ padding: '25px 0', border: 'none', background: 'none', color: active ? '#000' : '#94a3b8', fontWeight: 800, fontSize: '13px', cursor: 'pointer', borderBottom: active ? '4px solid #000' : '4px solid transparent' });
const addBtn = { background: '#000', color: '#fff', padding: '14px 28px', borderRadius: '16px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' };
const luxuryTableContainer = { background: '#fff', borderRadius: '40px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thStyle = { padding: '25px', background: '#fafafa', fontSize: '11px', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const tdStyle = { padding: '25px' };
const eventBrief = { display: 'flex', alignItems: 'center', gap: '15px' };
const eventIcon = { width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const eventTitleText = { fontWeight: 800, fontSize: '15px', margin: 0 };
const tableMainText = { fontWeight: 700, margin: 0, fontSize: '14px' };
const tableSubText = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' };
const netEarningText = { fontWeight: 950, fontSize: '16px', color: '#000' };
const positiveValue = { color: '#16a34a', fontWeight: 800 };
const onboardingContainer = { maxWidth: '850px', margin: '40px auto', textAlign: 'center' };
const onboardHero = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '50px', padding: '80px 50px', marginBottom: '50px' };
const heroDecoration = { marginBottom: '30px', display: 'inline-block' }; // FIXED MISSING PROPERTY
const onboardTitle = { fontSize: '42px', fontWeight: 950, letterSpacing: '-2.5px', margin: '0 0 20px' };
const onboardSub = { color: '#64748b', fontSize: '18px', maxWidth: '550px', margin: '0 auto 40px', lineHeight: 1.6 };
const primaryOnboardBtn = { background: '#000', color: '#fff', padding: '24px 50px', borderRadius: '25px', border: 'none', fontWeight: 900, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' };
const sectionHeading = { fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '35px', letterSpacing: '2.5px' };
const howItWorksGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '50px' };
const howCard = { background: '#fff', padding: '35px', borderRadius: '35px', border: '1px solid #e2e8f0', textAlign: 'left' };
const howIcon = { width: '60px', height: '60px', background: '#f0f9ff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '25px', color: '#0ea5e9' };
const howTitle = { fontSize: '19px', fontWeight: 900, margin: '0 0 12px' };
const howText = { fontSize: '14px', color: '#64748b', lineHeight: 1.7 };
const commissionNotice = { background: '#fff', padding: '30px 40px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '25px', border: '1px solid #e0f2fe' };
const ticketCode = { fontFamily: 'monospace', background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', fontSize: '12px' };
const fullPageCenter = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const loaderContainer = { textAlign: 'center' };
const luxuryLoaderRing = { width: '50px', height: '50px', border: '4px solid #f3f3f3', borderTop: '4px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 25px' };
const loadingLogo = { letterSpacing: '6px', fontWeight: 950, fontSize: '24px' };
const loadingText = { fontSize: '12px', color: '#94a3b8', letterSpacing: '2.5px', fontWeight: 700 };
const actionGroup = { display: 'flex', gap: '10px' };
const iconAction = { width: '38px', height: '38px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const statusBadge = (s) => ({ fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '6px 12px', borderRadius: '8px' });
const viewPort = { marginTop: '20px' };
