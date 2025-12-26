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
  ExternalLink, Mail, Phone, MapPin, UserPlus, Award
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- CORE DATA STATE ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    payouts: [], 
    tickets: [], 
    profile: null 
  });

  // --- METRICS STATE ---
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalVotes: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    ticketCount: 0,
    activeContests: 0
  });

  // --- UI & INTERACTION STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  const [momoConfig, setMomoConfig] = useState({
    number: "",
    network: "MTN",
    accountName: ""
  });

  // --- DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch all required tables in parallel for speed
      const [
        eventsRes, 
        contestsRes, 
        payoutsRes, 
        ticketsRes
      ] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title)').order('created_at', { ascending: false })
      ]);

      if (eventsRes.error) throw eventsRes.error;

      // Filter tickets locally to ensure we only see tickets for this organizer's events
      const myEventIds = eventsRes.data.map(e => e.id);
      const myTickets = ticketsRes.data?.filter(t => myEventIds.includes(t.event_id)) || [];

      // Calculate Financials
      const revenue = myTickets.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0) || 0;
      
      const pendingPayouts = payoutsRes.data
        ?.filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0) || 0;

      const totalVotes = contestsRes.data?.reduce((acc, c) => 
        acc + (c.candidates?.reduce((sum, cand) => sum + (cand.vote_count || 0), 0) || 0), 0) || 0;

      // Update States
      setStats({
        totalRevenue: revenue,
        totalVotes: totalVotes,
        availableBalance: revenue - successfulPayouts - pendingPayouts,
        pendingWithdrawals: pendingPayouts,
        ticketCount: myTickets.length,
        activeContests: contestsRes.data?.length || 0
      });

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: myTickets,
        profile: user
      });

    } catch (err) {
      console.error("Critical Dashboard Failure:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- ACTIONS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const deleteResource = async (table, id) => {
    if (!confirm("Warning: This will permanently delete this item and all associated data. Continue?")) return;
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      alert("Error: Data might be linked to existing sales.");
    } else {
      loadDashboardData(true);
    }
  };

  const requestPayout = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) return alert("Minimum withdrawal is GHS 10.");
    if (amount > stats.availableBalance) return alert("Insufficient balance.");

    setIsProcessing(true);
    try {
      const { error } = await supabase.from('payouts').insert([{
        organizer_id: data.profile.id,
        amount: amount,
        momo_number: momoConfig.number,
        momo_network: momoConfig.network,
        status: 'pending'
      }]);

      if (error) throw error;
      
      alert("Payout request logged. Processing usually takes 24 hours.");
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      loadDashboardData(true);
    } catch (err) {
      alert("Failed to submit request. Check connection.");
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

  // --- FILTERING ---
  const processedTickets = data.tickets.filter(t => {
    const searchMatch = t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                        t.reference?.toLowerCase().includes(ticketSearch.toLowerCase());
    const eventMatch = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
    return searchMatch && eventMatch;
  });

  if (loading) return (
    <div style={fullPageCenter}>
      <Loader2 className="animate-spin" size={40} color="#0ea5e9"/>
      <h2 style={{marginTop: '20px', fontWeight: 900}}>SYNCING OUSTED...</h2>
    </div>
  );

  return (
    <div style={mainWrapper}>
      
      {/* HEADER SECTION */}
      <div style={headerContainer}>
        <div>
          <p style={labelMicro}>ORGANIZER CONSOLE</p>
          <h1 style={welcomeHeading}>Welcome back, {data.profile?.email?.split('@')[0]}</h1>
        </div>
        <div style={headerActions}>
           <button style={circleAction} onClick={() => loadDashboardData(true)} title="Refresh Dashboard">
             <RefreshCcw size={20} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout} title="Logout">
             <LogOut size={20}/>
           </button>
        </div>
      </div>

      {/* FINANCIAL OVERVIEW CARD */}
      <div style={financeCard}>
        <div style={financeInfo}>
          <div style={balanceStack}>
            <p style={financeLabel}>AVAILABLE BALANCE</p>
            <h2 style={balanceValue}>GHS {stats.availableBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            <div style={pendingIndicator}>
              <Clock size={12}/> Pending: GHS {stats.pendingWithdrawals.toLocaleString()}
            </div>
          </div>
          <div style={financeButtons}>
            <button style={payoutSettingsBtn} onClick={() => setShowSettingsModal(true)}>
              <Settings size={18}/> MOMO SETTINGS
            </button>
            <button style={withdrawMainBtn} onClick={() => setShowWithdrawModal(true)}>
              WITHDRAW FUNDS <ArrowUpRight size={20}/>
            </button>
          </div>
        </div>
        
        <div style={financeStatsGrid}>
          <div style={miniStatItem}>
            <p style={miniStatLabel}>TOTAL REVENUE</p>
            <p style={miniStatValue}>GHS {stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div style={miniStatItem}>
            <p style={miniStatLabel}>TOTAL TICKETS</p>
            <p style={miniStatValue}>{stats.ticketCount}</p>
          </div>
          <div style={miniStatItem}>
            <p style={miniStatLabel}>TOTAL VOTES</p>
            <p style={miniStatValue}>{stats.totalVotes.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div style={navBar}>
        <button onClick={() => setActiveTab('events')} style={navLink(activeTab === 'events')}>
          <Calendar size={18}/> EVENTS
        </button>
        <button onClick={() => setActiveTab('contests')} style={navLink(activeTab === 'contests')}>
          <Trophy size={18}/> CONTESTS
        </button>
        <button onClick={() => setActiveTab('sales')} style={navLink(activeTab === 'sales')}>
          <Ticket size={18}/> SALES
        </button>
        <button onClick={() => setActiveTab('analytics')} style={navLink(activeTab === 'analytics')}>
          <BarChart3 size={18}/> ANALYTICS
        </button>
      </div>

      {/* DYNAMIC CONTENT */}
      <div style={contentBox}>
        
        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <div style={tabInner}>
            <div style={sectionHeader}>
              <h2 style={sectionTitle}>Manage Events</h2>
              <button style={primaryAddBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={20}/> CREATE NEW EVENT
              </button>
            </div>
            <div style={resourceGrid}>
              {data.events.map(event => (
                <div key={event.id} style={eventCard}>
                  <div style={eventImageArea(event.images?.[0])}>
                    <div style={overlayControls}>
                      <button style={controlBtn} onClick={() => copyLink('events', event.id)}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                      </button>
                      <button style={controlBtn} onClick={() => setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/events/${event.id}`)}>
                        <QrCode size={16}/>
                      </button>
                      <button style={deleteControl} onClick={() => deleteResource('events', event.id)}>
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>
                  <div style={eventDetails}>
                    <h3 style={eventTitleText}>{event.title}</h3>
                    <div style={eventMeta}>
                      <span style={metaItem}><Calendar size={12}/> {new Date(event.date).toLocaleDateString()}</span>
                      <span style={metaItem}><MapPin size={12}/> {event.location || 'Accra'}</span>
                    </div>
                    <div style={cardFooter}>
                      <button style={viewSalesBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                        VIEW SALES <ChevronRight size={14}/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTESTS TAB */}
        {activeTab === 'contests' && (
          <div style={tabInner}>
            <div style={sectionHeader}>
              <h2 style={sectionTitle}>Voting Contests</h2>
              <button style={primaryAddBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                <Plus size={20}/> NEW CONTEST
              </button>
            </div>
            <div style={resourceGrid}>
              {data.contests.map(contest => (
                <div key={contest.id} style={contestCard}>
                  <div style={contestHeaderRow}>
                    <div style={contestIconWrap}><Award size={24} color="#0ea5e9"/></div>
                    <div style={{flex: 1}}>
                      <h3 style={contestName}>{contest.title}</h3>
                      <p style={contestSub}>{contest.candidates?.length || 0} Candidates Active</p>
                    </div>
                    <button style={trashIconButton} onClick={() => deleteResource('contests', contest.id)}><Trash2 size={18}/></button>
                  </div>
                  
                  <div style={voteCounter}>
                    <p style={voteLabel}>CUMULATIVE VOTES</p>
                    <h4 style={voteNumber}>
                      {(contest.candidates?.reduce((a, b) => a + (b.vote_count || 0), 0)).toLocaleString()}
                    </h4>
                  </div>

                  <div style={contestActions}>
                    <button style={contestBtn} onClick={() => copyLink('voting', contest.id)}>
                       {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>} COPY LINK
                    </button>
                    <button style={contestBtn} onClick={() => generateQR('voting', contest.id)}>
                       <QrCode size={14}/> QR CODE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <div style={tabInner}>
            <div style={tableFilterBar}>
              <div style={searchWrapper}>
                <Search size={18} color="#999"/>
                <input 
                  style={searchField} 
                  placeholder="Search attendee or reference..." 
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
              </div>
              <select style={filterSelect} value={selectedEventFilter} onChange={(e) => setSelectedEventFilter(e.target.value)}>
                <option value="all">All Events</option>
                {data.events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>

            <div style={tableContainer}>
              <table style={mainTable}>
                <thead>
                  <tr>
                    <th style={thStyle}>ATTENDEE</th>
                    <th style={thStyle}>EVENT</th>
                    <th style={thStyle}>TIER</th>
                    <th style={thStyle}>AMOUNT</th>
                    <th style={thStyle}>REFERENCE</th>
                    <th style={thStyle}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {processedTickets.map((t) => (
                    <tr key={t.id} style={trStyle}>
                      <td style={tdStyle}>
                        <div style={guestName}>{t.guest_name}</div>
                        <div style={guestEmail}>{t.guest_email}</div>
                      </td>
                      <td style={tdStyle}>{t.events?.title}</td>
                      <td style={tdStyle}><span style={badgeTier}>{t.tier_name || 'Standard'}</span></td>
                      <td style={tdStyle}>GHS {t.amount}</td>
                      <td style={tdStyle}><code style={refCodeStyle}>{t.reference}</code></td>
                      <td style={tdStyle}>
                        {t.is_scanned ? 
                          <span style={scannedTag}><CheckCircle2 size={10}/> SCANNED</span> : 
                          <span style={validTag}>VALID</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div style={tabInner}>
            <div style={analyticsHeader}>
              <h2 style={sectionTitle}>Performance Analytics</h2>
            </div>
            <div style={analyticsGrid}>
              <div style={chartPlaceholderCard}>
                <div style={placeholderIcon}><TrendingUp size={40}/></div>
                <h3>Revenue Growth</h3>
                <p>Visualization will appear as more ticket data is collected.</p>
              </div>
              <div style={chartPlaceholderCard}>
                <div style={placeholderIcon}><Users size={40}/></div>
                <h3>Audience Reach</h3>
                <p>Tracking visitor trends and conversion rates.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showWithdrawModal && (
        <div style={modalOverlay} onClick={() => setShowWithdrawModal(false)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={modalHeaderTitle}>Withdraw Earnings</h2>
            <div style={modalBalanceInfo}>
              <p>Available: GHS {stats.availableBalance.toLocaleString()}</p>
            </div>
            <div style={inputGroup}>
              <label style={inputLabel}>AMOUNT TO WITHDRAW (GHS)</label>
              <input 
                type="number" 
                style={modalInput} 
                placeholder="0.00" 
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div style={warningBox}>
              <AlertCircle size={16}/> Requests are processed within 24-48 hours.
            </div>
            <button 
              style={confirmWithdrawBtn(isProcessing || !withdrawAmount)} 
              onClick={requestPayout}
              disabled={isProcessing || !withdrawAmount}
            >
              {isProcessing ? <Loader2 className="animate-spin"/> : 'CONFIRM WITHDRAWAL'}
            </button>
          </div>
        </div>
      )}

      {showQR && (
        <div style={modalOverlay} onClick={() => setShowQR(null)}>
          <div style={qrModal} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '20px', fontWeight: 900}}>Share Resource</h3>
            <img src={showQR} style={{width: '100%', borderRadius: '20px', border: '1px solid #eee'}} alt="QR Code" />
            <button style={qrDownloadBtn} onClick={() => window.open(showQR)}>DOWNLOAD IMAGE</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- EXTENSIVE STYLING OBJECTS (Totaling 500+ lines of code) ---
const mainWrapper = { padding: '80px 20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' };
const headerContainer = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' };
const labelMicro = { fontSize: '10px', fontWeight: 900, color: '#0ea5e9', letterSpacing: '2px', marginBottom: '8px' };
const welcomeHeading = { margin: 0, fontSize: '32px', fontWeight: 900, letterSpacing: '-1px' };
const headerActions = { display: 'flex', gap: '12px' };
const circleAction = { width: '50px', height: '50px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' };
const logoutCircle = { width: '50px', height: '50px', borderRadius: '50%', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

const financeCard = { background: '#000', color: '#fff', borderRadius: '40px', padding: '50px', marginBottom: '50px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
const financeInfo = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #333', paddingBottom: '40px' };
const balanceStack = { display: 'flex', flexDirection: 'column', gap: '5px' };
const financeLabel = { margin: 0, fontSize: '12px', fontWeight: 800, color: '#666', letterSpacing: '1px' };
const balanceValue = { margin: 0, fontSize: '56px', fontWeight: 900, letterSpacing: '-2px' };
const pendingIndicator = { fontSize: '12px', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 };
const financeButtons = { display: 'flex', flexDirection: 'column', gap: '12px' };
const withdrawMainBtn = { background: '#fff', color: '#000', border: 'none', padding: '18px 30px', borderRadius: '20px', fontWeight: 900, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const payoutSettingsBtn = { background: 'transparent', color: '#fff', border: '1px solid #333', padding: '14px 25px', borderRadius: '18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' };

const financeStatsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' };
const miniStatItem = { display: 'flex', flexDirection: 'column', gap: '5px' };
const miniStatLabel = { fontSize: '10px', fontWeight: 800, color: '#555' };
const miniStatValue = { fontSize: '20px', fontWeight: 900 };

const navBar = { display: 'flex', gap: '40px', borderBottom: '2px solid #f1f5f9', marginBottom: '40px', overflowX: 'auto' };
const navLink = (active) => ({ padding: '20px 0', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '3px solid #0ea5e9' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.3s' });

const contentBox = { minHeight: '600px' };
const tabInner = { animation: 'fadeIn 0.5s ease' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const sectionTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const primaryAddBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '15px 25px', borderRadius: '18px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };

const resourceGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const eventCard = { background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', overflow: 'hidden', transition: 'transform 0.2s' };
const eventImageArea = (url) => ({ height: '200px', background: url ? `url(${url}) center/cover` : '#f8fafc', position: 'relative' });
const overlayControls = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' };
const controlBtn = { width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const deleteControl = { width: '38px', height: '38px', borderRadius: '12px', background: '#fff1f2', color: '#e11d48', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const eventDetails = { padding: '25px' };
const eventTitleText = { margin: '0 0 10px', fontSize: '20px', fontWeight: 900 };
const eventMeta = { display: 'flex', gap: '15px', color: '#64748b', fontSize: '12px', fontWeight: 600, marginBottom: '20px' };
const metaItem = { display: 'flex', alignItems: 'center', gap: '5px' };
const cardFooter = { borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const viewSalesBtn = { width: '100%', background: '#f8fafc', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };

const contestCard = { background: '#fff', padding: '30px', borderRadius: '35px', border: '1px solid #f1f5f9' };
const contestHeaderRow = { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px' };
const contestIconWrap = { width: '55px', height: '55px', borderRadius: '18px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const contestName = { margin: 0, fontWeight: 900, fontSize: '18px' };
const contestSub = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const trashIconButton = { background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' };
const voteCounter = { background: '#f8fafc', padding: '20px', borderRadius: '25px', marginBottom: '25px' };
const voteLabel = { margin: '0 0 5px', fontSize: '10px', fontWeight: 900, color: '#94a3b8' };
const voteNumber = { margin: 0, fontSize: '28px', fontWeight: 900 };
const contestActions = { display: 'flex', gap: '10px' };
const contestBtn = { flex: 1, background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };

const tableFilterBar = { display: 'flex', gap: '20px', marginBottom: '30px' };
const searchWrapper = { flex: 1, background: '#f8fafc', borderRadius: '18px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e2e8f0' };
const searchField = { border: 'none', background: 'none', padding: '15px 0', width: '100%', outline: 'none', fontWeight: 600 };
const filterSelect = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px 25px', borderRadius: '18px', fontWeight: 800, outline: 'none' };
const tableContainer = { background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', overflow: 'hidden' };
const mainTable = { width: '100%', borderCollapse: 'collapse' };
const thStyle = { textAlign: 'left', padding: '20px', background: '#fafafa', fontSize: '11px', fontWeight: 900, color: '#64748b', borderBottom: '1px solid #f1f5f9' };
const tdStyle = { padding: '20px', borderBottom: '1px solid #f8fafc', fontSize: '14px' };
const trStyle = { transition: 'background 0.2s' };
const guestName = { fontWeight: 800 };
const guestEmail = { fontSize: '12px', color: '#94a3b8' };
const badgeTier = { background: '#f1f5f9', padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, color: '#475569' };
const refCodeStyle = { background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' };
const scannedTag = { background: '#fff1f2', color: '#e11d48', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' };
const validTag = { background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: 900, padding: '4px 8px', borderRadius: '6px' };

const analyticsHeader = { marginBottom: '40px' };
const analyticsGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px' };
const chartPlaceholderCard = { height: '350px', background: '#fff', borderRadius: '40px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' };
const placeholderIcon = { width: '80px', height: '80px', borderRadius: '25px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', marginBottom: '20px' };

const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', padding: '50px', borderRadius: '45px', width: '90%', maxWidth: '500px' };
const modalHeaderTitle = { margin: '0 0 10px', fontWeight: 900, fontSize: '28px' };
const modalBalanceInfo = { background: '#f0f9ff', padding: '15px 25px', borderRadius: '15px', marginBottom: '30px', fontWeight: 800, color: '#0ea5e9' };
const inputGroup = { marginBottom: '25px' };
const inputLabel = { display: 'block', fontSize: '10px', fontWeight: 900, marginBottom: '10px', color: '#94a3b8' };
const modalInput = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '20px', borderRadius: '20px', fontSize: '24px', fontWeight: 900, outline: 'none' };
const warningBox = { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', background: '#fffbeb', color: '#92400e', borderRadius: '15px', fontSize: '12px', fontWeight: 700, marginBottom: '30px' };

const confirmWithdrawBtn = (disabled) => ({ 
  width: '100%', 
  background: disabled ? '#eee' : '#000', 
  color: disabled ? '#aaa' : '#fff', 
  padding: '22px', 
  borderRadius: '25px', 
  border: 'none', 
  fontWeight: 900, 
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

const qrModal = { background: '#fff', padding: '40px', borderRadius: '40px', width: '320px', textAlign: 'center' };
const qrDownloadBtn = { marginTop: '20px', width: '100%', background: '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
