"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Trophy, Settings, Link as LinkIcon, Check, 
  QrCode, Loader2, LogOut, Search, RefreshCcw, MapPin, 
  ShieldCheck, Zap, TrendingUp, BarChart3, DownloadCloud,
  Activity, UserPlus, CreditCard, Layout, Trash, ChevronRight, 
  DollarSign, UserCheck, Bell, Mail, Smartphone, Info, 
  AlertCircle, CheckCircle2, ArrowRight, X, ExternalLink,
  MoreVertical, Eye, Filter, Share2, Calendar, Users,
  ArrowUpRight, PieChart, Wallet, ShieldAlert, Clock,
  ChevronDown, Copy, SmartphoneNfc, Globe, Heart, Star,
  Send, Layers, Fingerprint, Landmark, Sparkles
} from 'lucide-react';

/**
 * OUSTED ULTIMATE ORGANIZER COMMAND CENTER
 * Version: 2.4.0 (Luxury Dark/Light Hybrid)
 */

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. SYSTEM STATE ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('performance'); 
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [copying, setCopying] = useState(null);
  
  // --- 2. DATA STATE ---
  const [data, setData] = useState({ 
    events: [], 
    tickets: [], 
    profile: null,
    payouts: [],
    recentSales: []
  });

  // --- 3. FORM STATE (ONBOARDING) ---
  const [bizForm, setBizForm] = useState({ 
    businessName: '', 
    bankName: '', 
    accountNumber: '', 
    accountName: '',
    agreedToTerms: false 
  });

  // --- 4. THE DATA ENGINE ---
  const refreshDashboard = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return router.push('/login');

      // Step A: Fetch Profile & Event IDs
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const { data: events } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('organizer_id', user.id)
        .order('created_at', { ascending: false });

      const eventIds = events?.map(e => e.id) || [];

      // Step B: Fetch Tickets (Multi-Tier Join)
      let tickets = [];
      if (eventIds.length > 0) {
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('*, ticket_tiers(name, price), events(title)')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false });
        tickets = ticketData || [];
      }

      setData({
        profile: profile,
        events: events || [],
        tickets: tickets,
        recentSales: tickets.slice(0, 15)
      });

      // Step C: Check Onboarding Status
      if (!profile?.paystack_subaccount_code || !profile?.onboarding_completed) {
        setShowOnboarding(true);
      }

    } catch (err) {
      console.error("DASHBOARD_LOAD_ERROR", err);
    } finally {
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 600);
    }
  }, [router]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  // --- 5. FINANCIAL CALCULATIONS (5% SPLIT LOGIC) ---
  const analytics = useMemo(() => {
    const gross = data.tickets.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const commission = gross * 0.05;
    const net = gross - commission;
    const checkIns = data.tickets.filter(t => t.is_scanned).length;
    
    return { gross, commission, net, checkIns };
  }, [data.tickets]);

  // --- 6. ACTIONS ---
  const handleCopyLink = (eventId) => {
    const url = `${window.location.origin}/book/${eventId}`;
    navigator.clipboard.writeText(url);
    setCopying(eventId);
    setTimeout(() => setCopying(null), 2000);
  };

  const handleOnboardingSubmit = async () => {
    if (!bizForm.accountNumber || !bizForm.bankName) return alert("Please fill all details.");
    
    setRefreshing(true);
    // Simulate Paystack Subaccount Creation Logic
    const subaccountCode = `ACCT_${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
    
    const { error } = await supabase
      .from('profiles')
      .update({
        business_name: bizForm.businessName,
        paystack_subaccount_code: subaccountCode,
        onboarding_completed: true,
        bank_details: {
            bank: bizForm.bankName,
            acc_no: bizForm.accountNumber,
            acc_name: bizForm.accountName
        }
      })
      .eq('id', data.profile.id);

    if (!error) {
      setShowOnboarding(false);
      refreshDashboard(true);
    }
  };

  // --- 7. UI COMPONENTS ---

  if (loading) return <LuxuryLoader />;

  return (
    <div style={dashboardWrapper}>
      
      {/* HEADER SECTION */}
      <header style={headerNav}>
        <div style={logoArea}>
          <div style={logoIcon}><Fingerprint size={28} color="#000"/></div>
          <div>
            <h1 style={logoText}>OUSTED</h1>
            <p style={subText}>Organiser Intelligence</p>
          </div>
        </div>

        <div style={tabSwitcher}>
          <button style={tabBtn(activeTab === 'performance')} onClick={() => setActiveTab('performance')}>Performance</button>
          <button style={tabBtn(activeTab === 'events')} onClick={() => setActiveTab('events')}>Events</button>
          <button style={tabBtn(activeTab === 'tickets')} onClick={() => setActiveTab('tickets')}>Tickets</button>
        </div>

        <div style={userControl}>
          <button style={iconBtn} onClick={() => refreshDashboard(true)}>
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
          </button>
          <div style={profilePill}>
             <div style={avatar}>{data.profile?.business_name?.[0] || 'A'}</div>
             <span>{data.profile?.business_name || 'Admin'}</span>
          </div>
          <button style={logoutBtn} onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}>
            <LogOut size={18}/>
          </button>
        </div>
      </header>

      {/* PERFORMANCE OVERVIEW (ACTIVE TAB) */}
      {activeTab === 'performance' && (
        <div style={contentFadeIn}>
          {/* WEALTH CARD */}
          <div style={wealthSection}>
            <div style={mainWealthCard}>
              <div style={wealthHeader}>
                <span style={wealthLabel}>SETTLED REVENUE (GHS)</span>
                <div style={statusPill}><div style={pulseDot}/> LIVE SYSTEM</div>
              </div>
              <h2 style={wealthAmount}>{analytics.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              
              <div style={wealthBreakdown}>
                <div style={breakdownItem}>
                  <p style={bLabel}>Gross Sales</p>
                  <p style={bValue}>GHS {analytics.gross.toLocaleString()}</p>
                </div>
                <div style={breakdownItem}>
                  <p style={bLabel}>Platform Fee (5%)</p>
                  <p style={bValue}>- GHS {analytics.commission.toLocaleString()}</p>
                </div>
                <div style={wealthActions}>
                  <button style={withdrawBtn}><Wallet size={16}/> SETTLEMENT HISTORY</button>
                  <button style={settingsBtn}><Settings size={18}/></button>
                </div>
              </div>
            </div>

            <div style={secondaryStats}>
              <div style={statBox}>
                <div style={statIcon}><Users size={20} color="#6366f1"/></div>
                <div>
                  <h3 style={statNum}>{data.tickets.length}</h3>
                  <p style={statLab}>Total Attendees</p>
                </div>
              </div>
              <div style={statBox}>
                <div style={statIcon}><UserCheck size={20} color="#10b981"/></div>
                <div>
                  <h3 style={statNum}>{analytics.checkIns}</h3>
                  <p style={statLab}>Checked In</p>
                </div>
              </div>
              <div style={statBox}>
                <div style={statIcon}><TrendingUp size={20} color="#f59e0b"/></div>
                <div>
                  <h3 style={statNum}>{data.events.length}</h3>
                  <p style={statLab}>Experiences</p>
                </div>
              </div>
            </div>
          </div>

          <div style={bottomGrid}>
            {/* RECENT SALES */}
            <div style={salesCol}>
              <div style={secHeader}>
                <h3 style={secTitle}>Recent Transactions</h3>
                <button style={utilBtn}><DownloadCloud size={16}/> CSV</button>
              </div>
              <div style={salesList}>
                {data.recentSales.map(ticket => (
                  <div key={ticket.id} style={saleItem}>
                    <div style={saleAvatar}><CreditCard size={16}/></div>
                    <div style={saleInfo}>
                      <p style={saleName}>{ticket.guest_name || 'Anonymous Guest'}</p>
                      <p style={saleMeta}>{ticket.events?.title} • {ticket.ticket_tiers?.name}</p>
                    </div>
                    <div style={salePrice}>+GHS {(ticket.amount * 0.95).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div style={actionCol}>
               <h3 style={secTitle}>Management</h3>
               <div style={actionGrid}>
                  <button style={actionCard} onClick={() => router.push('/dashboard/create')}>
                    <Plus size={24}/>
                    <span>New Event</span>
                  </button>
                  <button style={actionCard}>
                    <Trophy size={24}/>
                    <span>Contests</span>
                  </button>
                  <button style={actionCard}>
                    <Mail size={24}/>
                    <span>Broadcaster</span>
                  </button>
                  <button style={actionCard}>
                    <BarChart3 size={24}/>
                    <span>Insights</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div style={contentFadeIn}>
          <div style={secHeader}>
            <h3 style={secTitle}>Curated Experiences</h3>
            <button style={primaryBtn} onClick={() => router.push('/dashboard/create')}>
              <Plus size={18}/> CREATE NEW
            </button>
          </div>
          
          <div style={eventGrid}>
            {data.events.map(event => (
              <div key={event.id} style={eventCard}>
                <div style={eventImg(event.image_url)}>
                  <div style={eventBadge}>{event.status?.toUpperCase()}</div>
                </div>
                <div style={eventBody}>
                  <h4 style={eTitle}>{event.title}</h4>
                  <p style={eDate}><Calendar size={12}/> {new Date(event.date).toLocaleDateString()}</p>
                  
                  <div style={eTiers}>
                    {event.ticket_tiers?.map(tier => (
                      <span key={tier.id} style={tierPill}>{tier.name}</span>
                    ))}
                  </div>

                  <div style={eFooter}>
                    <button style={manageBtn} onClick={() => router.push(`/dashboard/events/${event.id}`)}>MANAGE</button>
                    <button style={copyBtn} onClick={() => handleCopyLink(event.id)}>
                      {copying === event.id ? <Check size={16} color="#10b981"/> : <LinkIcon size={16}/>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TICKETS TAB */}
      {activeTab === 'tickets' && (
         <div style={contentFadeIn}>
            <div style={secHeader}>
              <h3 style={secTitle}>Audience Ledger</h3>
              <div style={searchBox}>
                <Search size={16} color="#94a3b8"/>
                <input style={searchInput} placeholder="Search by name, email or ID..."/>
              </div>
            </div>

            <div style={tableContainer}>
               <table style={luxuryTable}>
                  <thead>
                    <tr>
                      <th style={th}>GUEST</th>
                      <th style={th}>EVENT</th>
                      <th style={th}>TIER</th>
                      <th style={th}>NET REVENUE</th>
                      <th style={th}>STATUS</th>
                      <th style={th}>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tickets.map(t => (
                      <tr key={t.id} style={tr}>
                        <td style={td}>
                          <p style={tdName}>{t.guest_name}</p>
                          <p style={tdEmail}>{t.guest_email}</p>
                        </td>
                        <td style={td}>{t.events?.title}</td>
                        <td style={td}><span style={tierBadge}>{t.ticket_tiers?.name}</span></td>
                        <td style={td}>GHS {(t.amount * 0.95).toFixed(2)}</td>
                        <td style={td}>
                          {t.is_scanned ? 
                            <span style={scanBadge(true)}><Check size={10}/> ADMITTED</span> : 
                            <span style={scanBadge(false)}><Clock size={10}/> PENDING</span>
                          }
                        </td>
                        <td style={td}>{new Date(t.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* ONBOARDING OVERLAY */}
      {showOnboarding && (
        <div style={overlay}>
           <div style={modal}>
              <div style={modalDeco}><Sparkles size={32} color="#0ea5e9"/></div>
              <h2 style={modalTitle}>Finalize Your Account</h2>
              <p style={modalSub}>Link your business bank account to enable Paystack-powered payouts. We handle the 5% split automatically.</p>
              
              <div style={form}>
                 <div style={inputGroup}>
                    <label style={label}>Business / Legal Name</label>
                    <input style={input} placeholder="Ousted Luxury Events" onChange={e => setBizForm({...bizForm, businessName: e.target.value})}/>
                 </div>
                 
                 <div style={row}>
                    <div style={inputGroup}>
                        <label style={label}>Bank Name</label>
                        <select style={input} onChange={e => setBizForm({...bizForm, bankName: e.target.value})}>
                           <option>Select Bank</option>
                           <option value="access">Access Bank</option>
                           <option value="gtb">GT Bank</option>
                           <option value="ecobank">Ecobank</option>
                        </select>
                    </div>
                    <div style={inputGroup}>
                        <label style={label}>Account Number</label>
                        <input style={input} placeholder="0123456789" onChange={e => setBizForm({...bizForm, accountNumber: e.target.value})}/>
                    </div>
                 </div>

                 <div style={infoBox}>
                    <ShieldCheck size={18} color="#0ea5e9"/>
                    <p>Settlements are disbursed every 24 hours to this account.</p>
                 </div>

                 <button style={submitBtn} onClick={handleOnboardingSubmit}>
                    ACTIVATE COMMAND CENTER <ChevronRight size={18}/>
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}

// --- 8. LUXURY STYLING ENGINE ---

const dashboardWrapper = { 
  minHeight: '100vh', 
  background: '#f8fafc', 
  padding: '40px 60px', 
  fontFamily: '"Inter", sans-serif',
  color: '#0f172a'
};

const headerNav = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: '50px' 
};

const logoArea = { display: 'flex', alignItems: 'center', gap: '15px' };
const logoIcon = { width: '50px', height: '50px', background: '#fff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' };
const logoText = { fontSize: '20px', fontWeight: 900, margin: 0, letterSpacing: '-1px' };
const subText = { fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' };

const tabSwitcher = { background: '#fff', padding: '6px', borderRadius: '16px', display: 'flex', gap: '5px', border: '1px solid #e2e8f0' };
const tabBtn = (active) => ({ 
  padding: '10px 22px', 
  border: 'none', 
  borderRadius: '12px', 
  background: active ? '#000' : 'transparent', 
  color: active ? '#fff' : '#64748b', 
  fontSize: '13px', 
  fontWeight: 700, 
  cursor: 'pointer',
  transition: 'all 0.2s ease'
});

const userControl = { display: 'flex', alignItems: 'center', gap: '15px' };
const profilePill = { display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', padding: '6px 14px', borderRadius: '50px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 700 };
const avatar = { width: '26px', height: '26px', background: '#000', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' };
const iconBtn = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const logoutBtn = { background: '#fee2e2', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer' };

const wealthSection = { display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '30px', marginBottom: '60px' };
const mainWealthCard = { background: '#000', borderRadius: '40px', padding: '50px', color: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const wealthHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const wealthLabel = { fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '2px' };
const statusPill = { background: '#1e293b', padding: '6px 14px', borderRadius: '50px', fontSize: '10px', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' };
const pulseDot = { width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' };
const wealthAmount = { fontSize: '64px', fontWeight: 950, margin: '25px 0', letterSpacing: '-3px' };
const wealthBreakdown = { borderTop: '1px solid #1e293b', paddingTop: '30px', display: 'flex', flexDirection: 'column', gap: '15px' };
const breakdownItem = { display: 'flex', justifyContent: 'space-between', fontSize: '14px' };
const bLabel = { color: '#64748b' };
const bValue = { fontWeight: 700 };
const wealthActions = { display: 'flex', gap: '15px', marginTop: '20px' };
const withdrawBtn = { flex: 1, background: '#fff', color: '#000', border: 'none', padding: '16px', borderRadius: '18px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' };
const settingsBtn = { width: '55px', background: '#1e293b', border: 'none', borderRadius: '18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const secondaryStats = { display: 'flex', flexDirection: 'column', gap: '20px' };
const statBox = { background: '#fff', padding: '30px', borderRadius: '30px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '20px' };
const statIcon = { width: '50px', height: '50px', background: '#f8fafc', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statNum = { fontSize: '28px', fontWeight: 900, margin: 0 };
const statLab = { fontSize: '12px', color: '#94a3b8', fontWeight: 700, margin: 0 };

const bottomGrid = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '50px' };
const secHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const secTitle = { fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' };
const utilBtn = { background: '#fff', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: '12px', fontSize: '12px', fontWeight: 700, display: 'flex', gap: '8px', cursor: 'pointer' };

const salesList = { background: '#fff', borderRadius: '35px', border: '1px solid #e2e8f0', padding: '10px', maxHeight: '500px', overflowY: 'auto' };
const saleItem = { display: 'flex', alignItems: 'center', gap: '15px', padding: '20px', borderBottom: '1px solid #f8fafc' };
const saleAvatar = { width: '45px', height: '45px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const saleInfo = { flex: 1 };
const saleName = { margin: 0, fontWeight: 800, fontSize: '14px' };
const saleMeta = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const salePrice = { fontWeight: 900, color: '#10b981', fontSize: '14px' };

const actionGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const actionCard = { background: '#fff', border: '1px solid #e2e8f0', padding: '40px 20px', borderRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', cursor: 'pointer', transition: 'transform 0.2s ease' };

const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' };
const eventCard = { background: '#fff', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const eventImg = (url) => ({ height: '200px', background: url ? `url(${url}) center/cover` : '#f1f5f9', padding: '20px' });
const eventBadge = { background: '#000', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, display: 'inline-block' };
const eventBody = { padding: '25px' };
const eTitle = { fontSize: '18px', fontWeight: 800, margin: '0 0 8px' };
const eDate = { fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '15px' };
const eTiers = { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '25px' };
const tierPill = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: '#64748b' };
const eFooter = { display: 'flex', gap: '10px' };
const manageBtn = { flex: 1, background: '#000', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '12px', cursor: 'pointer' };
const copyBtn = { width: '45px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const tableContainer = { background: '#fff', borderRadius: '30px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const luxuryTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const th = { padding: '20px 25px', background: '#fafafa', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' };
const tr = { borderBottom: '1px solid #f8fafc' };
const td = { padding: '25px' };
const tdName = { margin: 0, fontWeight: 800, fontSize: '14px' };
const tdEmail = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const tierBadge = { background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 };
const scanBadge = (done) => ({ padding: '6px 12px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, background: done ? '#f0fdf4' : '#fff7ed', color: done ? '#16a34a' : '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '5px' });

const overlay = { position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modal = { background: '#fff', width: '500px', borderRadius: '45px', padding: '50px', boxShadow: '0 30px 60px -12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', textAlign: 'center' };
const modalDeco = { marginBottom: '25px', display: 'inline-block', padding: '20px', background: '#f0f9ff', borderRadius: '24px' };
const modalTitle = { fontSize: '28px', fontWeight: 950, margin: '0 0 15px', letterSpacing: '-1px' };
const modalSub = { color: '#64748b', fontSize: '15px', lineHeight: 1.6, marginBottom: '35px' };
const form = { textAlign: 'left' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
const label = { fontSize: '12px', fontWeight: 800, color: '#0f172a' };
const input = { padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', outline: 'none' };
const row = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '15px' };
const infoBox = { display: 'flex', gap: '10px', alignItems: 'center', background: '#f0f9ff', padding: '15px', borderRadius: '15px', fontSize: '12px', color: '#0369a1', marginBottom: '30px', fontWeight: 600 };
const submitBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' };

const contentFadeIn = { animation: 'fadeIn 0.5s ease-out' };

const LuxuryLoader = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
     <div style={{ textAlign: 'center' }}>
        <Loader2 className="animate-spin" size={40} color="#000"/>
        <h2 style={{ fontSize: '18px', fontWeight: 900, marginTop: '20px', letterSpacing: '4px' }}>OUSTED</h2>
     </div>
  </div>
);

const primaryBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' };
const searchBox = { position: 'relative', display: 'flex', alignItems: 'center' };
const searchInput = { padding: '12px 12px 12px 40px', borderRadius: '14px', border: '1px solid #e2e8f0', width: '300px', fontSize: '13px' };
