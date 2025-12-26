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
  FileText, Share2, PieChart, Activity, Briefcase, TrendingDown
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- STATE ---
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  
  const [data, setData] = useState({ 
    events: [], contests: [], payouts: [], tickets: [], profile: null 
  });

  const [stats, setStats] = useState({
    netRevenue: 0, 
    grossRevenue: 0,
    totalVotes: 0,
    availableBalance: 0,
    ticketCount: 0,
    activeEvents: 0,
    avgTicketPrice: 0,
    conversionRate: 0
  });

  // --- DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/login'); return; }

      const user = session.user;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const subaccount = user.user_metadata?.paystack_subaccount_code || profileData?.paystack_subaccount_code;
      setIsOnboarded(!!subaccount);
      if (!subaccount) { setLoading(false); return; }

      // Fetch Data
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      const grossRev = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const netRev = grossRev * 0.95;

      setStats({
        grossRevenue: grossRev,
        netRevenue: netRev,
        totalVotes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0,
        ticketCount: myTickets.length,
        activeEvents: eventsRes.data?.filter(e => e.status === 'active').length || 0,
        avgTicketPrice: myTickets.length > 0 ? (grossRev / myTickets.length) : 0,
        conversionRate: 12.5 // Simulated for UI
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileData }
      });

    } catch (err) { console.error(err); } 
    finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  if (loading) return <div style={fullPageLoader}><div style={spinner}></div><h1 style={loaderLogo}>OUSTED</h1></div>;

  return (
    <div style={dashboardWrapper}>
      {/* Sidebar Navigation */}
      <aside style={sidebar}>
        <div style={sidebarLogo}>OUSTED</div>
        <nav style={sideNav}>
          <button onClick={() => setActiveTab('overview')} style={navItem(activeTab === 'overview')}><Activity size={18}/> Overview</button>
          <button onClick={() => setActiveTab('events')} style={navItem(activeTab === 'events')}><Calendar size={18}/> Events</button>
          <button onClick={() => setActiveTab('analytics')} style={navItem(activeTab === 'analytics')}><BarChart3 size={18}/> Analytics</button>
          <button onClick={() => setActiveTab('payouts')} style={navItem(activeTab === 'payouts')}><Wallet size={18}/> Settlements</button>
        </nav>
        <div style={sidebarFooter}>
           <div style={userTag}>
             <div style={userAvatar}>{data.profile?.email?.[0].toUpperCase()}</div>
             <p style={userName}>Pro Member</p>
           </div>
           <button style={logoutAction} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}><LogOut size={16}/> Logout</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={contentArea}>
        <header style={topHeader}>
          <div style={headerTitleArea}>
            <h2 style={welcomeTitle}>Executive Suite</h2>
            <p style={headerSub}>Welcome back, {data.profile?.email}</p>
          </div>
          <div style={headerButtons}>
            <button style={refreshBtn} onClick={() => loadDashboardData(true)}><RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/></button>
            <button style={primaryAction} onClick={() => router.push('/dashboard/organizer/events/create')}><Plus size={18}/> New Event</button>
          </div>
        </header>

        {/* Dynamic Section: Overview */}
        {activeTab === 'overview' && (
          <>
            <section style={statsGrid}>
              <div style={glassCard}>
                <div style={cardHead}><p style={cl}>NET REVENUE</p><TrendingUp size={16} color="#22c55e"/></div>
                <h3 style={cv}>GHS {stats.netRevenue.toLocaleString()}</h3>
                <p style={cs}>95% share after Ousted fees</p>
              </div>
              <div style={glassCard}>
                <div style={cardHead}><p style={cl}>TICKETS ISSUED</p><Ticket size={16} color="#0ea5e9"/></div>
                <h3 style={cv}>{stats.ticketCount}</h3>
                <p style={cs}>Across {stats.activeEvents} active events</p>
              </div>
              <div style={glassCard}>
                <div style={cardHead}><p style={cl}>AVG. BASKET</p><CreditCard size={16} color="#a855f7"/></div>
                <h3 style={cv}>GHS {stats.avgTicketPrice.toFixed(2)}</h3>
                <p style={cs}>Per transaction average</p>
              </div>
              <div style={glassCard}>
                <div style={cardHead}><p style={cl}>CONV. RATE</p><Activity size={16} color="#f59e0b"/></div>
                <h3 style={cv}>{stats.conversionRate}%</h3>
                <p style={cs}>Visitor to purchase ratio</p>
              </div>
            </section>

            <section style={mainGrid}>
              {/* Event Management Table */}
              <div style={tableCard}>
                <div style={tableHeader}>
                  <h4 style={tableTitle}>Active Inventory</h4>
                  <button style={viewAllBtn}>View All <ChevronRight size={14}/></button>
                </div>
                <table style={luxuryTable}>
                  <thead>
                    <tr><th style={th}>Event</th><th style={th}>Sales</th><th style={th}>Status</th><th style={th}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {data.events.slice(0, 5).map(e => (
                      <tr key={e.id} style={tr}>
                        <td style={td}>
                          <p style={itemMain}>{e.title}</p>
                          <p style={itemSub}>{e.location}</p>
                        </td>
                        <td style={td}><p style={itemMain}>GHS {data.tickets.filter(t => t.event_id === e.id).reduce((s,t) => s+(t.amount||0), 0).toLocaleString()}</p></td>
                        <td style={td}><span style={statusBadge}>LIVE</span></td>
                        <td style={td}><button style={iconBtn}><Settings size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Settlement History */}
              <div style={sideListCard}>
                <h4 style={tableTitle}>Recent Payouts</h4>
                <div style={listItems}>
                  {data.payouts.length === 0 ? (
                    <div style={emptyState}><Clock size={30}/><p>No settlements yet</p></div>
                  ) : (
                    data.payouts.map(p => (
                      <div key={p.id} style={listItem}>
                        <div style={liIcon}><Banknote size={16}/></div>
                        <div style={liText}>
                          <p style={liMain}>GHS {p.amount}</p>
                          <p style={liSub}>{new Date(p.created_at).toLocaleDateString()}</p>
                        </div>
                        <div style={liStatus}>PAID</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Dynamic Section: Analytics */}
        {activeTab === 'analytics' && (
          <div style={analyticsView}>
             <div style={chartPlaceholder}>
                <PieChart size={40} color="#94a3b8"/>
                <h3>Deep Sales Analytics</h3>
                <p>Advanced metrics for ticket tiers and peak booking times are processing.</p>
             </div>
             <div style={metricsGrid}>
                <div style={metricCard}>
                   <p style={mLabel}>Peak Booking Hour</p>
                   <p style={mValue}>8:00 PM</p>
                </div>
                <div style={metricCard}>
                   <p style={mLabel}>Top Region</p>
                   <p style={mValue}>Greater Accra</p>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- STYLES ---
const dashboardWrapper = { display: 'flex', height: '100vh', backgroundColor: '#000', color: '#fff', overflow: 'hidden' };
const sidebar = { width: '280px', borderRight: '1px solid #27272a', padding: '40px 20px', display: 'flex', flexDirection: 'column' };
const sidebarLogo = { fontSize: '24px', fontWeight: 950, letterSpacing: '-2px', marginBottom: '50px', paddingLeft: '20px' };
const sideNav = { display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 };
const navItem = (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '12px', border: 'none', background: active ? '#27272a' : 'transparent', color: active ? '#fff' : '#71717a', fontSize: '14px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', transition: '0.2s' });
const sidebarFooter = { paddingTop: '30px', borderTop: '1px solid #27272a' };
const userTag = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingLeft: '10px' };
const userAvatar = { width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(45deg, #0ea5e9, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 900 };
const userName = { fontSize: '13px', fontWeight: 700, margin: 0 };
const logoutAction = { border: 'none', background: 'none', color: '#ef4444', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };

const contentArea = { flex: 1, padding: '40px 50px', overflowY: 'auto', backgroundColor: '#0a0a0a' };
const topHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const welcomeTitle = { fontSize: '32px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const headerSub = { color: '#71717a', fontSize: '14px', marginTop: '5px' };
const headerButtons = { display: 'flex', gap: '15px' };
const refreshBtn = { width: '50px', height: '50px', borderRadius: '15px', border: '1px solid #27272a', background: '#000', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const primaryAction = { background: '#fff', color: '#000', padding: '0 25px', borderRadius: '15px', border: 'none', fontWeight: 900, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' };
const glassCard = { background: '#18181b', padding: '25px', borderRadius: '24px', border: '1px solid #27272a' };
const cardHead = { display: 'flex', justifyContent: 'space-between', marginBottom: '15px' };
const cl = { fontSize: '10px', fontWeight: 900, color: '#71717a', letterSpacing: '1px' };
const cv = { fontSize: '24px', fontWeight: 950, margin: '0 0 5px' };
const cs = { fontSize: '11px', color: '#52525b', margin: 0 };

const mainGrid = { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' };
const tableCard = { background: '#18181b', borderRadius: '24px', border: '1px solid #27272a', padding: '30px' };
const tableHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' };
const tableTitle = { fontSize: '18px', fontWeight: 900, margin: 0 };
const viewAllBtn = { background: 'none', border: 'none', color: '#0ea5e9', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', padding: '15px 10px', borderBottom: '1px solid #27272a', fontSize: '11px', color: '#52525b', fontWeight: 900, textTransform: 'uppercase' };
const tr = { borderBottom: '1px solid #27272a' };
const td = { padding: '20px 10px' };
const itemMain = { fontSize: '14px', fontWeight: 800, margin: 0 };
const itemSub = { fontSize: '12px', color: '#71717a', margin: '4px 0 0' };
const statusBadge = { background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const iconBtn = { background: '#27272a', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' };

const sideListCard = { background: '#18181b', borderRadius: '24px', border: '1px solid #27272a', padding: '30px' };
const listItems = { marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '15px' };
const listItem = { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: '#0a0a0a', borderRadius: '15px', border: '1px solid #27272a' };
const liIcon = { width: '35px', height: '35px', borderRadius: '10px', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' };
const liText = { flex: 1 };
const liMain = { fontSize: '14px', fontWeight: 800, margin: 0 };
const liSub = { fontSize: '11px', color: '#52525b', margin: 0 };
const liStatus = { fontSize: '10px', fontWeight: 900, color: '#71717a' };
const emptyState = { textAlign: 'center', padding: '40px 0', color: '#52525b' };

const analyticsView = { padding: '40px', background: '#18181b', borderRadius: '30px', border: '1px solid #27272a', textAlign: 'center' };
const chartPlaceholder = { padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' };
const metricsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '30px' };
const metricCard = { padding: '30px', background: '#0a0a0a', borderRadius: '20px', border: '1px solid #27272a' };
const mLabel = { fontSize: '12px', fontWeight: 800, color: '#71717a', margin: '0 0 10px' };
const mValue = { fontSize: '32px', fontWeight: 950, margin: 0 };

const fullPageLoader = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' };
const spinner = { width: '40px', height: '40px', border: '3px solid #27272a', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' };
const loaderLogo = { letterSpacing: '10px', fontSize: '20px', fontWeight: 950, marginTop: '20px' };
