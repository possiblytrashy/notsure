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
  Banknote, Award, ShieldCheck, History, Info, Sparkles,
  Eye, Search, Filter, MapPin, Activity, CreditCard, Link as LinkIcon
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CONSOLIDATED STATE ---
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modals
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const [copying, setCopying] = useState(null);
  
  // Data State
  const [data, setData] = useState({ 
    events: [], contests: [], payouts: [], tickets: [], profile: null 
  });
  const [stats, setStats] = useState({
    totalRevenue: 0, netRevenue: 0, totalVotes: 0,
    availableBalance: 0, ticketCount: 0, pendingWithdrawals: 0
  });

  // Withdrawal Config
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [momoConfig, setMomoConfig] = useState({
    number: "", network: "MTN", accountName: ""
  });

  // --- 2. DATA ENGINE (MERGED LOGIC) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      const grossRevenue = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;
      
      const pendingPayouts = payoutsRes.data
        ?.filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;

      setStats({
        totalRevenue: grossRevenue,
        netRevenue: grossRevenue * 0.95, // 5% Split logic
        totalVotes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0,
        availableBalance: Math.max(0, (grossRevenue * 0.95) - successfulPayouts - pendingPayouts),
        pendingWithdrawals: pendingPayouts,
        ticketCount: myTickets.length
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: user
      });

      if (user.user_metadata?.momo_number) {
        setMomoConfig({
          number: user.user_metadata.momo_number,
          network: user.user_metadata.momo_network || "MTN",
          accountName: user.user_metadata.account_name || ""
        });
      }

    } catch (err) { console.error(err); } 
    finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // --- 3. ACTIONS ---
  const copyLink = (path, id) => {
    const url = `${window.location.origin}/${path}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 5) return alert("Min withdrawal GHS 5.00");
    setIsProcessing(true);
    const { error } = await supabase.from('payouts').insert([{
        organizer_id: data.profile.id,
        amount: amount,
        momo_number: momoConfig.number,
        momo_network: momoConfig.network,
        status: 'pending'
    }]);
    if (!error) {
        setShowWithdrawModal(false);
        loadDashboardData(true);
        alert("Withdrawal Pending");
    }
    setIsProcessing(false);
  };

  if (loading) return <div style={fullPageLoader}><Loader2 className="animate-spin" /><h1 style={loaderLogo}>OUSTED</h1></div>;

  return (
    <div style={dashboardWrapper}>
      {/* SIDEBAR NAVIGATION */}
      <aside style={sidebar}>
        <div style={sidebarLogo}>OUSTED <span style={proBadge}>PRO</span></div>
        <nav style={sideNav}>
          <button onClick={() => setActiveTab('overview')} style={navItem(activeTab === 'overview')}><Activity size={18}/> Overview</button>
          <button onClick={() => setActiveTab('events')} style={navItem(activeTab === 'events')}><Calendar size={18}/> Events</button>
          <button onClick={() => setActiveTab('contests')} style={navItem(activeTab === 'contests')}><Trophy size={18}/> Contests</button>
          <button onClick={() => setActiveTab('payouts')} style={navItem(activeTab === 'payouts')}><History size={18}/> Settlements</button>
        </nav>
        <div style={sidebarFooter}>
           <button style={logoutAction} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}><LogOut size={16}/> Logout</button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={contentArea}>
        <header style={topHeader}>
          <div>
            <h2 style={welcomeTitle}>Executive Dashboard</h2>
            <p style={headerSub}>{data.profile?.email}</p>
          </div>
          <div style={headerButtons}>
            <button style={refreshBtn} onClick={() => loadDashboardData(true)}><RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/></button>
            <button style={primaryAction} onClick={() => router.push('/dashboard/organizer/create')}><Plus size={18}/> New Event</button>
          </div>
        </header>

        {/* FINANCIAL HERO SECTION */}
        <section style={heroGrid}>
            <div style={balanceCardLarge}>
                <div style={cardHeaderRow}>
                    <p style={financeLabel}>AVAILABLE BALANCE (95% SPLIT)</p>
                    <div style={statusTag}><ShieldCheck size={12}/> Verified</div>
                </div>
                <h2 style={balanceValueBig}>GHS {stats.availableBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
                <div style={pendingNote}><Clock size={14}/> GHS {stats.pendingWithdrawals.toLocaleString()} processing</div>
                <button style={withdrawMainBtn} onClick={() => setShowWithdrawModal(true)}>WITHDRAW TO MOMO <ArrowUpRight size={18}/></button>
            </div>

            <div style={miniStatsStack}>
                <div style={glassStatCard}>
                    <div style={statIconBox}><Ticket size={18} color="#0ea5e9"/></div>
                    <div><p style={msLabel}>TICKETS SOLD</p><p style={msValue}>{stats.ticketCount}</p></div>
                </div>
                <div style={glassStatCard}>
                    <div style={statIconBox}><Award size={18} color="#f59e0b"/></div>
                    <div><p style={msLabel}>CONTEST VOTES</p><p style={msValue}>{stats.totalVotes.toLocaleString()}</p></div>
                </div>
            </div>
        </section>

        {/* DYNAMIC TAB CONTENT */}
        {activeTab === 'overview' && (
            <div style={mainDataGrid}>
                {/* RECENT EVENTS TABLE */}
                <div style={tableContainer}>
                    <div style={tableHeader}>
                        <h4 style={tableTitle}>Event Performance</h4>
                        <button style={viewAllLink} onClick={() => setActiveTab('events')}>View All</button>
                    </div>
                    <table style={luxuryTable}>
                        <thead>
                            <tr><th style={th}>Event</th><th style={th}>Sales</th><th style={th}>Action</th></tr>
                        </thead>
                        <tbody>
                            {data.events.slice(0, 4).map(e => (
                                <tr key={e.id} style={tr}>
                                    <td style={td}>
                                        <p style={itemMain}>{e.title}</p>
                                        <p style={itemSub}>{new Date(e.date).toLocaleDateString()}</p>
                                    </td>
                                    <td style={td}><p style={itemMain}>GHS {(data.tickets.filter(t => t.event_id === e.id).reduce((s,t) => s+(t.amount||0), 0) * 0.95).toFixed(2)}</p></td>
                                    <td style={td}>
                                        <button style={iconActionBtn} onClick={() => copyLink('events', e.id)}>
                                            {copying === e.id ? <Check size={14} color="#22c55e"/> : <LinkIcon size={14}/>}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* RECENT SETTLEMENTS */}
                <div style={sideListCard}>
                    <h4 style={tableTitle}>Payout History</h4>
                    <div style={listItems}>
                        {data.payouts.slice(0, 5).map(p => (
                            <div key={p.id} style={listItem}>
                                <div style={liIcon}><Banknote size={16}/></div>
                                <div style={liText}>
                                    <p style={liMain}>GHS {p.amount}</p>
                                    <p style={liSub}>{p.status.toUpperCase()}</p>
                                </div>
                                <p style={liDate}>{new Date(p.created_at).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* ADDED FEATURES: CONTESTS VIEW */}
        {activeTab === 'contests' && (
            <div style={contestGrid}>
                {data.contests.map(contest => (
                    <div key={contest.id} style={glassContestCard}>
                        <div style={contestHeader}>
                            <div style={contestBadge}><Trophy size={20}/></div>
                            <h3 style={itemMain}>{contest.title}</h3>
                        </div>
                        <div style={voteMetric}>
                            <p style={msLabel}>TOTAL VOTES</p>
                            <p style={cvValue}>{(contest.candidates?.reduce((a, b) => a + (b.vote_count || 0), 0)).toLocaleString()}</p>
                        </div>
                        <div style={cardActions}>
                             <button style={secondaryBtn} onClick={() => copyLink('voting', contest.id)}>
                                {copying === contest.id ? "COPIED" : "SHARE LINK"}
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>

      {/* WITHDRAWAL MODAL */}
      {showWithdrawModal && (
          <div style={overlay} onClick={() => setShowWithdrawModal(false)}>
              <div style={modal} onClick={e => e.stopPropagation()}>
                  <h2 style={modalTitle}>Withdraw Funds</h2>
                  <p style={modalSub}>Payout to {momoConfig.number} ({momoConfig.network})</p>
                  <input 
                    style={modalInput} 
                    type="number" 
                    placeholder="Enter amount GHS" 
                    value={withdrawAmount} 
                    onChange={e => setWithdrawAmount(e.target.value)}
                  />
                  <button style={modalSubmit} onClick={handleWithdraw} disabled={isProcessing}>
                      {isProcessing ? "Processing..." : "Confirm Payout"}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}

// --- LUXURY STYLES ---
const dashboardWrapper = { display: 'flex', height: '100vh', backgroundColor: '#000', color: '#fff' };
const sidebar = { width: '260px', borderRight: '1px solid #27272a', padding: '40px 20px', display: 'flex', flexDirection: 'column' };
const sidebarLogo = { fontSize: '22px', fontWeight: 950, letterSpacing: '-1.5px', marginBottom: '40px' };
const proBadge = { fontSize: '10px', background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle' };
const sideNav = { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 };
const navItem = (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 15px', borderRadius: '12px', border: 'none', background: active ? '#27272a' : 'transparent', color: active ? '#fff' : '#71717a', fontSize: '14px', fontWeight: 700, cursor: 'pointer', textAlign: 'left' });
const contentArea = { flex: 1, padding: '40px 50px', overflowY: 'auto', background: '#09090b' };
const topHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const welcomeTitle = { fontSize: '28px', fontWeight: 900, margin: 0 };
const headerSub = { color: '#71717a', margin: '5px 0 0', fontSize: '14px' };
const headerButtons = { display: 'flex', gap: '12px' };
const refreshBtn = { width: '45px', height: '45px', borderRadius: '12px', border: '1px solid #27272a', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const primaryAction = { background: '#fff', color: '#000', border: 'none', padding: '0 20px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };

const heroGrid = { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '25px', marginBottom: '40px' };
const balanceCardLarge = { background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)', border: '1px solid #27272a', padding: '40px', borderRadius: '30px' };
const cardHeaderRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#71717a', letterSpacing: '1px' };
const statusTag = { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '20px' };
const balanceValueBig = { fontSize: '54px', fontWeight: 950, margin: '20px 0', letterSpacing: '-2px' };
const pendingNote = { fontSize: '12px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '6px' };
const withdrawMainBtn = { marginTop: '30px', width: '100%', padding: '16px', borderRadius: '15px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

const miniStatsStack = { display: 'flex', flexDirection: 'column', gap: '20px' };
const glassStatCard = { background: '#18181b', border: '1px solid #27272a', borderRadius: '25px', padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' };
const statIconBox = { width: '50px', height: '50px', background: '#09090b', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const msLabel = { fontSize: '10px', fontWeight: 800, color: '#71717a', margin: 0 };
const msValue = { fontSize: '24px', fontWeight: 900, margin: '5px 0 0' };

const mainDataGrid = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '25px' };
const tableContainer = { background: '#18181b', border: '1px solid #27272a', borderRadius: '25px', padding: '30px' };
const tableHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const tableTitle = { margin: 0, fontSize: '18px', fontWeight: 800 };
const viewAllLink = { background: 'none', border: 'none', color: '#0ea5e9', fontWeight: 700, cursor: 'pointer' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', fontSize: '11px', color: '#71717a', padding: '10px', borderBottom: '1px solid #27272a' };
const tr = { borderBottom: '1px solid #27272a' };
const td = { padding: '15px 10px' };
const itemMain = { fontSize: '14px', fontWeight: 800, margin: 0 };
const itemSub = { fontSize: '11px', color: '#71717a', margin: '4px 0 0' };
const iconActionBtn = { background: '#27272a', border: 'none', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' };

const sideListCard = { background: '#18181b', border: '1px solid #27272a', borderRadius: '25px', padding: '30px' };
const listItems = { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' };
const listItem = { display: 'flex', alignItems: 'center', gap: '12px' };
const liIcon = { width: '35px', height: '35px', background: '#27272a', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' };
const liText = { flex: 1 };
const liMain = { fontSize: '13px', fontWeight: 700, margin: 0 };
const liSub = { fontSize: '10px', color: '#71717a', margin: 0 };
const liDate = { fontSize: '11px', color: '#71717a' };

const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' };
const glassContestCard = { background: '#18181b', border: '1px solid #27272a', padding: '25px', borderRadius: '25px' };
const contestHeader = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' };
const contestBadge = { width: '40px', height: '40px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const voteMetric = { background: '#09090b', padding: '15px', borderRadius: '15px', marginBottom: '20px' };
const cvValue = { fontSize: '28px', fontWeight: 950, margin: '5px 0 0' };
const cardActions = { display: 'flex', gap: '10px' };
const secondaryBtn = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #27272a', background: 'transparent', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer' };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: '#18181b', border: '1px solid #27272a', padding: '40px', borderRadius: '30px', width: '100%', maxWidth: '400px' };
const modalTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const modalSub = { color: '#71717a', fontSize: '14px', margin: '10px 0 30px' };
const modalInput = { width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #27272a', background: '#09090b', color: '#fff', fontSize: '18px', fontWeight: 800, marginBottom: '20px', outline: 'none' };
const modalSubmit = { width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: '#fff', color: '#000', fontWeight: 900, cursor: 'pointer' };

const fullPageLoader = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' };
const loaderLogo = { letterSpacing: '5px', fontSize: '14px', marginTop: '20px' };
const sidebarFooter = { paddingTop: '20px', borderTop: '1px solid #27272a' };
const logoutAction = { border: 'none', background: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };
