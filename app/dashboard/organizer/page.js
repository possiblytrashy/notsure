"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download, X,
  TrendingUp, Smartphone, Clock, CheckCircle2, XCircle, Loader2, Save, Trash2,
  LogOut, Search, Filter, Eye, ChevronRight, RefreshCcw
} from 'lucide-react';

export default function OrganizerDashboard() {
  const router = useRouter();

  // --- DATA STATE ---
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ 
    events: [], 
    contests: [], 
    payouts: [], 
    tickets: [], 
    profile: null 
  });
  const [stats, setStats] = useState({ revenue: 0, votes: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // --- UI STATE ---
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState('all');

  // --- FORM STATE ---
  const [momoConfig, setMomoConfig] = useState({
    number: "0541234567",
    network: "MTN"
  });

  // --- DATA FETCHING ---
  const loadDashboard = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const userId = user.id;

      // 1. Fetch Events
      const { data: events, error: eventsErr } = await supabase
        .from('events')
        .select('id, title, date, images, organizer_id')
        .eq('organizer_id', userId)
        .order('created_at', { ascending: false });

      if (eventsErr) throw eventsErr;

      const eventIds = events?.map(e => e.id) || [];

      // 2. Parallel Fetch with Guard for Empty eventIds
      const [contestsRes, payoutsRes, ticketsRes] = await Promise.all([
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', userId),
        supabase.from('payouts').select('*').eq('organizer_id', userId).order('created_at', { ascending: false }),
        eventIds.length > 0 
          ? supabase.from('tickets').select('*').in('event_id', eventIds).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] })
      ]);

      // 3. Financial Logic
      const totalRev = ticketsRes.data?.reduce((acc, t) => acc + (Number(t.amount) || 0), 0) || 0;
      const totalPaid = payoutsRes.data
        ?.filter(p => p.status === 'success' || p.status === 'pending') // Pending counts as "spoken for"
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0) || 0;

      const currentBalance = totalRev - totalPaid;

      // 4. Update Stats
      setStats({
        revenue: totalRev,
        votes: contestsRes.data?.reduce((acc, c) => acc + (c.candidates?.reduce((sum, cand) => sum + (cand.vote_count || 0), 0) || 0), 0) || 0,
        balance: currentBalance < 0 ? 0 : currentBalance
      });

      // 5. Enrich Tickets for UI
      const enrichedTickets = ticketsRes.data?.map(t => ({
        ...t,
        event_title: events.find(e => e.id === t.event_id)?.title || 'Unknown Event'
      })) || [];

      setData({
        events: events || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: enrichedTickets,
        profile: user
      });

    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // --- HANDLERS ---
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const deleteItem = async (table, id) => {
    if(!confirm("Are you sure? This action cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) loadDashboard(true); 
    else alert("Delete failed: Data is likely linked to other records.");
  };

  const handleWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > stats.balance) return alert("Invalid amount or insufficient balance.");
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('payouts').insert([{ 
          organizer_id: data.profile.id, 
          amount,
          momo_number: momoConfig.number, 
          momo_network: momoConfig.network, 
          status: 'pending'
      }]);
      if (error) throw error;
      alert("Withdrawal request submitted successfully!");
      setWithdrawAmount('');
      loadDashboard(true);
    } catch (err) { alert("Withdrawal failed."); }
    finally { setIsProcessing(false); setShowWithdrawModal(false); }
  };

  const copyMagicLink = (type, id) => {
    const url = `${window.location.origin}/${type === 'event' ? 'events' : 'voting'}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id); setTimeout(() => setCopying(null), 2000);
  };

  const generateQR = (type, id) => {
    const url = `${window.location.origin}/${type === 'event' ? 'events' : 'voting'}/${id}`;
    setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`);
  };

  // --- FILTERED DATA LOGIC ---
  const filteredTickets = data.tickets.filter(t => {
    const matchesSearch = t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) || 
                          t.reference?.toLowerCase().includes(ticketSearch.toLowerCase());
    const matchesEvent = selectedEventFilter === 'all' || t.event_id === selectedEventFilter;
    return matchesSearch && matchesEvent;
  });

  if (loading) return <div style={centerScreen}><Loader2 className="animate-spin" size={30}/> Initializing OUSTED...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* 1. FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={subLabel}>WITHDRAWABLE BALANCE</p>
          <div style={{display:'flex', alignItems:'center', gap: '15px'}}>
             <h2 style={revenueText}>GHS {stats.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
             {refreshing && <Loader2 className="animate-spin" size={20} color="#0ea5e9"/>}
          </div>
          <p style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '5px'}}>
            Lifetime Revenue: GHS {stats.revenue.toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={actionBtn('#111', '#fff')} onClick={() => loadDashboard(true)} title="Refresh Data">
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''}/>
          </button>
          <button style={actionBtn('#fff', '#000')} onClick={() => setShowSettingsModal(true)}>
            <Settings size={18}/> Payouts
          </button>
          <button style={actionBtn('#0ea5e9', '#fff')} onClick={() => setShowWithdrawModal(true)}>
            Withdraw <ArrowUpRight size={18}/>
          </button>
          <button style={logoutBtn} onClick={handleLogout} title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* 2. RECENT ACTIVITY HUD */}
      <div style={historySection}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
           <h4 style={{margin: 0, fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px'}}>
             <TrendingUp size={18} color="#0ea5e9"/> Recent Payout Activity
           </h4>
        </div>
        <div style={historyTable}>
          {data.payouts.slice(0, 3).map((payout) => (
            <div key={payout.id} style={historyRow}>
              <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                <div style={statusIcon(payout.status)}>
                  {payout.status === 'success' ? <CheckCircle2 size={16} /> : payout.status === 'failed' ? <XCircle size={16} /> : <Clock size={16} />}
                </div>
                <div>
                  <p style={{margin: 0, fontWeight: 800, fontSize: '14px'}}>GHS {payout.amount}</p>
                  <p style={{margin: 0, fontSize: '11px', color: '#888'}}>{new Date(payout.created_at).toLocaleDateString()} • {payout.momo_number}</p>
                </div>
              </div>
              <div style={statusBadge(payout.status)}>{payout.status.toUpperCase()}</div>
            </div>
          ))}
          {data.payouts.length === 0 && <p style={{fontSize:'13px', color:'#aaa', textAlign: 'center', padding: '10px'}}>No payout history found.</p>}
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div style={tabContainer}>
        {['events', 'contests', 'sales', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* 4. CONTENT AREA */}
      <div style={{ minHeight: '400px' }}>
        
        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <>
            <div style={contentHeader}>
                <h3 style={{ fontWeight: 900, fontSize: '24px' }}>Event Management</h3>
                <button onClick={() => router.push('/dashboard/organizer/create')} style={createLink}>
                    <Plus size={20}/> Create Event
                </button>
            </div>
            <div style={gridStyle}>
                {data.events.map(event => (
                <div key={event.id} style={cardStyle}>
                    <div style={cardImage(event.images?.[0])}>
                    {!event.images?.[0] && <div style={imagePlaceholder}><ImageIcon size={30} color="#ccc"/></div>}
                    <div style={cardOverlay}>
                        <button onClick={() => { setSelectedEventFilter(event.id); setActiveTab('sales'); }} style={iconCircle} title="View Sales"><Ticket size={16}/></button>
                        <button onClick={() => deleteItem('events', event.id)} style={iconCircleDelete}><Trash2 size={16} color="#ef4444"/></button>
                        <button onClick={() => copyMagicLink('event', event.id)} style={iconCircle}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                        </button>
                    </div>
                    </div>
                    <h4 style={cardTitle}>{event.title}</h4>
                    <p style={{fontSize: '12px', color: '#888', margin: 0}}>{new Date(event.date).toLocaleDateString()}</p>
                </div>
                ))}
            </div>
            {data.events.length === 0 && <div style={analyticsPlaceholder}>Click 'Create Event' to get started.</div>}
          </>
        )}

        {/* CONTESTS TAB */}
        {activeTab === 'contests' && (
          <>
            <div style={contentHeader}>
                <h3 style={{ fontWeight: 900, fontSize: '24px' }}>Active Contests</h3>
                <button onClick={() => router.push('/dashboard/organizer/contests/create')} style={createLink}>
                    <Plus size={20}/> New Contest
                </button>
            </div>
            <div style={gridStyle}>
                {data.contests.map(contest => (
                <div key={contest.id} style={cardStyle}>
                    <div style={flexBetween}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={iconBox}><Trophy size={20} color="#0ea5e9"/></div>
                            <div>
                                <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length || 0} Candidates</p>
                            </div>
                        </div>
                        <button onClick={() => deleteItem('contests', contest.id)} style={deleteBtnSmall}><Trash2 size={14} color="#ef4444"/></button>
                    </div>
                    <div style={statBox}>
                        <p style={miniLabel}>VOTES COLLECTED</p>
                        <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>
                            {(contest.candidates?.reduce((acc, curr) => acc + (curr.vote_count || 0), 0) || 0).toLocaleString()}
                        </p>
                        <div style={{display: 'flex', gap: '8px', marginTop: '15px'}}>
                            <button onClick={() => copyMagicLink('contest', contest.id)} style={actionBtnSmall}>
                                {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>} Magic Link
                            </button>
                            <button onClick={() => generateQR('contest', contest.id)} style={actionBtnSmall}><QrCode size={14}/> QR</button>
                        </div>
                    </div>
                </div>
                ))}
            </div>
          </>
        )}

        {/* SALES TAB */}
        {activeTab === 'sales' && (
          <div style={tableCard}>
            <div style={filterHeader}>
              <div style={{flex: 1}}>
                <h3 style={{fontWeight: 900, margin: 0}}>Ticket Sales & Attendees</h3>
                <p style={{fontSize: '12px', color: '#888'}}>Matching records: {filteredTickets.length}</p>
              </div>
              
              <div style={filterActions}>
                <div style={searchBar}>
                  <Filter size={16} color="#aaa"/>
                  <select 
                    style={selectInput} 
                    value={selectedEventFilter} 
                    onChange={(e) => setSelectedEventFilter(e.target.value)}
                  >
                    <option value="all">All Events</option>
                    {data.events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>

                <div style={searchBar}>
                  <Search size={16} color="#aaa"/>
                  <input 
                    placeholder="Guest name or Ref..." 
                    style={searchInput} 
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            <div style={{overflowX: 'auto'}}>
              <table style={salesTable}>
                <thead>
                    <tr style={tableHeaderRow}>
                      <th style={th}>Attendee Details</th>
                      <th style={th}>Event Name</th>
                      <th style={th}>Ticket Type</th>
                      <th style={th}>Paid</th>
                      <th style={th}>Ref Code</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTickets.map((t, i) => (
                      <tr key={i} style={tableRow}>
                        <td style={td}>
                          <div style={{fontWeight: 800}}>{t.guest_name}</div>
                          <div style={{fontSize: '11px', color: '#888'}}>{t.guest_email || 'No email provided'}</div>
                        </td>
                        <td style={td}>{t.event_title}</td>
                        <td style={td}><span style={tierBadge}>{t.tier_name || 'General'}</span></td>
                        <td style={td}>GHS {t.amount}</td>
                        <td style={td}><code style={refCode}>{t.reference}</code></td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {filteredTickets.length === 0 && (
                <div style={{padding: '60px', textAlign: 'center', color: '#888'}}>
                   <Ticket size={40} style={{marginBottom: '10px', opacity: 0.2}}/>
                   <p>No tickets found for this selection.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div style={analyticsPlaceholder}>
            <div style={{display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '40px'}}>
                <div style={analyticMiniCard}>
                    <p style={miniLabel}>TOTAL SYSTEM VOTES</p>
                    <h2 style={{margin:0, fontSize: '32px'}}>{stats.votes.toLocaleString()}</h2>
                </div>
                <div style={analyticMiniCard}>
                    <p style={miniLabel}>TOTAL TICKET REVENUE</p>
                    <h2 style={{margin:0, fontSize: '32px'}}>GHS {stats.revenue.toLocaleString()}</h2>
                </div>
            </div>
            <BarChart3 size={60} color="#0ea5e9" style={{marginBottom:'20px', opacity: 0.5}}/>
            <h2 style={{fontWeight:900}}>Visual Analytics</h2>
            <p style={{color:'#666'}}>Advanced charts and trends will be visible here once more data is collected.</p>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {showQR && (
        <div style={modalBackdrop} onClick={() => setShowQR(null)}>
          <div style={modalPaper} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Share QR Code</h3>
            <img src={showQR} alt="QR" style={{width: '220px', borderRadius: '25px', marginBottom:'25px', border: '1px solid #eee'}} />
            <button style={actionBtn('#000', '#fff')} onClick={() => window.open(showQR)}>
              <Download size={18}/> Download Image
            </button>
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <div style={modalBackdrop} onClick={() => setShowWithdrawModal(false)}>
            <div style={modalPaper} onClick={e => e.stopPropagation()}>
                <h3 style={modalTitle}>Request Payout</h3>
                <div style={balancePreview}>
                    <p style={miniLabel}>AVAILABLE FOR WITHDRAWAL</p>
                    <h2 style={{margin:0, fontSize:'36px'}}>GHS {stats.balance.toLocaleString()}</h2>
                </div>
                <div style={{textAlign: 'left'}}>
                    <p style={miniLabel}>AMOUNT (GHS)</p>
                    <input 
                        type="number" 
                        style={largeInput} 
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                </div>
                <button 
                    style={payoutBtn(isProcessing || !withdrawAmount)} 
                    onClick={handleWithdrawal} 
                    disabled={isProcessing || !withdrawAmount}
                >
                    {isProcessing ? 'Submitting...' : 'Confirm Request'}
                </button>
                <p style={{fontSize: '11px', color: '#888', marginTop: '15px'}}>
                  Payouts are sent to: {momoConfig.network} - {momoConfig.number}
                </p>
            </div>
        </div>
      )}

      {showSettingsModal && (
        <div style={modalBackdrop} onClick={() => setShowSettingsModal(false)}>
          <div style={modalPaper} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Payout Destination</h3>
            <div style={{textAlign: 'left', marginBottom: '25px'}}>
              <p style={miniLabel}>CHOOSE NETWORK</p>
              <select style={largeInput} value={momoConfig.network} onChange={(e) => setMomoConfig({...momoConfig, network: e.target.value})}>
                <option value="MTN">MTN Mobile Money</option>
                <option value="VODAFONE">Vodafone Cash</option>
                <option value="AIRTELTIGO">AirtelTigo Money</option>
              </select>
              <p style={miniLabel}>PHONE NUMBER</p>
              <input type="text" style={largeInput} value={momoConfig.number} onChange={(e) => setMomoConfig({...momoConfig, number: e.target.value})}/>
            </div>
            <button style={payoutBtn(false)} onClick={() => { setShowSettingsModal(false); alert("Payout settings updated locally."); }}>
              <Save size={18}/> Save Preferences
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// --- STYLES ---
const financeBar = { background: '#000', color: '#fff', padding: '45px', borderRadius: '45px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', flexWrap: 'wrap', gap: '20px' };
const subLabel = { margin: 0, fontSize: '11px', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' };
const revenueText = { margin: 0, fontSize: '42px', fontWeight: 900 };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '16px 28px', borderRadius: '20px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' });
const logoutBtn = { background: 'rgba(255,50,50,0.1)', color: '#ff4d4d', border: 'none', width: '50px', height: '50px', borderRadius: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const historySection = { marginBottom: '40px', background: '#fff', padding: '35px', borderRadius: '40px', border: '1px solid #f0f0f0' };
const historyTable = { display: 'flex', flexDirection: 'column', gap: '12px' };
const historyRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#f9fafb', borderRadius: '22px' };
const statusIcon = (status) => ({ width: '40px', height: '40px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: status === 'success' ? '#f0fdf4' : '#fff', color: status === 'success' ? '#22c55e' : '#aaa' });
const statusBadge = (status) => ({ fontSize: '10px', fontWeight: 900, padding: '6px 14px', borderRadius: '12px', background: status === 'success' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#000', color: '#fff' });
const tabContainer = { display: 'flex', gap: '35px', marginBottom: '40px', borderBottom: '1px solid #eee', overflowX: 'auto' };
const tabStyle = (active) => ({ padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', color: active ? '#0ea5e9' : '#bbb', borderBottom: active ? '4px solid #0ea5e9' : '4px solid transparent', whiteSpace: 'nowrap' });
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const createLink = { background: '#f0f9ff', color: '#0ea5e9', border: 'none', padding: '14px 24px', borderRadius: '18px', fontWeight: 900, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' };
const cardStyle = { background: '#fff', padding: '25px', borderRadius: '40px', border: '1px solid #f0f0f0' };
const cardImage = (url) => ({ height: '180px', background: url ? `url(${url}) center/cover` : '#f8fafc', borderRadius: '30px', position: 'relative', overflow: 'hidden' });
const cardOverlay = { position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' };
const iconCircle = { width: '40px', height: '40px', borderRadius: '14px', background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' };
const iconCircleDelete = { width: '40px', height: '40px', borderRadius: '14px', background: '#fef2f2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const cardTitle = { margin: '20px 0 5px', fontWeight: 900, fontSize: '20px' };
const flexBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const iconBox = { width: '50px', height: '50px', borderRadius: '18px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const miniLabel = { margin: '0 0 10px', fontSize: '10px', fontWeight: 900, color: '#aaa', letterSpacing: '1px' };
const statBox = { marginTop: '25px', padding: '20px', background: '#f8fafc', borderRadius: '25px' };
const actionBtnSmall = { background: '#fff', border: '1px solid #eee', padding: '8px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' };
const deleteBtnSmall = { background: '#fef2f2', border: 'none', width: '35px', height: '35px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tableCard = { background: '#fff', padding: '40px', borderRadius: '45px', border: '1px solid #f0f0f0' };
const filterHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px', gap: '20px', flexWrap: 'wrap' };
const filterActions = { display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' };
const searchBar = { display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px 20px', borderRadius: '18px', border: '1px solid #eee' };
const selectInput = { border: 'none', background: 'transparent', outline: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer' };
const searchInput = { border: 'none', background: 'transparent', outline: 'none', fontWeight: 700, width: '150px' };
const salesTable = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', padding: '20px', fontSize: '11px', color: '#aaa', fontWeight: 900, borderBottom: '1px solid #eee', textTransform: 'uppercase' };
const td = { padding: '20px', fontSize: '14px', borderBottom: '1px solid #f9fafb' };
const tableHeaderRow = { borderBottom: '1px solid #eee' };
const tableRow = { transition: 'background 0.2s' };
const tierBadge = { background: '#f1f5f9', color: '#475569', padding: '5px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 900 };
const refCode = { background: '#fff', border: '1px solid #eee', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace', color: '#666' };
const analyticsPlaceholder = { padding: '80px 40px', textAlign: 'center', background: '#f9fafb', borderRadius: '45px', border: '2px dashed #eee' };
const analyticMiniCard = { background: '#fff', padding: '30px', borderRadius: '30px', border: '1px solid #eee', flex: 1 };
const modalBackdrop = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalPaper = { background: '#fff', padding: '50px', borderRadius: '50px', textAlign: 'center', width: '90%', maxWidth: '480px' };
const modalTitle = { fontWeight: 900, fontSize: '28px', margin: '0 0 35px' };
const balancePreview = { background: '#f0f9ff', padding: '25px', borderRadius: '30px', marginBottom: '25px' };
const largeInput = { width: '100%', padding: '18px', borderRadius: '20px', border: '2px solid #f0f0f0', fontSize: '18px', fontWeight: 800, marginBottom: '25px', outline: 'none' };
const payoutBtn = (disabled) => ({ width: '100%', background: disabled ? '#eee' : '#000', color: disabled ? '#aaa' : '#fff', border: 'none', padding: '22px', borderRadius: '25px', fontWeight: 900, cursor: pointer, fontSize: '16px' });
const centerScreen = { padding: '200px 20px', textAlign: 'center', fontWeight: 900, fontSize: '18px', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' };
const imagePlaceholder = { width: '100%', height: '100%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
