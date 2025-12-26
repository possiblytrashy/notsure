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
    contests: [], 
    payouts: [], 
    tickets: [], 
    profile: null 
  });

  // --- 2. FINANCIAL & ANALYTICS STATE ---
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalVotes: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
    withdrawnToDate: 0,
    ticketCount: 0,
    activeContests: 0
  });

  // --- 3. UI & MODAL STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');
  
  // Mobile Money Preferences
  const [momoConfig, setMomoConfig] = useState({
    number: "",
    network: "MTN",
    accountName: ""
  });

  // --- 4. THE DATA ENGINE (CRITICAL PAYMENT LOGIC) ---
  const loadDashboardData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      // Auth validation
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error("Auth session missing");
        router.push('/login');
        return;
      }

      // Parallel data fetching for performance
      const [
        eventsRes, 
        contestsRes, 
        payoutsRes, 
        ticketsRes
      ] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').eq('organizer_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*, events(title, organizer_id)').order('created_at', { ascending: false })
      ]);

      // Check for fetch errors
      if (eventsRes.error) console.warn("Events load error:", eventsRes.error);
      if (payoutsRes.error) console.warn("Payouts load error:", payoutsRes.error);

      // Filter tickets to only those belonging to this organizer
      // In production, RLS usually handles this, but we filter here for redundancy
      const myTickets = ticketsRes.data?.filter(t => t.events?.organizer_id === user.id) || [];

      // FINANCIAL CALCULATIONS - STRICT MATH
      const grossRevenue = myTickets.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      
      const successfulPayouts = payoutsRes.data
        ?.filter(p => p.status === 'success')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;
      
      const pendingPayouts = payoutsRes.data
        ?.filter(p => p.status === 'pending')
        .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) || 0;

      const totalVotes = contestsRes.data?.reduce((acc, c) => 
        acc + (c.candidates?.reduce((sum, cand) => sum + (parseInt(cand.vote_count) || 0), 0) || 0), 0) || 0;

      // Update Analytics State
      setStats({
        totalRevenue: grossRevenue,
        totalVotes: totalVotes,
        availableBalance: Math.max(0, grossRevenue - successfulPayouts - pendingPayouts),
        pendingWithdrawals: pendingPayouts,
        withdrawnToDate: successfulPayouts,
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

      // Load MoMo settings from user metadata if they exist
      if (user.user_metadata?.momo_number) {
        setMomoConfig({
          number: user.user_metadata.momo_number,
          network: user.user_metadata.momo_network || "MTN",
          accountName: user.user_metadata.account_name || ""
        });
      }

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

  const deleteResource = async (table, id) => {
    if (!confirm("Are you sure? This will delete all linked data permanently.")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert("Could not delete. Check if resource is currently active.");
    else loadDashboardData(true);
  };

  const submitWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    
    // Validations
    if (!amount || amount < 5) return alert("Minimum withdrawal is GHS 5.00");
    if (amount > stats.availableBalance) return alert("Insufficient funds available.");
    if (!momoConfig.number || momoConfig.number.length < 10) {
      return alert("Please provide a valid Mobile Money number in Settings.");
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.from('payouts').insert([{
        organizer_id: data.profile.id,
        amount: amount,
        momo_number: momoConfig.number,
        momo_network: momoConfig.network,
        account_name: momoConfig.accountName,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;
      
      alert("Withdrawal request sent! Funds typically arrive in 24 hours.");
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      loadDashboardData(true);
    } catch (err) {
      console.error("Payout error:", err);
      alert("Transaction failed. Contact support if balance was deducted.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMomoSettings = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          momo_number: momoConfig.number, 
          momo_network: momoConfig.network,
          account_name: momoConfig.accountName
        }
      });
      if (error) throw error;
      alert("Payment preferences updated.");
      setShowSettingsModal(false);
    } catch (err) {
      alert("Error saving preferences.");
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

  // Filtered ticket results
  const filteredTickets = data.tickets.filter(t => {
    const searchStr = ticketSearch.toLowerCase();
    const matchesSearch = t.guest_name?.toLowerCase().includes(searchStr) || 
                          t.reference?.toLowerCase().includes(searchStr);
    const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
    return matchesSearch && matchesEvent;
  });

  if (loading) return (
    <div style={fullPageCenter}>
      <Loader2 className="animate-spin" size={48} color="#0ea5e9"/>
      <h2 style={{marginTop: '24px', fontWeight: 900, letterSpacing: '-1px'}}>SECURE ACCESS...</h2>
      <p style={{color: '#64748b', fontSize: '14px'}}>Fetching financial records</p>
    </div>
  );

  return (
    <div style={mainWrapper}>
      
      {/* --- TOP NAVIGATION BAR --- */}
      <div style={topNav}>
        <div>
          <h1 style={logoText}>OUSTED <span style={badgePro}>ORGANIZER</span></h1>
        </div>
        <div style={headerActions}>
           <div style={userBrief}>
             <p style={userEmail}>{data.profile?.email}</p>
             <p style={userRole}>Verified Organizer</p>
           </div>
           <button style={circleAction} onClick={() => loadDashboardData(true)}>
             <RefreshCcw size={20} className={refreshing ? 'animate-spin' : ''}/>
           </button>
           <button style={logoutCircle} onClick={handleLogout}>
             <LogOut size={20}/>
           </button>
        </div>
      </div>

      {/* --- FINANCIAL HUB (PAYMENTS FOCUS) --- */}
      <div style={financeGrid}>
        <div style={balanceCard}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
            <div>
              <p style={financeLabel}>AVAILABLE TO WITHDRAW</p>
              <h2 style={balanceValue}>GHS {stats.availableBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
              <div style={pendingTag}>
                <Clock size={12}/> GHS {stats.pendingWithdrawals.toLocaleString()} is currently processing
              </div>
            </div>
            <div style={iconCircleLarge}><Wallet size={32} color="#0ea5e9"/></div>
          </div>
          
          <div style={financeActionRow}>
            <button style={withdrawBtn} onClick={() => setShowWithdrawModal(true)}>
              WITHDRAW FUNDS <ArrowUpRight size={18}/>
            </button>
            <button style={settingsIconBtn} onClick={() => setShowSettingsModal(true)}>
              <Settings size={20}/>
            </button>
          </div>
        </div>

        <div style={statsOverview}>
          <div style={statBox}>
            <p style={statLabel}>GROSS REVENUE</p>
            <p style={statNumber}>GHS {stats.totalRevenue.toLocaleString()}</p>
            <TrendingUp size={16} color="#22c55e"/>
          </div>
          <div style={statBox}>
            <p style={statLabel}>TOTAL TICKETS</p>
            <p style={statNumber}>{stats.ticketCount}</p>
            <Ticket size={16} color="#0ea5e9"/>
          </div>
          <div style={statBox}>
            <p style={statLabel}>TOTAL VOTES</p>
            <p style={statNumber}>{stats.totalVotes.toLocaleString()}</p>
            <Award size={16} color="#f59e0b"/>
          </div>
        </div>
      </div>

      {/* --- CONTENT TABS --- */}
      <div style={tabBar}>
        <button onClick={() => setActiveTab('events')} style={tabItem(activeTab === 'events')}>
          <Calendar size={18}/> MY EVENTS
        </button>
        <button onClick={() => setActiveTab('contests')} style={tabItem(activeTab === 'contests')}>
          <Trophy size={18}/> CONTESTS
        </button>
        <button onClick={() => setActiveTab('sales')} style={tabItem(activeTab === 'sales')}>
          <History size={18}/> SALES & PAYMENTS
        </button>
        <button onClick={() => setActiveTab('analytics')} style={tabItem(activeTab === 'analytics')}>
          <BarChart3 size={18}/> ANALYTICS
        </button>
      </div>

      <div style={viewPort}>
        
        {/* EVENTS VIEW */}
        {activeTab === 'events' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Events Dashboard</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/create')}>
                <Plus size={20}/> ADD NEW EVENT
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
                      <span style={metaLine}><MapPin size={14}/> {event.location || 'Accra, GH'}</span>
                    </div>
                    <button style={fullWidthBtn} onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }}>
                      VIEW TICKET SALES <ChevronRight size={16}/>
                    </button>
                    <button style={deleteBtn} onClick={() => deleteResource('events', event.id)}>
                      <Trash2 size={14}/> DELETE EVENT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTESTS VIEW */}
        {activeTab === 'contests' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Active Contests</h2>
              <button style={addBtn} onClick={() => router.push('/dashboard/organizer/contests/create')}>
                <Plus size={20}/> NEW CONTEST
              </button>
            </div>
            <div style={cardGrid}>
              {data.contests.map(contest => (
                <div key={contest.id} style={contestCard}>
                  <div style={contestHead}>
                    <div style={contestIcon}><Award size={24} color="#0ea5e9"/></div>
                    <div style={{flex: 1}}>
                      <h3 style={contestTitleText}>{contest.title}</h3>
                      <p style={contestSubText}>{contest.candidates?.length || 0} candidates registered</p>
                    </div>
                  </div>
                  <div style={voteDisplay}>
                    <p style={voteLabelText}>VOTE COUNT</p>
                    <p style={voteNumText}>{(contest.candidates?.reduce((a, b) => a + (b.vote_count || 0), 0)).toLocaleString()}</p>
                  </div>
                  <div style={contestFooter}>
                    <button style={contestLinkBtn} onClick={() => copyLink('voting', contest.id)}>
                      {copying === contest.id ? <Check size={14}/> : <><LinkIcon size={14}/> COPY LINK</>}
                    </button>
                    <button style={contestDeleteBtn} onClick={() => deleteResource('contests', contest.id)}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SALES & PAYOUTS VIEW */}
        {activeTab === 'sales' && (
          <div style={fadeAnim}>
            <div style={viewHeader}>
              <h2 style={viewTitle}>Transaction Records</h2>
              <div style={filterGroup}>
                <div style={searchBox}>
                  <Search size={18} color="#94a3b8"/>
                  <input 
                    style={searchInputField} 
                    placeholder="Find attendee..." 
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
                    <th style={tableTh}>ATTENDEE</th>
                    <th style={tableTh}>EVENT</th>
                    <th style={tableTh}>PAID</th>
                    <th style={tableTh}>REF</th>
                    <th style={tableTh}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={tableTr}>
                      <td style={tableTd}>
                        <p style={guestBold}>{t.guest_name}</p>
                        <p style={guestMuted}>{t.guest_email || 'No email'}</p>
                      </td>
                      <td style={tableTd}>{t.events?.title}</td>
                      <td style={tableTd}>GHS {t.amount}</td>
                      <td style={tableTd}><code style={codeRef}>{t.reference}</code></td>
                      <td style={tableTd}>
                        {t.is_scanned ? 
                          <span style={scannedPill}>SCANNED</span> : 
                          <span style={activePill}>ACTIVE</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 style={{marginTop: '50px', fontWeight: 900, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px'}}>
              <Banknote size={20} color="#0ea5e9"/> Withdrawal History
            </h3>
            <div style={tableWrapper}>
              <table style={dataTable}>
                <thead>
                  <tr>
                    <th style={tableTh}>DATE</th>
                    <th style={tableTh}>AMOUNT</th>
                    <th style={tableTh}>DESTINATION</th>
                    <th style={tableTh}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p) => (
                    <tr key={p.id} style={tableTr}>
                      <td style={tableTd}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td style={tableTd}>GHS {p.amount}</td>
                      <td style={tableTd}>{p.momo_number} ({p.momo_network})</td>
                      <td style={tableTd}>
                        <span style={statusBadge(p.status)}>{p.status.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                  {data.payouts.length === 0 && (
                    <tr><td colSpan="4" style={{padding: '30px', textAlign: 'center', color: '#94a3b8'}}>No withdrawals recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div style={fadeAnim}>
            <div style={analyticsSplash}>
              <div style={splashIcon}><BarChart3 size={60} color="#cbd5e1"/></div>
              <h2 style={splashTitle}>Visual Insights</h2>
              <p style={splashText}>Comprehensive charts for ticket velocity and vote distribution are being prepared. Check back after your next 10 sales.</p>
              <div style={growthMock}>
                <div style={{height: '40%', width: '15%', background: '#f1f5f9', borderRadius: '10px'}}></div>
                <div style={{height: '60%', width: '15%', background: '#f1f5f9', borderRadius: '10px'}}></div>
                <div style={{height: '90%', width: '15%', background: '#e0f2fe', borderRadius: '10px'}}></div>
                <div style={{height: '75%', width: '15%', background: '#f1f5f9', borderRadius: '10px'}}></div>
                <div style={{height: '100%', width: '15%', background: '#0ea5e9', borderRadius: '10px'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      
      {/* 1. WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div style={overlay} onClick={() => setShowWithdrawModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Request Payout</h2>
              <button style={closeBtn} onClick={() => setShowWithdrawModal(false)}><X size={20}/></button>
            </div>
            <div style={modalInfoBox}>
              <p style={infoLabel}>CURRENT WITHDRAWABLE BALANCE</p>
              <h3 style={infoValue}>GHS {stats.availableBalance.toLocaleString()}</h3>
            </div>
            <div style={inputStack}>
              <label style={fieldLabel}>WITHDRAWAL AMOUNT (GHS)</label>
              <input 
                type="number" 
                style={bigInput} 
                placeholder="0.00" 
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <p style={inputHint}>Funds will be sent to <b>{momoConfig.number || 'No MoMo set'}</b></p>
            </div>
            <div style={securityNote}>
              <ShieldCheck size={16} color="#16a34a"/>
              <span>Secure 256-bit encrypted transaction</span>
            </div>
            <button 
              style={actionSubmitBtn(isProcessing || !withdrawAmount)} 
              onClick={submitWithdrawal}
              disabled={isProcessing || !withdrawAmount}
            >
              {isProcessing ? <Loader2 className="animate-spin"/> : 'CONFIRM WITHDRAWAL'}
            </button>
          </div>
        </div>
      )}

      {/* 2. SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={overlay} onClick={() => setShowSettingsModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={modalHead}>
              <h2 style={modalTitle}>Payout Preferences</h2>
              <button style={closeBtn} onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
            </div>
            <div style={inputStack}>
              <label style={fieldLabel}>ACCOUNT HOLDER NAME</label>
              <input 
                style={modalInput} 
                placeholder="Full Name as on ID"
                value={momoConfig.accountName}
                onChange={(e) => setMomoConfig({...momoConfig, accountName: e.target.value})}
              />
            </div>
            <div style={inputStack}>
              <label style={fieldLabel}>NETWORK</label>
              <select 
                style={modalInput}
                value={momoConfig.network}
                onChange={(e) => setMomoConfig({...momoConfig, network: e.target.value})}
              >
                <option value="MTN">MTN Mobile Money</option>
                <option value="VODAFONE">Vodafone Cash</option>
                <option value="AIRTELTIGO">AirtelTigo Money</option>
              </select>
            </div>
            <div style={inputStack}>
              <label style={fieldLabel}>PHONE NUMBER</label>
              <input 
                style={modalInput} 
                placeholder="05XXXXXXXX"
                value={momoConfig.number}
                onChange={(e) => setMomoConfig({...momoConfig, number: e.target.value})}
              />
            </div>
            <button style={actionSubmitBtn(isProcessing)} onClick={updateMomoSettings}>
              {isProcessing ? <Loader2 className="animate-spin"/> : 'SAVE PREFERENCES'}
            </button>
          </div>
        </div>
      )}

      {/* 3. QR MODAL */}
      {showQR && (
        <div style={overlay} onClick={() => setShowQR(null)}>
          <div style={qrContent} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '20px', fontWeight: 900}}>Share QR Code</h3>
            <div style={qrBorder}>
               <img src={showQR} style={{width: '100%'}} alt="QR"/>
            </div>
            <button style={downloadBtn} onClick={() => window.open(showQR)}>
              <Download size={18}/> DOWNLOAD IMAGE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 500+ LINE STYLE ARCHITECTURE ---

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
const settingsIconBtn = { width: '55px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '18px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const statsOverview = { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '15px' };
const statBox = { background: '#fff', padding: '20px 30px', borderRadius: '25px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const statLabel = { margin: 0, fontSize: '11px', fontWeight: 800, color: '#94a3b8' };
const statNumber = { margin: '5px 0 0', fontSize: '22px', fontWeight: 900 };

const tabBar = { display: 'flex', gap: '30px', borderBottom: '1px solid #e2e8f0', marginBottom: '40px' };
const tabItem = (active) => ({ padding: '15px 5px', background: 'none', border: 'none', color: active ? '#000' : '#94a3b8', fontSize: '13px', fontWeight: 800, cursor: 'pointer', borderBottom: active ? '3px solid #0ea5e9' : '3px solid transparent', display: 'flex', alignItems: 'center', gap: '10px', transition: '0.2s' });

const viewPort = { minHeight: '400px' };
const fadeAnim = { animation: 'fadeIn 0.4s ease-out' };
const viewHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' };
const viewTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const addBtn = { background: '#0ea5e9', color: '#fff', border: 'none', padding: '14px 24px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' };

const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const itemCard = { background: '#fff', borderRadius: '30px', border: '1px solid #f1f5f9', overflow: 'hidden', transition: 'transform 0.2s' };
const itemImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f8fafc', position: 'relative' });
const cardQuickActions = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' };
const miniAction = { width: '35px', height: '35px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#000' };
const itemBody = { padding: '25px' };
const itemTitle = { margin: '0 0 10px', fontSize: '18px', fontWeight: 900 };
const itemMeta = { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' };
const metaLine = { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', fontWeight: 500 };
const fullWidthBtn = { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '12px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' };
const deleteBtn = { background: 'none', border: 'none', color: '#fca5a5', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '15px', display: 'block', width: '100%' };

const contestCard = { background: '#fff', padding: '25px', borderRadius: '30px', border: '1px solid #f1f5f9' };
const contestHead = { display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' };
const contestIcon = { width: '50px', height: '50px', borderRadius: '15px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const contestTitleText = { margin: 0, fontSize: '16px', fontWeight: 900 };
const contestSubText = { margin: 0, fontSize: '12px', color: '#94a3b8', fontWeight: 500 };
const voteDisplay = { background: '#f8fafc', padding: '15px 20px', borderRadius: '20px', marginBottom: '20px' };
const voteLabelText = { margin: 0, fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px' };
const voteNumText = { margin: 0, fontSize: '24px', fontWeight: 950 };
const contestFooter = { display: 'flex', gap: '10px' };
const contestLinkBtn = { flex: 1, background: '#fff', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' };
const contestDeleteBtn = { width: '40px', height: '40px', background: '#fff1f2', border: 'none', borderRadius: '12px', color: '#e11d48', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const filterGroup = { display: 'flex', gap: '15px' };
const searchBox = { background: '#fff', border: '1px solid #e2e8f0', padding: '0 15px', borderRadius: '15px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '250px' };
const searchInputField = { border: 'none', background: 'none', padding: '12px 0', outline: 'none', fontSize: '14px', fontWeight: 500, width: '100%' };
const eventDropdown = { background: '#fff', border: '1px solid #e2e8f0', padding: '0 15px', borderRadius: '15px', fontWeight: 700, fontSize: '13px', outline: 'none' };

const tableWrapper = { background: '#fff', borderRadius: '25px', border: '1px solid #f1f5f9', overflow: 'hidden', marginTop: '20px' };
const dataTable = { width: '100%', borderCollapse: 'collapse' };
const tableTh = { textAlign: 'left', padding: '18px 25px', background: '#fafbfc', fontSize: '11px', fontWeight: 800, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' };
const tableTd = { padding: '18px 25px', fontSize: '14px', borderBottom: '1px solid #fcfdfe' };
const tableTr = { transition: '0.2s' };
const guestBold = { margin: 0, fontWeight: 800 };
const guestMuted = { margin: 0, fontSize: '12px', color: '#94a3b8' };
const codeRef = { background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', color: '#64748b', fontFamily: 'monospace' };
const scannedPill = { background: '#fff1f2', color: '#e11d48', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };
const activePill = { background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 900 };

const statusBadge = (status) => ({
  fontSize: '10px', fontWeight: 900, padding: '4px 10px', borderRadius: '8px',
  background: status === 'success' ? '#f0fdf4' : status === 'pending' ? '#fffbeb' : '#fef2f2',
  color: status === 'success' ? '#16a34a' : status === 'pending' ? '#d97706' : '#dc2626'
});

const analyticsSplash = { padding: '80px 40px', textAlign: 'center', background: '#fff', borderRadius: '40px', border: '1px solid #f1f5f9' };
const splashIcon = { marginBottom: '20px' };
const splashTitle = { fontWeight: 900, fontSize: '22px', margin: '0 0 10px' };
const splashText = { color: '#94a3b8', maxWidth: '400px', margin: '0 auto 40px', fontSize: '14px', lineHeight: 1.6 };
const growthMock = { display: 'flex', gap: '15px', height: '120px', justifyContent: 'center', alignItems: 'flex-end' };

const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const modal = { background: '#fff', padding: '40px', borderRadius: '40px', width: '90%', maxWidth: '480px', animation: 'slideUp 0.3s ease-out' };
const modalHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const modalTitle = { margin: 0, fontSize: '24px', fontWeight: 900 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' };
const modalInfoBox = { background: '#f0f9ff', padding: '20px', borderRadius: '20px', marginBottom: '25px', textAlign: 'center' };
const infoLabel = { margin: 0, fontSize: '10px', fontWeight: 800, color: '#0ea5e9', letterSpacing: '1px' };
const infoValue = { margin: '5px 0 0', fontSize: '32px', fontWeight: 950 };
const inputStack = { marginBottom: '20px' };
const fieldLabel = { display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '8px' };
const bigInput = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '18px', borderRadius: '18px', fontSize: '28px', fontWeight: 950, textAlign: 'center', outline: 'none' };
const modalInput = { width: '100%', background: '#f8fafc', border: '2px solid #f1f5f9', padding: '14px 18px', borderRadius: '15px', fontSize: '15px', fontWeight: 600, outline: 'none' };
const inputHint = { fontSize: '12px', color: '#64748b', marginTop: '10px', textAlign: 'center' };
const securityNote = { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '11px', color: '#16a34a', fontWeight: 700, marginBottom: '25px' };

const actionSubmitBtn = (disabled) => ({
  width: '100%', background: disabled ? '#f1f5f9' : '#000', color: disabled ? '#cbd5e1' : '#fff',
  padding: '18px', borderRadius: '18px', border: 'none', fontWeight: 850, fontSize: '15px',
  cursor: disabled ? 'not-allowed' : 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center'
});

const qrContent = { background: '#fff', padding: '35px', borderRadius: '35px', textAlign: 'center', width: '350px' };
const qrBorder = { padding: '20px', border: '1px solid #f1f5f9', borderRadius: '25px', background: '#fff', marginBottom: '25px' };
const downloadBtn = { width: '100%', background: '#000', color: '#fff', border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' };

const fullPageCenter = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' };
const imagePlaceholder = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' };
