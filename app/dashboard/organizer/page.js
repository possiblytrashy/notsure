"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download, X,
  TrendingUp, Smartphone, Clock, CheckCircle2, XCircle, Loader2, Save, Trash2
} from 'lucide-react';

export default function IntegratedDashboard() {
  // Data State
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ events: [], contests: [], payouts: [], profile: null });
  const [stats, setStats] = useState({ revenue: 0, votes: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State for Payout Settings
  const [momoConfig, setMomoConfig] = useState({
    number: "0541234567",
    network: "MTN"
  });

  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = user.id;

    const [eventsRes, contestsRes, payoutsRes, statsRes] = await Promise.all([
      supabase.from('events').select('*').eq('organizer_id', userId),
      supabase.from('contests').select('*, candidates(*)').eq('organizer_id', userId),
      supabase.from('payouts').select('*').eq('organizer_id', userId).order('created_at', { ascending: false }),
      supabase.rpc('get_organizer_stats') 
    ]);

    if (statsRes.data && statsRes.data[0]) {
      const s = statsRes.data[0];
      setStats({
        revenue: s.total_revenue || 0,
        votes: s.total_votes || 0,
        balance: (s.total_revenue || 0) - (s.total_payouts || 0)
      });
    }

    setData({
      events: eventsRes.data || [],
      contests: contestsRes.data || [],
      payouts: payoutsRes.data || [],
      profile: user
    });
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // --- LOGIC HANDLERS ---
  
  const deleteItem = async (table, id) => {
    if(!confirm("Are you sure you want to delete this? This cannot be undone.")) return;
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
        alert("Error deleting item");
    } else {
        loadDashboard(); // Refresh data
    }
  };

  const handleWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return alert("Enter a valid amount");
    if (amount > stats.balance) return alert("Insufficient balance");
    
    setIsProcessing(true);

    try {
      const { error: dbError } = await supabase
        .from('payouts')
        .insert([{ 
            organizer_id: data.profile.id, 
            amount: amount,
            momo_number: momoConfig.number,
            momo_network: momoConfig.network,
            status: 'pending'
        }]);

      if (dbError) throw dbError;
      alert(`Request Received! GHS ${amount} will be sent to your wallet.`);
      loadDashboard();
    } catch (err) {
      alert("Error processing withdrawal.");
    } finally {
      setIsProcessing(false);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    }
  };

  const copyMagicLink = (type, id, cat = null) => {
    const baseUrl = window.location.origin;
    let path = type === 'event' ? `/events/${id}` : `/voting/${id}`;
    if (cat) path += `?cat=${encodeURIComponent(cat)}`;
    const fullUrl = `${baseUrl}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopying(cat ? `${id}-${cat}` : id);
    setTimeout(() => setCopying(null), 2000);
  };

  const generateQR = (type, id) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/${type === 'event' ? 'events' : 'voting'}/${id}`;
    setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`);
  };

  if (loading) return <div style={centerScreen}>Initialising OUSTED Systems...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={subLabel}>WITHDRAWABLE BALANCE</p>
          <h2 style={revenueText}>GHS {stats.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <p style={{fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '5px'}}>Lifetime: GHS {stats.revenue.toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button style={actionBtn('#fff', '#000')} onClick={() => setShowSettingsModal(true)}>
            <Wallet size={18}/> Payout Settings
          </button>
          <button style={actionBtn('#0ea5e9', '#fff')} onClick={() => setShowWithdrawModal(true)}>
            Withdraw <ArrowUpRight size={18}/>
          </button>
        </div>
      </div>

      {/* PAYOUT HISTORY */}
      {data.payouts.length > 0 && (
        <div style={historySection}>
          <h4 style={{margin: '0 0 20px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px'}}>
            <Clock size={18} color="#0ea5e9"/> Recent Withdrawals
          </h4>
          <div style={historyTable}>
            {data.payouts.slice(0, 3).map((payout) => (
              <div key={payout.id} style={historyRow}>
                <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                  <div style={statusIcon(payout.status)}>
                    {payout.status === 'success' ? <CheckCircle2 size={16} /> : payout.status === 'failed' ? <XCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}
                  </div>
                  <div>
                    <p style={{margin: 0, fontWeight: 800, fontSize: '14px'}}>GHS {payout.amount}</p>
                    <p style={{margin: 0, fontSize: '11px', color: '#888'}}>{new Date(payout.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div style={statusBadge(payout.status)}>{payout.status.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div style={tabContainer}>
        {['events', 'contests', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>{tab}</button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div style={{ minHeight: '400px' }}>
        <div style={contentHeader}>
          <h3 style={{ fontWeight: 900, fontSize: '24px' }}>Manage {activeTab}</h3>
          {activeTab !== 'analytics' && (
            <a href={activeTab === 'events' ? '/dashboard/organizer/create' : '/dashboard/organizer/contests/create'} style={createLink}>
              <Plus size={20}/> New {activeTab.slice(0, -1)}
            </a>
          )}
        </div>

        {activeTab === 'events' && (
          <div style={gridStyle}>
            {data.events.map(event => {
              const firstImg = event.images && Array.isArray(event.images) ? event.images[0] : null;
              return (
                <div key={event.id} style={cardStyle}>
                  <div style={cardImage(firstImg)}>
                    {!firstImg && <div style={imagePlaceholder}><ImageIcon size={30} color="#ccc"/></div>}
                    <div style={cardOverlay}>
                      <button onClick={() => deleteItem('events', event.id)} style={iconCircleDelete} title="Delete Event">
                         <Trash2 size={16} color="#ef4444"/>
                      </button>
                      <button onClick={() => copyMagicLink('event', event.id)} style={iconCircle}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                      </button>
                      <button onClick={() => generateQR('event', event.id)} style={iconCircle}><QrCode size={16}/></button>
                    </div>
                  </div>
                  <h4 style={cardTitle}>{event.title || "Untitled Event"}</h4>
                  <p style={{fontSize: '12px', color: '#888', margin: 0}}>
                    {event.date ? new Date(event.date).toLocaleDateString() : 'No Date Set'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'contests' && (
          <div style={gridStyle}>
            {data.contests.map(contest => {
               const contestVotes = contest.candidates?.reduce((acc, curr) => acc + (curr.vote_count || 0), 0) || 0;
               return (
                <div key={contest.id} style={cardStyle}>
                  <div style={flexBetween}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={iconBox}><Trophy size={20} color="#0ea5e9"/></div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length || 0} Nominees</p>
                      </div>
                    </div>
                    <button onClick={() => deleteItem('contests', contest.id)} style={deleteBtnSmall}>
                        <Trash2 size={14} color="#ef4444"/>
                    </button>
                  </div>
                  <div style={statBox}>
                    <p style={miniLabel}>CONTEST VOTES</p>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>{contestVotes.toLocaleString()}</p>
                    <div style={{display: 'flex', gap: '8px', marginTop: '15px'}}>
                        <button onClick={() => copyMagicLink('contest', contest.id)} style={actionBtnSmall}>
                            {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>} Link
                        </button>
                        <button onClick={() => generateQR('contest', contest.id)} style={actionBtnSmall}><QrCode size={14}/> QR</button>
                    </div>
                  </div>
                </div>
               )
            })}
          </div>
        )}

        {activeTab === 'analytics' && (
             <div style={analyticsPlaceholder}>
                <div style={{display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '40px'}}>
                    <div style={analyticMiniCard}>
                        <p style={miniLabel}>TOTAL VOTES</p>
                        <h2 style={{margin:0}}>{stats.votes.toLocaleString()}</h2>
                    </div>
                    <div style={analyticMiniCard}>
                        <p style={miniLabel}>LIFETIME REVENUE</p>
                        <h2 style={{margin:0}}>GHS {stats.revenue.toLocaleString()}</h2>
                    </div>
                </div>
                <BarChart3 size={48} color="#0ea5e9" style={{marginBottom:'20px'}}/>
                <h2 style={{fontWeight:900}}>Voting Trends</h2>
                <p style={{color:'#666'}}>Visual charts are being connected to your real-time data.</p>
             </div>
        )}
      </div>

      {/* MODALS (Remain same) */}
      {showWithdrawModal && (
        <div style={modalBackdrop} onClick={() => setShowWithdrawModal(false)}>
            <div style={modalPaper} onClick={e => e.stopPropagation()}>
                <h3 style={modalTitle}>Withdraw Funds</h3>
                <div style={balancePreview}>
                    <p style={miniLabel}>AVAILABLE TO WITHDRAW</p>
                    <h2 style={{margin:0, fontSize:'32px'}}>GHS {stats.balance.toLocaleString()}</h2>
                </div>
                <input 
                    type="number" 
                    placeholder="Enter amount GHS" 
                    style={largeInput} 
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                />
                <div style={momoCard}>
                    <Smartphone size={18} />
                    <div style={{flex:1, textAlign:'left'}}>
                        <p style={{margin:0, fontWeight:800, fontSize:'14px'}}>{momoConfig.network} Wallet</p>
                        <p style={{margin:0, fontSize:'12px', color:'#666'}}>{momoConfig.number}</p>
                    </div>
                </div>
                <button style={payoutBtn(isProcessing)} onClick={handleWithdrawal}>
                    {isProcessing ? 'Processing Request...' : 'Confirm Payout'}
                </button>
            </div>
        </div>
      )}

      {showSettingsModal && (
        <div style={modalBackdrop} onClick={() => setShowSettingsModal(false)}>
          <div style={modalPaper} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Payout Settings</h3>
            <div style={{textAlign: 'left', marginBottom: '20px'}}>
              <p style={miniLabel}>MOBILE MONEY NETWORK</p>
              <select 
                style={largeInput} 
                value={momoConfig.network}
                onChange={(e) => setMomoConfig({...momoConfig, network: e.target.value})}
              >
                <option value="MTN">MTN Mobile Money</option>
                <option value="VODAFONE">Vodafone Cash</option>
                <option value="AIRTELTIGO">AirtelTigo Money</option>
              </select>
              <p style={miniLabel}>PHONE NUMBER</p>
              <input 
                type="text" 
                style={largeInput} 
                value={momoConfig.number}
                onChange={(e) => setMomoConfig({...momoConfig, number: e.target.value})}
              />
            </div>
            <button style={payoutBtn(false)} onClick={() => { setShowSettingsModal(false); alert("Saved Successfully!"); }}>
              <Save size={18}/> Save Account
            </button>
          </div>
        </div>
      )}

      {showQR && (
        <div style={modalBackdrop} onClick={() => setShowQR(null)}>
          <div style={modalPaper} onClick={e => e.stopPropagation()}>
            <h3 style={modalTitle}>Download QR Code</h3>
            <img src={showQR} alt="QR" style={{width: '200px', borderRadius: '20px', marginBottom:'20px'}} />
            <button style={actionBtn('#000', '#fff')} onClick={() => window.open(showQR)}>
              <Download size={18}/> Save to Device
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEW/UPDATED STYLES ---
const imagePlaceholder = { width: '100%', height: '100%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconCircleDelete = { width: '38px', height: '38px', borderRadius: '12px', background: '#fef2f2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' };
const deleteBtnSmall = { background: '#fef2f2', border: 'none', width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const actionBtnSmall = { background: '#fff', border: '1px solid #eee', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' };

// (Previous styles)
const analyticMiniCard = { background: '#fff', padding: '20px 40px', borderRadius: '25px', border: '1px solid #eee', flex: 1 };
const analyticsPlaceholder = { padding: '60px 20px', textAlign: 'center', background: '#f9fafb', borderRadius: '35px', border: '2px dashed #eee' };
const centerScreen = { padding: '200px', textAlign: 'center', fontWeight: 900, color: '#aaa' };
const financeBar = { background: '#000', color: '#fff', padding: '40px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const subLabel = { margin: 0, fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.5)' };
const revenueText = { margin: 0, fontSize: '36px', fontWeight: 900 };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '14px 24px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' });
const historySection = { marginBottom: '50px', background: '#fff', padding: '30px', borderRadius: '35px', border: '1px solid #f0f0f0' };
const historyTable = { display: 'flex', flexDirection: 'column', gap: '15px' };
const historyRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', background: '#fcfcfc', borderRadius: '20px', border: '1px solid #f5f5f5' };
const statusIcon = (status) => ({ width: '35px', height: '35px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: status === 'success' ? '#f0fdf4' : status === 'failed' ? '#fef2f2' : '#eff6ff', color: status === 'success' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#3b82f6' });
const statusBadge = (status) => ({ fontSize: '10px', fontWeight: 900, padding: '5px 12px', borderRadius: '10px', letterSpacing: '0.5px', background: status === 'success' ? '#22c55e' : status === 'failed' ? '#ef4444' : '#000', color: '#fff' });
const tabContainer = { display: 'flex', gap: '30px', marginBottom: '40px', borderBottom: '1px solid #eee' };
const tabStyle = (active) => ({ padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', color: active ? '#000' : '#aaa', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const createLink = { textDecoration: 'none', background: '#f0f9ff', color: '#0ea5e9', padding: '12px 24px', borderRadius: '15px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '35px', border: '1px solid #f0f0f0' };
const cardImage = (url) => ({ height: '160px', background: url ? `url(${url}) center/cover` : '#f8fafc', borderRadius: '25px', position: 'relative', overflow: 'hidden' });
const cardOverlay = { position: 'absolute', top: 0, right: 0, padding: '15px', display: 'flex', gap: '10px' };
const iconCircle = { width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' };
const cardTitle = { margin: '15px 0 5px', fontWeight: 900, fontSize: '18px' };
const flexBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const iconBox = { width: '45px', height: '45px', borderRadius: '14px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const miniLabel = { margin: '0 0 10px', fontSize: '10px', fontWeight: 900, color: '#aaa', letterSpacing: '1px' };
const statBox = { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '20px' };
const modalBackdrop = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalPaper = { background: '#fff', padding: '50px 40px', borderRadius: '45px', textAlign: 'center', width: '90%', maxWidth: '440px' };
const modalTitle = { fontWeight: 900, fontSize: '24px', margin: '0 0 30px' };
const balancePreview = { background: '#f0f9ff', padding: '20px', borderRadius: '25px', marginBottom: '20px' };
const largeInput = { width: '100%', padding: '15px', borderRadius: '15px', border: '2px solid #f0f0f0', fontSize: '16px', fontWeight: 700, marginBottom: '20px', outline: 'none' };
const momoCard = { display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', background: '#fff', border: '1px solid #eee', borderRadius: '15px', marginBottom: '30px' };
const payoutBtn = (loading) => ({ width: '100%', background: loading ? '#ccc' : '#0ea5e9', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' });
