"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, Ticket, Calendar, Trophy, Wallet, Settings, 
  Link as LinkIcon, Check, QrCode, Download, X,
  Loader2, LogOut, Search, RefreshCcw, MoreHorizontal,
  ChevronRight, MapPin, Award, AlertCircle, Info,
  ShieldCheck, History, Zap, TrendingUp, Users, 
  BarChart3, ArrowUpRight, Filter, DownloadCloud,
  Eye, MousePointer2, Share2, Star, Clock, Trash2, Edit3,
  Layers, Activity, ChevronDown, Sparkles
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- 1. CORE DATA STATE ---
  const [activeTab, setActiveTab] = useState('events');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. UI STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  
  const [paystackConfig, setPaystackConfig] = useState({
    businessName: "", bankCode: "", accountNumber: "", subaccountCode: "", isVerified: false
  });

  // --- 3. DATA ENGINE ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const [profileRes, eventsRes, contestsRes, ticketsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];
      
      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        tickets: myTickets,
        profile: { ...user, ...profileRes.data }
      });

      if (profileRes.data?.paystack_subaccount_code) {
        setPaystackConfig({
          businessName: profileRes.data.business_name || "",
          bankCode: profileRes.data.bank_code || "",
          accountNumber: profileRes.data.account_number || "",
          subaccountCode: profileRes.data.paystack_subaccount_code,
          isVerified: true
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  // --- 4. ANALYTICS ENGINE (95/5 SPLIT) ---
  const stats = useMemo(() => {
    const totalGross = data.tickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const totalVotes = data.contests.reduce((acc, c) => 
      acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0);
    const scanned = data.tickets.filter(t => t.is_scanned).length;
    
    return {
      totalGross,
      organizerShare: totalGross * 0.95,
      ticketCount: data.tickets.length,
      activeEvents: data.events.length,
      totalVotes,
      scanRate: data.tickets.length ? Math.round((scanned / data.tickets.length) * 100) : 0,
      avgTicketValue: data.tickets.length ? totalGross / data.tickets.length : 0
    };
  }, [data]);

  const filteredTickets = useMemo(() => {
    return data.tickets.filter(t => {
      const matchesSearch = t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                            t.reference?.toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
      return matchesSearch && matchesEvent;
    });
  }, [data.tickets, ticketSearch, selectedEventFilter]);

  // --- 5. ACTION HANDLERS ---
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  const copyLink = (path, id) => {
    const url = `${window.location.origin}/${path}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id); setTimeout(() => setCopying(null), 2000);
  };

  const saveOnboardingDetails = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('profiles').update({
        business_name: paystackConfig.businessName,
        bank_code: paystackConfig.bankCode,
        account_number: paystackConfig.accountNumber,
      }).eq('id', data.profile.id);
      if (error) throw error;
      setShowSettingsModal(false);
      loadDashboardData(true);
    } catch (err) { alert("Update failed."); } finally { setIsProcessing(false); }
  };

  if (loading) return (
    <div style={fullPageCenter}>
      <div style={shimmerLogo}>OUSTED</div>
      <Loader2 className="animate-spin" size={32} color="#000"/>
    </div>
  );

  return (
    <div style={mainWrapper}>
      {/* HEADER SECTION */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgeLuxury}>PRIVATE</span></h1>
          <p style={subLabel}>Luxury Event Ecosystem</p>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <div style={onboardingBadge(paystackConfig.subaccountCode)}>
               <div style={dot(paystackConfig.subaccountCode)}></div>
               {paystackConfig.subaccountCode ? '95/5 SPLITS ACTIVE' : 'PENDING ONBOARDING'}
             </div>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={18}/>
           </button>
        </div>
      </div>

      {/* FINANCE HERO */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={cardHeader}>
            <div style={balanceInfo}>
              <p style={financeLabel}>AVAILABLE TO PAYOUT</p>
              <h2 style={balanceValue}>GHS {stats.organizerShare.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            </div>
            <div style={iconCircleGold}><Sparkles size={24} color="#d4af37"/></div>
          </div>
          <div style={statsRow}>
            <div style={miniStat}><Activity size={14}/> <span>{stats.scanRate}% Check-in Rate</span></div>
            <div style={autoPayoutTag}><Zap size={14} fill="#0ea5e9"/> Auto-Settle Enabled</div>
          </div>
          <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={16}/> SETTINGS
          </button>
        </div>

        <div style={quickStatsGrid}>
          {[
            { label: 'TICKETS SOLD', val: stats.ticketCount, icon: <Ticket size={18} color="#0ea5e9"/>, trend: '+14%' },
            { label: 'TOTAL VOTES', val: stats.totalVotes.toLocaleString(), icon: <Users size={18} color="#8b5cf6"/>, trend: 'Hot' },
            { label: 'AVG. VALUE', val: `GHS ${stats.avgTicketValue.toFixed(0)}`, icon: <BarChart3 size={18} color="#f59e0b"/>, trend: 'Stable' },
            { label: 'CHECKED IN', val: `${stats.scanRate}%`, icon: <ShieldCheck size={18} color="#16a34a"/>, trend: 'Live' }
          ].map((s, i) => (
            <div key={i} style={glassStatCard}>
              <div style={glassHeader}>{s.icon}<span style={statPercent}>{s.trend}</span></div>
              <p style={statLabel}>{s.label}</p>
              <h3 style={statVal}>{s.val}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={tabBar}>
        {['events', 'sales', 'contests', 'analytics'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabItem(activeTab === tab)}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* VIEWPORT */}
      <div style={viewPort}>
        
        {/* EVENTS VIEW */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Event Portfolio</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={18}/> CREATE NEW
              </button>
            </div>
            <div style={cardGrid}>
              {data.events.map(event => (
                <div key={event.id} style={itemCard}>
                  <div style={itemImage(event.images?.[0])}>
                    <div style={imageOverlay}>
                      <div style={cardQuickActions}>
                        <button style={miniAction} onClick={() => copyLink('events', event.id)}>
                          {copying === event.id ? <Check size={14} color="#22c55e"/> : <LinkIcon size={14}/>}
                        </button>
                        <button style={miniAction} onClick={() => setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${window.location.origin}/events/${event.id}`)}>
                          <QrCode size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={itemBody}>
                    <h3 style={itemTitle}>{event.title}</h3>
                    <div style={itemMeta}>
                      <span style={metaLine}><Calendar size={14}/> {new Date(event.date).toLocaleDateString()}</span>
                      <span style={metaLine}><MapPin size={14}/> {event.location}</span>
                    </div>
                    <div style={cardActionRow}>
                      <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                        SALES LEDGER
                      </button>
                      <button style={editBtnCircle}><Edit3 size={18}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SALES VIEW */}
        {activeTab === 'sales' && (
          <div style={fadeAnim}>
             <div style={viewHeader}>
              <h2 style={viewTitle}>Sales Ledger</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input style={searchInputField} placeholder="Guest or Ref..." value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)}/>
                </div>
                <button style={outlineBtn}><Download size={16}/> EXPORT</button>
              </div>
            </div>
            <div style={tableWrapper}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableTh}>GUEST / REF</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>GROSS</th>
                    <th style={tableTh}>NET (95%)</th>
                    <th style={tableTh}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={tableTr}>
                      <td style={tableTd}>
                        <p style={guestBold}>{t.guest_name}</p>
                        <p style={guestMuted}>{t.reference}</p>
                      </td>
                      <td style={tableTd}>{t.events?.title}</td>
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd} style={{fontWeight: 900, color: '#16a34a'}}>
                        GHS {(t.amount * 0.95).toFixed(2)}
                      </td>
                      <td style={tableTd}>
                        {t.is_scanned ? <span style={scannedPill}>USED</span> : <span style={activePill}>VALID</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONTESTS VIEW */}
        {activeTab === 'contests' && (
          <div style={fadeAnim}>
             <div style={sectionTitleRow}>
                <h2 style={viewTitle}>Contest Management</h2>
                <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                  <Plus size={20}/> NEW CONTEST
                </button>
             </div>
             <div style={contestGrid}>
                {data.contests.map(contest => {
                  const sorted = [...(contest.candidates || [])].sort((a,b) => b.vote_count - a.vote_count);
                  return (
                    <div key={contest.id} style={contestCard}>
                       <div style={contestHeader}>
                          <h3 style={{margin:0}}>{contest.title}</h3>
                          <div style={trophyBadge}><Trophy size={16} color="#d4af37"/> TOP</div>
                       </div>
                       <div style={candidateList}>
                          {sorted.map((cand, idx) => (
                            <div key={cand.id} style={candidateRow}>
                               <span style={rankNum}>0{idx + 1}</span>
                               <div style={candInfo}>
                                  <p style={candName}>{cand.name}</p>
                                  <p style={candVotes}>{cand.vote_count} VOTES</p>
                               </div>
                               <div style={voteBarContainer}>
                                  <div style={voteBarFill(idx === 0 ? 100 : (cand.vote_count / sorted[0].vote_count) * 100)}></div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div style={fadeAnim}>
             <div style={sectionTitleRow}>
                <h2 style={viewTitle}>Performance Insights</h2>
                <div style={activityBadge}><Activity size={14}/> LIVE DATA</div>
             </div>
             <div style={analyticsGrid}>
                {data.events.map(event => {
                  const eventSales = data.tickets.filter(t => t.event_id === event.id);
                  const revenue = eventSales.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
                  return (
                    <div key={event.id} style={eventPerformanceCard}>
                       <div style={perfHeader}>
                          <h4 style={perfName}>{event.title}</h4>
                          <span style={perfTag}>LIVE</span>
                       </div>
                       <div style={perfMain}>
                          <p style={perfLabel}>Gross Revenue</p>
                          <h3 style={perfValue}>GHS {revenue.toLocaleString()}</h3>
                          <div style={shareRow}>
                            <span>Your 95%</span>
                            <span>GHS {(revenue * 0.95).toLocaleString()}</span>
                          </div>
                       </div>
                       <div style={perfFooter}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                             <span>Sales Capacity</span>
                             <span>{eventSales.length} sold</span>
                          </div>
                          <div style={progressBar}><div style={progressFill(70)}></div></div>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}
      </div>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Config</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={onboardingPromo}>
              <Zap size={20} color="#0ea5e9"/>
              <p style={{fontSize: '13px', margin: 0}}>Verify bank details to enable 95% instant settlement.</p>
            </div>
            <div style={modalBody}>
              <div style={inputStack}>
                <label style={fieldLabel}>BUSINESS LEGAL NAME</label>
                <input style={modalInput} value={paystackConfig.businessName} onChange={(e) => setPaystackConfig({...paystackConfig, businessName: e.target.value})}/>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>SETTLEMENT DESTINATION</label>
                <select style={modalInput} value={paystackConfig.bankCode} onChange={(e) => setPaystackConfig({...paystackConfig, bankCode: e.target.value})}>
                  <option value="">Select Network</option>
                  <option value="MTN">MTN MoMo</option>
                  <option value="VOD">Vodafone Cash</option>
                  <option value="058">GT Bank</option>
                </select>
              </div>
              <div style={inputStack}>
                <label style={fieldLabel}>ACCOUNT NUMBER</label>
                <input style={modalInput} value={paystackConfig.accountNumber} onChange={(e) => setPaystackConfig({...paystackConfig, accountNumber: e.target.value})}/>
              </div>
              <button 
                style={actionSubmitBtn(isProcessing)} 
                onClick={saveOnboardingDetails} 
                disabled={isProcessing}
              >
                {isProcessing ? 'PROCESSING...' : 'CONFIRM DETAILS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- LUXURY STYLES ---
const mainWrapper = { padding: '50px 30px', maxWidth: '1400px', margin: '0 auto', background: '#fcfcfc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' };
const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const shimmerLogo = { fontSize: '32px', fontWeight: 950, letterSpacing: '-2px', marginBottom: '20px' };
const topNav = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' };
const logoText = { fontSize: '30px', fontWeight: 950, letterSpacing: '-2px', margin: 0 };
const badgeLuxury = { background: '#000', color: '#fff', fontSize: '10px', padding: '5px 12px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '10px' };
const subLabel = { fontSize: '12px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' };
const headerActions = { display: 'flex', gap: '20px', alignItems: 'center' };
const userBrief = { textAlign: 'right' };
const userEmail = { margin: 0, fontSize: '14px', fontWeight: 700, color: '#000' };
const onboardingBadge = (on) => ({ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 800, color: on ? '#16a34a' : '#e11d48', marginTop: '6px' });
const dot = (on) => ({ width: '6px', height: '6px', borderRadius: '50%', background: on ? '#16a34a' : '#e11d48' });
const circleAction = { width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const logoutCircle = { width: '48px', height: '48px', borderRadius: '50%', border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const financeGrid = { display: 'grid', gridTemplateColumns: '1.4fr 2fr', gap: '30px', marginBottom: '60px' };
const balanceCard = { background: '#000', borderRadius: '30px', padding: '50px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' };
const balanceInfo = { display: 'flex', flexDirection: 'column' };
const financeLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '2px' };
const balanceValue = { fontSize: '56px', fontWeight: 950, margin: '20px 0', letterSpacing: '-3px' };
const iconCircleGold = { width: '64px', height: '64px', borderRadius: '22px', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const statsRow = { display: 'flex', gap: '25px', marginBottom: '30px' };
const miniStat = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#16a34a' };
const autoPayoutTag = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0ea5e9', fontWeight: 600 };
const settingsIconBtn = { padding: '15px 30px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start' };
const quickStatsGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const glassStatCard = { background: '#fff', padding: '30px', borderRadius: '25px', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' };
const glassHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' };
const statPercent = { fontSize: '10px', fontWeight: 900, color: '#16a34a', background: '#f0fdf4', padding: '4px 10px', borderRadius: '20px' };
const statLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', margin: '0 0 8px', letterSpacing: '1px' };
const statVal = { fontSize: '28px', fontWeight: 950, margin: 0, color: '#000' };
const tabBar = { display: 'flex', gap: '45px', borderBottom: '1px solid #eee', marginBottom: '60px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 900, cursor: 'pointer', borderBottom: active ? '4px solid #000' : '4px solid transparent', transition: '0.3s' });
const viewPort = { minHeight: '600px' };
const fadeAnim = { animation: 'fadeIn 0.6s ease' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const addBtn = { background: '#000', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const itemCard = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden', transition: '0.3s' };
const itemImage = (url) => ({ height: '240px', background: url ? `url(${url}) center/cover` : '#f8f8f8', position: 'relative' });
const imageOverlay = { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))' };
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' };
const miniAction = { width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 12px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '25px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#64748b', fontWeight: 600 };
const cardActionRow = { display: 'flex', gap: '10px' };
const fullWidthBtn = { flex: 1, background: '#f5f5f5', color: '#000', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '11px', cursor: 'pointer' };
const editBtnCircle = { width: '48px', height: '48px', borderRadius: '12px', border: '1px solid #eee', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const filterGroup = { display: 'flex', gap: '15px' };
const searchBox = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '0 15px' };
const searchInputField = { border: 'none', padding: '12px', outline: 'none', fontSize: '14px', width: '220px' };
const outlineBtn = { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderRadius: '12px', border: '1px solid #eee', background: '#fff', fontWeight: 800, fontSize: '12px', cursor: 'pointer' };
const tableWrapper = { background: '#fff', borderRadius: '24px', border: '1px solid #f0f0f0', overflow: 'hidden' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '20px', background: '#fafafa', fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' };
const tableTr = { borderBottom: '1px solid #f9f9f9' };
const tableTd = { padding: '20px', fontSize: '14px' };
const guestBold = { margin: 0, fontWeight: 800, color: '#000' };
const guestMuted = { margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 600 };
const scannedPill = { background: '#fee2e2', color: '#ef4444', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '6px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const contestGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '30px' };
const contestCard = { background: '#fff', borderRadius: '24px', padding: '35px', border: '1px solid #f0f0f0' };
const contestHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' };
const trophyBadge = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 900, color: '#d4af37', background: '#fffbeb', padding: '6px 12px', borderRadius: '20px' };
const candidateList = { display: 'flex', flexDirection: 'column', gap: '20px' };
const candidateRow = { display: 'grid', gridTemplateColumns: '40px 1.2fr 150px', alignItems: 'center', gap: '20px' };
const rankNum = { fontWeight: 950, color: '#eee', fontSize: '20px' };
const candInfo = { overflow: 'hidden' };
const candName = { margin: 0, fontWeight: 800, fontSize: '15px' };
const candVotes = { margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: 700 };
const voteBarContainer = { height: '8px', background: '#f5f5f5', borderRadius: '10px', overflow: 'hidden' };
const voteBarFill = (w) => ({ width: `${w}%`, height: '100%', background: '#000', borderRadius: '10px' });
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', width: '90%', maxWidth: '450px', borderRadius: '30px', padding: '45px' };
const modalHead = { display: 'flex', justifyContent: 'space-between', marginBottom: '35px' };
const modalTitle = { margin: 0, fontSize: '24px', fontWeight: 950, letterSpacing: '-1px' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const onboardingPromo = { background: '#f0f9ff', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '35px' };
const modalBody = { display: 'flex', flexDirection: 'column', gap: '25px' };
const inputStack = { display: 'flex', flexDirection: 'column', gap: '10px' };
const fieldLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginLeft: '5px' };
const modalInput = { padding: '16px', borderRadius: '14px', border: '1px solid #eee', fontSize: '14px', fontWeight: 600, outline: 'none' };
const actionSubmitBtn = (dis) => ({ background: dis ? '#eee' : '#000', color: '#fff', padding: '18px', borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer', marginTop: '10px' });
const analyticsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '30px' };
const eventPerformanceCard = { background: '#fff', borderRadius: '24px', padding: '35px', border: '1px solid #f0f0f0' };
const perfHeader = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const perfName = { margin: 0, fontSize: '18px', fontWeight: 900 };
const perfTag = { background: '#000', color: '#fff', padding: '5px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: 900 };
const perfMain = { marginBottom: '35px' };
const perfLabel = { fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: 800, textTransform: 'uppercase' };
const perfValue = { fontSize: '32px', fontWeight: 950, margin: 0 };
const shareRow = { display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '13px', color: '#16a34a', fontWeight: 700 };
const perfFooter = { display: 'flex', flexDirection: 'column' };
const progressBar = { height: '10px', background: '#f5f5f5', borderRadius: '10px', overflow: 'hidden' };
const progressFill = (w) => ({ width: `${w}%`, height: '100%', background: '#0ea5e9' });
const activityBadge = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 900, color: '#ef4444', background: '#fef2f2', padding: '6px 15px', borderRadius: '20px' };
const sectionTitleRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
