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

  // --- 1. STATE ---
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

  // --- 2. DATA ENGINE (ROBUST & SECURE) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
        router.push('/login');
        return;
      }

      const user = session.user;

      // Check profile for subaccount
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

      // Fetch All Data Parallelized
      const [eventsRes, contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      const grossRev = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const netRev = grossRev * 0.95; // Your 5% Logic
      
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
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const filteredEvents = useMemo(() => {
    return data.events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [data.events, searchQuery]);

  // --- 3. LOADING STATE ---
  if (loading) return (
    <div style={fullPageCenter}>
      <div style={luxuryLoaderRing}></div>
      <h2 style={loadingLogo}>OUSTED</h2>
    </div>
  );

  // --- 4. ONBOARDING GATE ---
  if (!isOnboarded) return (
    <div style={mainWrapper}>
      <div style={onboardContainer}>
        <div style={premiumBadge}>ACTIVATION REQUIRED</div>
        <h1 style={onboardTitle}>Secure Payout <br/>Infrastructure</h1>
        <p style={onboardSub}>Connect your settlement account to unlock the premium organizer suite and automated 95/5 revenue splits.</p>
        <button style={primaryBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
          COMPLETE SETUP <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  // --- 5. MAIN LUXURY DASHBOARD ---
  return (
    <div style={mainWrapper}>
      {/* Top Navigation */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={proBadge}>PRO</span></h1>
          <p style={breadcrumb}>MEMBER SINCE {new Date(data.profile?.created_at).getFullYear() || '2025'}</p>
        </div>
        
        <div style={headerActions}>
           <div style={searchBox}>
              <Search size={16} color="#94a3b8" />
              <input 
                style={searchInput} 
                placeholder="Search events..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           <button style={iconBtn} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
           </button>
           <button style={logoutBtn} onClick={handleLogout}><LogOut size={18} /></button>
        </div>
      </div>

      {/* Hero Financials */}
      <div style={heroGrid}>
        <div style={mainBalanceCard}>
          <div style={cardTop}>
            <p style={cardLabel}>TOTAL NET REVENUE (95%)</p>
            <div style={livePulse}><div style={pulseDot}></div> LIVE</div>
          </div>
          <h2 style={bigAmount}>GHS {stats.netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div style={cardFooter}>
            <div style={subStat}>
              <span style={subStatLabel}>GROSS SALES</span>
              <span style={subStatValue}>GHS {stats.grossRevenue.toLocaleString()}</span>
            </div>
            <div style={subStat}>
              <span style={subStatLabel}>OUSTED FEE (5%)</span>
              <span style={subStatValue}>- GHS {(stats.grossRevenue * 0.05).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={sideStatsStack}>
          <div style={miniStatCard}>
            <div style={statIconArea}><Ticket size={20} /></div>
            <div>
              <p style={miniLabel}>TICKETS SOLD</p>
              <h3 style={miniValue}>{stats.ticketCount}</h3>
            </div>
          </div>
          <div style={miniStatCard}>
            <div style={statIconArea}><Award size={20} /></div>
            <div>
              <p style={miniLabel}>CONTEST VOTES</p>
              <h3 style={miniValue}>{stats.totalVotes}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div style={controlBar}>
        <div style={tabs}>
          <button onClick={() => setActiveTab('events')} style={tabLink(activeTab === 'events')}>EVENTS</button>
          <button onClick={() => setActiveTab('sales')} style={tabLink(activeTab === 'sales')}>SALES</button>
          <button onClick={() => setActiveTab('payouts')} style={tabLink(activeTab === 'payouts')}>PAYOUTS</button>
        </div>
        <button style={createBtn} onClick={() => router.push('/dashboard/organizer/events/create')}>
          <Plus size={18} /> CREATE EVENT
        </button>
      </div>

      {/* Dynamic Viewport */}
      <div style={tableWrapper}>
        {activeTab === 'events' && (
          <table style={luxuryTable}>
            <thead>
              <tr>
                <th style={th}>EVENT DETAILS</th>
                <th style={th}>STATUS</th>
                <th style={th}>NET EARNINGS</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(event => (
                <tr key={event.id} style={tr}>
                  <td style={td}>
                    <div style={eventInfo}>
                      <div style={eventIcon}><Calendar size={16} /></div>
                      <div>
                        <p style={eventTitle}>{event.title}</p>
                        <p style={eventSub}>{event.location} • {new Date(event.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td style={td}><span style={statusBadge}>ACTIVE</span></td>
                  <td style={td}><p style={rowAmount}>GHS {(data.tickets.filter(t => t.event_id === event.id).reduce((s,t) => s + (t.amount||0), 0) * 0.95).toFixed(2)}</p></td>
                  <td style={td}>
                    <button style={circleAction}><Settings size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'sales' && (
           <table style={luxuryTable}>
             <thead>
               <tr>
                 <th style={th}>TICKET REF</th>
                 <th style={th}>CUSTOMER</th>
                 <th style={th}>AMOUNT (95%)</th>
                 <th style={th}>DATE</th>
               </tr>
             </thead>
             <tbody>
               {data.tickets.map(t => (
                 <tr key={t.id} style={tr}>
                   <td style={td}><code style={code}>#{t.id.slice(0,8)}</code></td>
                   <td style={td}>{t.customer_email}</td>
                   <td style={td}><span style={positive}>GHS {(t.amount * 0.95).toFixed(2)}</span></td>
                   <td style={td}>{new Date(t.created_at).toLocaleDateString()}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        )}
      </div>
    </div>
  );
}

// --- STYLES ---
const mainWrapper = { padding: '50px 40px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', backgroundColor: '#fafafa', color: '#000', fontFamily: 'Inter, sans-serif' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' };
const logoText = { fontSize: '24px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const proBadge = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', marginLeft: '8px', verticalAlign: 'middle' };
const breadcrumb = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginTop: '5px' };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const searchBox = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', display: 'flex', alignItems: 'center', padding: '0 15px', gap: '10px' };
const searchInput = { border: 'none', padding: '12px 0', outline: 'none', fontSize: '14px', width: '200px' };
const iconBtn = { width: '45px', height: '45px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoutBtn = { ...iconBtn, color: '#e11d48', background: '#fff1f2', border: 'none' };

const heroGrid = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px', marginBottom: '50px' };
const mainBalanceCard = { background: '#000', color: '#fff', padding: '50px', borderRadius: '40px', position: 'relative', overflow: 'hidden' };
const cardTop = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const cardLabel = { fontSize: '11px', fontWeight: 900, color: '#71717a', letterSpacing: '2px' };
const bigAmount = { fontSize: '64px', fontWeight: 950, margin: '30px 0', letterSpacing: '-3px' };
const livePulse = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 900, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '6px 12px', borderRadius: '20px' };
const pulseDot = { width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%' };
const cardFooter = { display: 'flex', gap: '40px', borderTop: '1px solid #27272a', paddingTop: '30px' };
const subStat = { display: 'flex', flexDirection: 'column', gap: '5px' };
const subStatLabel = { fontSize: '10px', color: '#71717a', fontWeight: 800 };
const subStatValue = { fontSize: '16px', fontWeight: 700 };

const sideStatsStack = { display: 'flex', flexDirection: 'column', gap: '20px' };
const miniStatCard = { background: '#fff', border: '1px solid #e2e8f0', padding: '30px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '20px' };
const statIconArea = { width: '50px', height: '50px', background: '#f8fafc', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const miniLabel = { fontSize: '11px', color: '#94a3b8', fontWeight: 800, margin: 0 };
const miniValue = { fontSize: '28px', fontWeight: 950, margin: '5px 0' };

const controlBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e2e8f0' };
const tabs = { display: 'flex', gap: '40px' };
const tabLink = (active) => ({ paddingBottom: '20px', border: 'none', background: 'none', fontSize: '13px', fontWeight: 800, color: active ? '#000' : '#94a3b8', cursor: 'pointer', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const createBtn = { background: '#000', color: '#fff', padding: '14px 25px', borderRadius: '14px', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '20px' };

const tableWrapper = { background: '#fff', borderRadius: '35px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const th = { padding: '25px', background: '#fafafa', fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px' };
const tr = { borderBottom: '1px solid #f1f5f9' };
const td = { padding: '25px', fontSize: '14px' };
const eventInfo = { display: 'flex', alignItems: 'center', gap: '15px' };
const eventIcon = { width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const eventTitle = { fontWeight: 800, margin: 0 };
const eventSub = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' };
const rowAmount = { fontWeight: 900, fontSize: '16px' };
const statusBadge = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const circleAction = { width: '35px', height: '35px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const code = { background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 };
const positive = { color: '#16a34a', fontWeight: 800 };

const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const luxuryLoaderRing = { width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 1s linear infinite' };
const loadingLogo = { letterSpacing: '8px', fontWeight: 950, fontSize: '20px', marginTop: '20px' };

const onboardContainer = { textAlign: 'center', padding: '100px 20px', maxWidth: '600px', margin: '0 auto' };
const premiumBadge = { fontSize: '11px', fontWeight: 900, color: '#0ea5e9', letterSpacing: '3px', marginBottom: '20px' };
const onboardTitle = { fontSize: '48px', fontWeight: 950, letterSpacing: '-2.5px', lineHeight: 1, marginBottom: '25px' };
const onboardSub = { fontSize: '18px', color: '#64748b', lineHeight: 1.6, marginBottom: '40px' };
const primaryBtn = { background: '#000', color: '#fff', padding: '20px 40px', borderRadius: '20px', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', margin: '0 auto' };
