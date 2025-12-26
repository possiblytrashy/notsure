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
  Banknote, CreditCard, ShieldCheck, History
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE DATA STATE ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    payouts: [], // Now representing Paystack transfers/settlements
    tickets: [], 
    profile: null 
  });

  // --- 2. LUXURY ANALYTICS STATE ---
  const [stats, setStats] = useState({
    totalGross: 0,
    organizerShare: 0, // The 95%
    platformFees: 0,   // The 5%
    ticketCount: 0,
    activeEvents: 0
  });

  // --- 3. UI STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');

  // --- 4. THE DATA ENGINE (Integrated with your Split Logic) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Fetching Multi-tier tickets and Events
      const [eventsRes, ticketsRes, payoutsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      // Calculate split logic: 95% to Organizer, 5% to Platform
      const gross = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const organizerShare = gross * 0.95;
      const platformFees = gross * 0.05;

      setStats({
        totalGross: gross,
        organizerShare: organizerShare,
        platformFees: platformFees,
        ticketCount: myTickets.length,
        activeEvents: eventsRes.data?.length || 0
      });

      setData({
        events: eventsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: user
      });

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
      <Loader2 className="animate-spin" size={48} color="#000"/>
      <h2 style={{marginTop: '24px', fontWeight: 900, letterSpacing: '-1px'}}>SECURE ACCESS...</h2>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* Header */}
      <div style={topNav}>
        <h1 style={logoText}>LUXE <span style={badgePro}>ORGANIZER</span></h1>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <p style={userRole}>Verified Merchant</p>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={20} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={20}/>
           </button>
        </div>
      </div>

      {/* Financial Overview - Split Logic Presentation */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <p style={financeLabel}>NET SETTLEMENT (95%)</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              <div style={pendingTag}>
                <ShieldCheck size={12}/> Paystack Split Active (5% Platform Fee Deducted)
              </div>
            </div>
            <div style={iconCircleLarge}><Banknote size={32} color="#0ea5e9"/></div>
          </div>
          
          <div style={financeActionRow}>
            <button style={withdrawBtn} onClick={() => router.push('/dashboard/organizer/onboarding')}>
              MANAGE PAYOUT ACCOUNT <Settings size={18}/>
            </button>
          </div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <p style={statLabel}>GROSS SALES</p>
            <p style={statNumber}>GHS {stats.totalGross.toLocaleString()}</p>
            <TrendingUp size={16} color="#22c55e"/>
          </div>
          <div style={statBox}>
            <p style={statLabel}>TOTAL TICKETS</p>
            <p style={statNumber}>{stats.ticketCount}</p>
            <Ticket size={16} color="#0ea5e9"/>
          </div>
        </div>
      </div>

      <div style={tabBar}>
        <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>
          <Calendar size={18}/> MY EVENTS
        </button>
        <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>
          <History size={18}/> SALES & GUESTS
        </button>
      </div>

      <div style={viewPort}>
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Events Gallery</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={20}/> CREATE LUXE EVENT
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
                      <span style={metaLine}><MapPin size={14}/> {event.location}</span>
                    </div>
                    <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                      GUESTLIST & SALES <ChevronRight size={16}/>
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
              <h2 style={viewTitle}>Transaction Records</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input 
                    style={searchInputField} 
                    placeholder="Search guest or reference..." 
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
                    <th style={tableTh}>GUEST</th>
                    <th style={tableTh}>TIER / EVENT</th>
                    <th style={tableTh}>PRICE</th>
                    <th style={tableTh}>REF</th>
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
                      <td style={tableTd}>
                        <p style={{margin: 0, fontWeight: 700}}>{t.tier_name || 'Standard'}</p>
                        <p style={guestMuted}>{t.events?.title}</p>
                      </td>
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd}><code style={codeRef}>{t.reference}</code></td>
                      <td style={tableTd}>
                        {t.is_scanned ? 
                          <span style={scannedPill}>CHECKED IN</span> : 
                          <span style={activePill}>VALID</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={qrContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '20px', fontWeight: 900}}>Event Entry QR</h3>
            <div style={qrBorder}>
               <img src={showQR} style={{width: '100%'}} alt="QR"/>
            </div>
            <button style={downloadBtn} onClick={() => window.open(showQR)}>
              <Download size={18}/> SAVE QR CODE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- STYLES (Maintaining Luxury Aesthetic) ---
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const mainWrapper = { padding: '40px 20px 100px', maxWidth: '1280px', margin: '0 auto', background: '#fcfdfe', minHeight: '100vh', fontFamily: '"Inter", sans-serif' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' };
const logoText = { fontSize: '24px', fontWeight: 950, letterSpacing: '-1.5px', margin: 0 };
const badgePro = { background: '#000', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '6px', verticalAlign: 'middle', marginLeft: '10px' };
const headerActions = { display: 'flex', gap: '15px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700 };
const userRole = { margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 600 };
const circleAction = { width: '45px', height: '45px', borderRadius: '15px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };
const logoutCircle = { width: '45px', height: '45px', borderRadius: '15px', border: 'none', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#e11d48' };

const financeGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px', marginBottom: '50px' };
const balanceCard = { background: '#000', borderRadius: '35px', padding: '40px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', margin: '0 0 10px' };
const balanceValue = { fontSize: '48px', fontWeight: 950, margin: 0, letterSpacing: '-2px' };
const pendingTag = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#0ea5e9', marginTop: '10px', fontWeight: 600 };
const iconCircleLarge = { width: '70px', height: '70px', borderRadius: '25px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const financeActionRow = { display: 'flex', gap: '12px', marginTop: '30px' };
const withdrawBtn = { flex: 1, background: '#fff', color: '#000', border: 'none', padding: '16px', borderRadius: '18px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '14px' };

const statsOverview = { display: 'grid', gridTemplateColumns: '1fr', gap: '15px' };
const statBox = { background: '#fff', padding: '20px 30px', borderRadius: '25px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statLabel = { margin: 0, fontSize: '11px', fontWeight: 800, color: '#94a3b8' };
const statNumber = { margin: '5px 0 0', fontSize: '22px', fontWeight: 900 };

const tabBar = { display: 'flex', gap: '30px', borderBottom: '1px solid #e2e8f0', marginBottom: '40px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '3px solid #0ea5e9' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '10px' });

const viewPort = { minHeight: '400px' };
const fadeAnim = { animation: 'fadeIn 0.4s ease-out' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const addBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' };

const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const itemCard = { background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const itemImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f8fafc', position: 'relative' });
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' };
const miniAction = { width: '35px', height: '35px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 10px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 500 };
const fullWidthBtn = { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };

const filterGroup = { display: 'flex', gap: '10px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0 15px' };
const searchInputField = { border: 'none', padding: '10px', fontSize: '13px', outline: 'none', width: '200px' };
const eventDropdown = { padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 };

const tableWrapper = { background: '#fff', borderRadius: '25px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableTh = { padding: '20px', background: '#f8fafc', fontSize: '11px', fontWeight: 800, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' };
const tableTr = { borderBottom: '1px solid #f8fafc' };
const tableTd = { padding: '20px', fontSize: '13px' };
const guestBold = { margin: 0, fontWeight: 700 };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8' };
const codeRef = { background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace' };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 };
const scannedPill = { background: '#f1f5f9', color: '#94a3b8', padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 900 };

const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' };
const qrContent = { background: '#fff', padding: '40px', borderRadius: '35px', textAlign: 'center', maxWidth: '400px', width: '100%' };
const qrBorder = { padding: '20px', border: '1px solid #f1f5f9', borderRadius: '25px', marginBottom: '20px' };
const downloadBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };
