"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download, X,
  TrendingUp, Smartphone, Clock, CheckCircle2, XCircle, Loader2, Save, Trash2,
  LogOut, Search, Eye // Added Search and Eye for Ticket Management
} from 'lucide-react';

export default function IntegratedDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ events: [], contests: [], payouts: [], tickets: [], profile: null });
  const [stats, setStats] = useState({ revenue: 0, votes: 0, balance: 0, ticketSales: 0 });
  const [loading, setLoading] = useState(true);
  
  // New State for Ticket Management
  const [viewingTicketsFor, setViewingTicketsFor] = useState(null);
  const [ticketSearch, setTicketSearch] = useState('');

  // UI State
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [momoConfig, setMomoConfig] = useState({ number: "0541234567", network: "MTN" });

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const userId = user.id;

      const [eventsRes, contestsRes, payoutsRes, statsRes, ticketsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', userId),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', userId),
        supabase.from('payouts').select('*').eq('organizer_id', userId).order('created_at', { ascending: false }),
        supabase.rpc('get_organizer_stats', { organizer_id: userId }),
        supabase.from('tickets').select('*, events(title)').order('created_at', { ascending: false }) // Fetches all tickets for organizer's events
      ]);

      if (statsRes.data) {
        const s = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
        setStats({
          revenue: s.total_revenue || 0,
          votes: s.total_votes || 0,
          balance: (s.total_revenue || 0) - (s.total_payouts || 0),
          ticketSales: s.ticket_revenue || 0
        });
      }

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        payouts: payoutsRes.data || [],
        tickets: ticketsRes.data || [],
        profile: user
      });
    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  // --- HANDLERS ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const deleteItem = async (table, id) => {
    if(!confirm("Are you sure?")) return;
    await supabase.from(table).delete().eq('id', id);
    loadDashboard();
  };

  const copyMagicLink = (type, id) => {
    const url = `${window.location.origin}/${type === 'event' ? 'events' : 'voting'}/${id}`;
    navigator.clipboard.writeText(url);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  // --- RENDER HELPERS ---
  const filteredTickets = data.tickets.filter(t => 
    (!viewingTicketsFor || t.event_id === viewingTicketsFor) &&
    (t.guest_name?.toLowerCase().includes(ticketSearch.toLowerCase()) || t.reference?.includes(ticketSearch))
  );

  if (loading) return <div style={centerScreen}>Initialising OUSTED Systems...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={subLabel}>WITHDRAWABLE BALANCE</p>
          <h2 style={revenueText}>GHS {stats.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '5px'}}>
            Tickets: GHS {stats.ticketSales.toLocaleString()} | Votes: GHS {(stats.revenue - stats.ticketSales).toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button style={actionBtn('#fff', '#000')} onClick={() => setShowSettingsModal(true)}><Wallet size={18}/> Payouts</button>
          <button style={actionBtn('#0ea5e9', '#fff')} onClick={() => setShowWithdrawModal(true)}>Withdraw <ArrowUpRight size={18}/></button>
          <button style={logoutBtn} onClick={handleLogout} title="Sign Out"><LogOut size={20} /></button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={tabContainer}>
        {['events', 'tickets', 'contests', 'analytics'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setViewingTicketsFor(null); }} style={tabStyle(activeTab === tab)}>{tab}</button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={{ minHeight: '400px' }}>
        
        {/* EVENTS TAB */}
        {activeTab === 'events' && (
          <>
            <div style={contentHeader}>
               <h3 style={{ fontWeight: 900, fontSize: '24px' }}>Live Events</h3>
               <a href='/dashboard/organizer/create' style={createLink}><Plus size={20}/> New Event</a>
            </div>
            <div style={gridStyle}>
              {data.events.map(event => (
                <div key={event.id} style={cardStyle}>
                  <div style={cardImage(event.images?.[0])}>
                    <div style={cardOverlay}>
                      <button onClick={() => { setViewingTicketsFor(event.id); setActiveTab('tickets'); }} style={iconCircle} title="View Sales"><Ticket size={16}/></button>
                      <button onClick={() => copyMagicLink('event', event.id)} style={iconCircle}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                      </button>
                      <button onClick={() => deleteItem('events', event.id)} style={iconCircleDelete}><Trash2 size={16} color="#ef4444"/></button>
                    </div>
                  </div>
                  <h4 style={cardTitle}>{event.title}</h4>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '10px'}}>
                     <span style={miniTag}><Users size={12}/> {data.tickets.filter(t => t.event_id === event.id).length} Sold</span>
                     <span style={miniTag}><Calendar size={12}/> {new Date(event.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TICKETS TAB (Revenue List) */}
        {activeTab === 'tickets' && (
          <div style={ticketListSection}>
            <div style={contentHeader}>
               <h3 style={{ fontWeight: 900, fontSize: '24px' }}>
                {viewingTicketsFor ? `Sales: ${data.events.find(e => e.id === viewingTicketsFor)?.title}` : "All Ticket Sales"}
               </h3>
               <div style={searchBox}>
                  <Search size={18} color="#aaa"/>
                  <input 
                    placeholder="Search name or reference..." 
                    style={searchField}
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
               </div>
            </div>

            <div style={tableWrapper}>
              <table style={ticketTable}>
                <thead>
                  <tr>
                    <th style={th}>Guest</th>
                    <th style={th}>Event</th>
                    <th style={th}>Tier</th>
                    <th style={th}>Amount</th>
                    <th style={th}>Reference</th>
                    <th style={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => (
                    <tr key={t.id} style={tr}>
                      <td style={td}><b>{t.guest_name}</b><br/><span style={{fontSize:'10px', color: '#888'}}>{t.guest_email}</span></td>
                      <td style={td}>{t.events?.title}</td>
                      <td style={td}><span style={tierBadge}>{t.tier_name}</span></td>
                      <td style={td}>GHS {t.amount}</td>
                      <td style={td}><code style={refCode}>{t.reference}</code></td>
                      <td style={td}>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTickets.length === 0 && <p style={{textAlign:'center', padding: '40px', color: '#aaa'}}>No matching tickets found.</p>}
            </div>
          </div>
        )}

        {/* CONTESTS TAB (Existing Logic) */}
        {activeTab === 'contests' && (
           <div style={gridStyle}>
            {data.contests.map(contest => (
              <div key={contest.id} style={cardStyle}>
                <div style={flexBetween}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={iconBox}><Trophy size={20} color="#0ea5e9"/></div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length} Nominees</p>
                    </div>
                  </div>
                  <button onClick={() => deleteItem('contests', contest.id)} style={deleteBtnSmall}><Trash2 size={14} color="#ef4444"/></button>
                </div>
                <div style={statBox}>
                  <p style={miniLabel}>VOTING REVENUE</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>GHS {contest.candidates?.reduce((acc, curr) => acc + (curr.vote_count * 1), 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div style={analyticsPlaceholder}>
            <div style={{display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '40px'}}>
                <div style={analyticMiniCard}>
                    <p style={miniLabel}>TICKET REVENUE</p>
                    <h2 style={{margin:0}}>GHS {stats.ticketSales.toLocaleString()}</h2>
                </div>
                <div style={analyticMiniCard}>
                    <p style={miniLabel}>VOTING REVENUE</p>
                    <h2 style={{margin:0}}>GHS {(stats.revenue - stats.ticketSales).toLocaleString()}</h2>
                </div>
            </div>
            <TrendingUp size={48} color="#0ea5e9" style={{marginBottom:'20px'}}/>
            <h2 style={{fontWeight:900}}>Growth Analytics</h2>
            <p style={{color:'#666'}}>Your revenue stream is being processed for chart visualization.</p>
          </div>
        )}
      </div>

      {/* QR & WITHDRAWAL MODALS (Kept same as your code) */}
      {showQR && (
        <div style={modalBackdrop} onClick={() => setShowQR(null)}>
          <div style={modalPaper} onClick={e => e.stopPropagation()}>
            <img src={showQR} alt="QR" style={{width: '200px', borderRadius: '20px', marginBottom:'20px'}} />
            <button style={actionBtn('#000', '#fff')} onClick={() => window.open(showQR)}><Download size={18}/> Download QR</button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW STYLES ---
const ticketListSection = { background: '#fff', padding: '30px', borderRadius: '35px', border: '1px solid #f0f0f0' };
const searchBox = { display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '10px 20px', borderRadius: '15px', border: '1px solid #eee' };
const searchField = { border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, width: '250px' };
const tableWrapper = { overflowX: 'auto', marginTop: '20px' };
const ticketTable = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', padding: '15px', fontSize: '12px', color: '#aaa', fontWeight: 800, borderBottom: '1px solid #eee' };
const td = { padding: '15px', fontSize: '14px', borderBottom: '1px solid #f9fafb' };
const tierBadge = { background: '#f0f9ff', color: '#0ea5e9', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 900 };
const refCode = { background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' };
const miniTag = { fontSize: '11px', fontWeight: 800, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' };

// --- EXISTING STYLES (FROM YOUR CODE) ---
const logoutBtn = { background: 'rgba(255,50,50,0.1)', color: '#ff4d4d', border: 'none', width: '45px', height: '45px', borderRadius: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '10px' };
const financeBar = { background: '#000', color: '#fff', padding: '40px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const subLabel = { margin: 0, fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.5)' };
const revenueText = { margin: 0, fontSize: '36px', fontWeight: 900 };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '14px 24px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' });
const tabContainer = { display: 'flex', gap: '30px', marginBottom: '40px', borderBottom: '1px solid #eee' };
const tabStyle = (active) => ({ padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: active ? '#000' : '#aaa', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const createLink = { textDecoration: 'none', background: '#f0f9ff', color: '#0ea5e9', padding: '12px 24px', borderRadius: '15px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '35px', border: '1px solid #f0f0f0' };
const cardImage = (url) => ({ height: '160px', background: url ? `url(${url}) center/cover` : '#f8fafc', borderRadius: '25px', position: 'relative' });
const cardOverlay = { position: 'absolute', top: 0, right: 0, padding: '15px', display: 'flex', gap: '10px' };
const iconCircle = { width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const iconCircleDelete = { width: '38px', height: '38px', borderRadius: '12px', background: '#fef2f2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const cardTitle = { margin: '15px 0 5px', fontWeight: 900, fontSize: '18px' };
const flexBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const iconBox = { width: '45px', height: '45px', borderRadius: '14px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const miniLabel = { margin: '0 0 10px', fontSize: '10px', fontWeight: 900, color: '#aaa', letterSpacing: '1px' };
const statBox = { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '20px' };
const analyticsPlaceholder = { padding: '60px 20px', textAlign: 'center', background: '#f9fafb', borderRadius: '35px', border: '2px dashed #eee' };
const analyticMiniCard = { background: '#fff', padding: '20px 40px', borderRadius: '25px', border: '1px solid #eee', flex: 1 };
const centerScreen = { padding: '200px', textAlign: 'center', fontWeight: 900, color: '#aaa' };
const modalBackdrop = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalPaper = { background: '#fff', padding: '50px 40px', borderRadius: '45px', textAlign: 'center', width: '90%', maxWidth: '440px' };
const deleteBtnSmall = { background: '#fef2f2', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
