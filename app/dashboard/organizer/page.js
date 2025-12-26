"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Trophy, Settings, Link as LinkIcon, Check, 
  QrCode, Loader2, LogOut, Search, RefreshCcw, MapPin, 
  ShieldCheck, Zap, TrendingUp, BarChart3, DownloadCloud,
  Activity, UserPlus, CreditCard, Layout, Trash, ChevronRight, 
  DollarSign, UserCheck, Landmark, Bell, Mail, Smartphone,
  Info, AlertCircle, CheckCircle2, ArrowRight, X, HelpCircle
} from 'lucide-react';

/**
 * OUSTED CORE v10.0 - LUXURY EVENT ENGINE
 * FEATURES: 
 * - Skeleton Loading States
 * - Interactive Paystack Onboarding Flow
 * - Sidebar-less Top Navigation
 * - Real-time Financial Split Logic (5%)
 */

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- ENGINE STATE ---
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('events'); 
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // --- DATA REPOSITORIES ---
  const [data, setData] = useState({ 
    events: [], 
    competitions: [], 
    tickets: [], 
    profile: null,
    scans: []
  });

  // --- UI CONTROLS ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [onboardingStep, setOnboardingStep] = useState(1);

  // --- PAYSTACK ONBOARDING STATE ---
  const [formData, setFormData] = useState({
    business_name: '',
    bank_code: '',
    account_number: '',
    phone: ''
  });

  // --- DATA SYNC ENGINE ---
  const initSync = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) return router.push('/login');

      // Fetch Profile & Events
      const [profileRes, eventsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*, ticket_tiers(*)').eq('organizer_id', user.id).order('created_at', { ascending: false })
      ]);

      const eventIds = eventsRes.data?.map(e => e.id) || [];

      // Fetch Tickets & Contests based on found events
      const [ticketsRes, compRes] = await Promise.all([
        eventIds.length > 0 
          ? supabase.from('tickets').select('*, ticket_tiers(name, price), events(title)').in('event_id', eventIds).order('created_at', { ascending: false })
          : { data: [] },
        supabase.from('competitions').select('*, contests(*, candidates(*))').eq('organizer_id', user.id)
      ]);

      setData({
        profile: profileRes.data,
        events: eventsRes.data || [],
        competitions: compRes.data || [],
        tickets: ticketsRes.data || [],
        scans: (ticketsRes.data || []).filter(t => t.is_scanned)
      });

      // Auto-trigger onboarding if subaccount is missing
      if (!profileRes.data?.paystack_subaccount_code) {
        setShowOnboarding(true);
      }

    } catch (error) {
      console.error("SYNC_ERROR", error);
    } finally {
      setTimeout(() => { setLoading(false); setRefreshing(false); }, 800);
    }
  }, [router]);

  useEffect(() => { initSync(); }, [initSync]);

  // --- FINANCIAL CALCULATION (5% SPLIT) ---
  const stats = useMemo(() => {
    const gross = data.tickets.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const fee = gross * 0.05;
    const net = gross - fee;
    const checkInRate = data.tickets.length > 0 ? (data.scans.length / data.tickets.length) * 100 : 0;
    return { gross, fee, net, checkInRate };
  }, [data.tickets, data.scans]);

  // --- HANDLERS ---
  const handleOnboarding = async () => {
    setRefreshing(true);
    // Logic for creating Paystack Subaccount via your backend/edge function would go here
    const { error } = await supabase.from('profiles').update({
      business_name: formData.business_name,
      onboarding_completed: true,
      paystack_subaccount_code: 'pending_verification' // Example placeholder
    }).eq('id', data.profile.id);

    if (!error) {
      setShowOnboarding(false);
      initSync(true);
    }
  };

  const copyLink = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/events/${id}`);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  // --- UI RENDER: SKELETON LOADER ---
  if (loading) return <DashboardSkeleton />;

  return (
    <div style={appWrapper}>
      
      {/* HEADER NAVIGATION */}
      <header style={headerStyle}>
        <div style={headerContainer}>
          <div style={logoSection}>
            <div style={logoIcon}><Activity size={22} color="#fff"/></div>
            <span style={logoText}>OUSTED <span style={logoSub}>CORE</span></span>
          </div>

          <div style={navLinks}>
            <button onClick={() => setActiveTab('events')} style={navBtn(activeTab === 'events')}>Events</button>
            <button onClick={() => setActiveTab('sales')} style={navBtn(activeTab === 'sales')}>Finance</button>
            <button onClick={() => setActiveTab('contests')} style={navBtn(activeTab === 'contests')}>Contests</button>
          </div>

          <div style={actionSection}>
            <button style={utilBtn} onClick={() => initSync(true)}>
              <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
            </button>
            <div style={profilePill}>
              <div style={avatar}>{data.profile?.business_name?.[0] || 'U'}</div>
              <span style={profileName}>{data.profile?.business_name || 'Organizer'}</span>
            </div>
            <button style={logout} onClick={() => router.push('/logout')}><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main style={mainContent}>
        
        {/* TOP METRICS BAR */}
        <section style={metricsRow}>
          <div style={mainMetricCard}>
            <p style={metricLabel}>SETTLEMENT BALANCE</p>
            <h2 style={metricValue}>GHS {stats.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            <div style={metricFooter}>
              <span style={tag}><ShieldCheck size={14}/> 95% Organizer Split</span>
              <span style={tag}><Zap size={14}/> Instant Settlement</span>
            </div>
          </div>
          <div style={subMetricGrid}>
            <div style={subCard}>
              <p style={subLabel}>Active Tickets</p>
              <h3 style={subValue}>{data.tickets.length}</h3>
            </div>
            <div style={subCard}>
              <p style={subLabel}>Check-in Rate</p>
              <h3 style={subValue}>{stats.checkInRate.toFixed(1)}%</h3>
            </div>
          </div>
        </section>

        {/* DYNAMIC CONTENT */}
        <div style={viewWrapper}>
          {activeTab === 'events' && (
            <div style={animateIn}>
              <div style={viewHeader}>
                <h2 style={viewTitle}>Event Manager</h2>
                <button style={primaryBtn} onClick={() => router.push('/dashboard/create')}>
                  <Plus size={18}/> NEW EVENT
                </button>
              </div>
              
              <div style={eventGrid}>
                {data.events.map(event => (
                  <div key={event.id} style={eventCard}>
                    <div style={eventImage(event.images?.[0])}>
                      <div style={eventBadge}>ACTIVE</div>
                    </div>
                    <div style={eventInfo}>
                      <h4 style={eventTitleText}>{event.title}</h4>
                      <p style={eventLoc}><MapPin size={14}/> {event.location || 'Accra, Ghana'}</p>
                      
                      <div style={eventActions}>
                        <button style={actionIconBtn} onClick={() => copyLink(event.id)}>
                          {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                        </button>
                        <button style={actionIconBtn} onClick={() => setShowQR(event.id)}><QrCode size={16}/></button>
                        <button style={manageBtn}>DASHBOARD <ArrowRight size={14}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div style={animateIn}>
              <div style={viewHeader}>
                <h2 style={viewTitle}>Financial Ledger</h2>
                <div style={searchWrapper}>
                  <Search size={18} color="#94a3b8"/>
                  <input 
                    style={searchInput} 
                    placeholder="Filter by guest name..." 
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div style={tableCard}>
                <table style={table}>
                  <thead>
                    <tr style={tableHeadRow}>
                      <th style={th}>GUEST</th>
                      <th style={th}>EVENT</th>
                      <th style={th}>GROSS</th>
                      <th style={th}>FEES (5%)</th>
                      <th style={th}>NET</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tickets.filter(t => t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase())).map(t => (
                      <tr key={t.id} style={tableRow}>
                        <td style={td}><b>{t.guest_name}</b><br/><small style={{color:'#94a3b8'}}>{t.reference}</small></td>
                        <td style={td}>{t.events?.title}</td>
                        <td style={td}>GHS {t.amount}</td>
                        <td style={td} style={{color:'#ef4444'}}>- GHS {(t.amount * 0.05).toFixed(2)}</td>
                        <td style={td} style={{color:'#22c55e', fontWeight: 800}}>GHS {(t.amount * 0.95).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* INTERACTIVE ONBOARDING OVERLAY */}
      {showOnboarding && (
        <div style={overlay}>
          <div style={onboardingCard}>
            <div style={onboardingHeader}>
              <div style={onboardingIcon}><Landmark size={28} color="#000"/></div>
              <h2 style={onboardingTitle}>Setup Payouts</h2>
              <p style={onboardingSub}>Connect your bank to receive your 95% split automatically via Paystack.</p>
            </div>

            <div style={onboardingBody}>
              <div style={inputGroup}>
                <label style={label}>Registered Business Name</label>
                <input 
                  style={input} 
                  placeholder="e.g. Ousted Events Ltd"
                  value={formData.business_name}
                  onChange={e => setFormData({...formData, business_name: e.target.value})}
                />
              </div>
              <div style={inputRow}>
                <div style={inputGroup}>
                  <label style={label}>Bank Name</label>
                  <select style={input} onChange={e => setFormData({...formData, bank_code: e.target.value})}>
                    <option value="">Select Bank</option>
                    <option value="058">GT Bank</option>
                    <option value="044">Access Bank</option>
                    <option value="013">Ecobank</option>
                  </select>
                </div>
                <div style={inputGroup}>
                  <label style={label}>Account Number</label>
                  <input 
                    style={input} 
                    placeholder="0012345678"
                    value={formData.account_number}
                    onChange={e => setFormData({...formData, account_number: e.target.value})}
                  />
                </div>
              </div>
              
              <div style={onboardingInfo}>
                <Info size={16}/>
                <p>Funds are settled 24 hours after each successful ticket sale.</p>
              </div>

              <button style={onboardSubmit} onClick={handleOnboarding}>
                COMPLETE SETUP <ChevronRight size={18}/>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- STYLING: SKELETON LOADER ---
const DashboardSkeleton = () => (
  <div style={appWrapper}>
    <div style={{...headerStyle, opacity: 0.5}}></div>
    <div style={mainContent}>
      <div style={{height: '200px', background: '#e2e8f0', borderRadius: '30px', marginBottom: '30px'}} className="animate-pulse"></div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px'}}>
        {[1,2,3].map(i => (
          <div key={i} style={{height: '350px', background: '#e2e8f0', borderRadius: '24px'}} className="animate-pulse"></div>
        ))}
      </div>
    </div>
  </div>
);

// --- STYLING: CORE ENGINE ---
const appWrapper = { minHeight: '100vh', background: '#fcfcfd', color: '#1a1a1a', fontFamily: 'Inter, system-ui' };

const headerStyle = { height: '80px', background: '#fff', borderBottom: '1px solid #f1f1f1', position: 'sticky', top: 0, zIndex: 100 };
const headerContainer = { maxWidth: '1200px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' };
const logoSection = { display: 'flex', alignItems: 'center', gap: '12px' };
const logoIcon = { width: '36px', height: '36px', background: '#000', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const logoText = { fontWeight: 900, letterSpacing: '-0.5px', fontSize: '18px' };
const logoSub = { color: '#94a3b8', fontWeight: 400 };

const navLinks = { display: 'flex', gap: '8px', background: '#f8f9fa', padding: '4px', borderRadius: '12px' };
const navBtn = (active) => ({
  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
  background: active ? '#fff' : 'transparent', color: active ? '#000' : '#64748b', boxShadow: active ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: '0.2s'
});

const actionSection = { display: 'flex', alignItems: 'center', gap: '16px' };
const utilBtn = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' };
const profilePill = { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', border: '1px solid #f1f1f1', borderRadius: '50px' };
const avatar = { width: '24px', height: '24px', borderRadius: '50%', background: '#000', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 };
const profileName = { fontSize: '13px', fontWeight: 700 };
const logout = { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' };

const mainContent = { maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' };
const metricsRow = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '48px' };
const mainMetricCard = { background: '#000', color: '#fff', padding: '40px', borderRadius: '32px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)' };
const metricLabel = { fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '1.5px' };
const metricValue = { fontSize: '48px', fontWeight: 900, margin: '12px 0', letterSpacing: '-2px' };
const metricFooter = { display: 'flex', gap: '16px' };
const tag = { fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 };

const subMetricGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' };
const subCard = { background: '#fff', border: '1px solid #f1f1f1', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
const subLabel = { fontSize: '13px', color: '#64748b', fontWeight: 600 };
const subValue = { fontSize: '28px', fontWeight: 900, margin: '8px 0 0' };

const viewWrapper = { minHeight: '400px' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' };
const viewTitle = { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' };
const primaryBtn = { background: '#000', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' };

const eventGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' };
const eventCard = { background: '#fff', border: '1px solid #f1f1f1', borderRadius: '24px', overflow: 'hidden', transition: 'transform 0.2s ease' };
const eventImage = (u) => ({ height: '180px', background: u ? `url(${u}) center/cover` : '#f8f9fa', position: 'relative', padding: '16px' });
const eventBadge = { background: '#22c55e', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, display: 'inline-block' };
const eventInfo = { padding: '20px' };
const eventTitleText = { margin: '0 0 6px', fontSize: '17px', fontWeight: 800 };
const eventLoc = { fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' };
const eventActions = { display: 'flex', gap: '8px', alignItems: 'center' };
const actionIconBtn = { width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #f1f1f1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const manageBtn = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #000', background: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

const searchWrapper = { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', border: '1px solid #f1f1f1', padding: '0 16px', borderRadius: '12px', width: '300px' };
const searchInput = { border: 'none', outline: 'none', height: '44px', fontSize: '14px', width: '100%', fontWeight: 600 };

const tableCard = { background: '#fff', border: '1px solid #f1f1f1', borderRadius: '24px', overflow: 'hidden' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableHeadRow = { background: '#f8f9fa' };
const th = { padding: '16px 24px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' };
const td = { padding: '20px 24px', borderBottom: '1px solid #f8f9fa', fontSize: '14px' };
const tableRow = { cursor: 'pointer' };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' };
const onboardingCard = { background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' };
const onboardingHeader = { padding: '40px 40px 20px', textAlign: 'center' };
const onboardingIcon = { width: '64px', height: '64px', background: '#f1f1f1', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' };
const onboardingTitle = { fontSize: '24px', fontWeight: 800, margin: 0 };
const onboardingSub = { fontSize: '15px', color: '#64748b', marginTop: '8px', lineHeight: 1.5 };
const onboardingBody = { padding: '0 40px 40px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', flex: 1 };
const inputRow = { display: 'flex', gap: '16px' };
const label = { fontSize: '12px', fontWeight: 700, color: '#1a1a1a' };
const input = { padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' };
const onboardingInfo = { display: 'flex', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '16px', marginBottom: '24px', fontSize: '13px', color: '#475569', lineHeight: 1.4 };
const onboardSubmit = { width: '100%', padding: '16px', borderRadius: '16px', background: '#000', color: '#fff', border: 'none', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer' };

const animateIn = { animation: 'fadeIn 0.5s ease-out' };
