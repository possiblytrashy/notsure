"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download, X,
  TrendingUp, Smartphone
} from 'lucide-react';

export default function IntegratedDashboard() {
  // Data State
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ events: [], contests: [], profile: null });
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // FIX: Sanitize UUID to prevent 400 Bad Request error
      const userId = String(user.id).trim();

      const [eventsRes, contestsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', userId),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', userId)
      ]);

      setData({
        events: eventsRes.data || [],
        contests: contestsRes.data || [],
        profile: user
      });
      setLoading(false);
    }
    loadDashboard();
  }, []);

  // --- LOGIC HANDLERS ---
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

  const handleWithdrawal = () => {
    if (!withdrawAmount || withdrawAmount <= 0) return alert("Enter a valid amount");
    setIsProcessing(true);
    setTimeout(() => {
      alert(`Request Received! GHS ${withdrawAmount} will be sent to your linked MoMo wallet.`);
      setIsProcessing(false);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    }, 2000);
  };

  const totalRevenue = 14500.50; 

  if (loading) return <div style={centerScreen}>Initialising OUSTED Systems...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* 1. FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={subLabel}>TOTAL REVENUE (NET)</p>
          <h2 style={revenueText}>GHS {totalRevenue.toLocaleString()}</h2>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button style={actionBtn('#fff', '#000')} onClick={() => alert("Directing to Payout Methods...")}>
            <Wallet size={18}/> Payout Settings
          </button>
          <button style={actionBtn('#0ea5e9', '#fff')} onClick={() => setShowWithdrawModal(true)}>
            Withdraw <ArrowUpRight size={18}/>
          </button>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div style={tabContainer}>
        {['events', 'contests', 'analytics'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* 3. CONTENT AREA */}
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
            {data.events.map(event => (
              <div key={event.id} style={cardStyle}>
                <div style={cardImage(event.images?.[0])}>
                   <div style={cardOverlay}>
                      <button onClick={() => copyMagicLink('event', event.id)} style={iconCircle}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                      </button>
                      <button onClick={() => generateQR('event', event.id)} style={iconCircle}><QrCode size={16}/></button>
                   </div>
                </div>
                <h4 style={cardTitle}>{event.title}</h4>
                <div style={cardMeta}>
                  <span><Ticket size={14}/> 45 Sold</span>
                  <span style={{fontWeight: 800, color: '#0ea5e9'}}>GHS {event.price}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'contests' && (
          <div style={gridStyle}>
            {data.contests.map(contest => {
               const categories = [...new Set(contest.candidates?.map(c => c.category || 'General'))];
               const totalVotes = contest.candidates?.reduce((acc, curr) => acc + curr.vote_count, 0) || 0;
               return (
                <div key={contest.id} style={cardStyle}>
                  <div style={flexBetween}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={iconBox}><Trophy size={20} color="#0ea5e9"/></div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length} Nominees</p>
                      </div>
                    </div>
                    <div style={{display:'flex', gap:'8px'}}>
                        <button onClick={() => generateQR('contest', contest.id)} style={smallBtn}><QrCode size={14}/></button>
                        <button onClick={() => copyMagicLink('contest', contest.id)} style={smallBtn}>
                            {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>}
                        </button>
                    </div>
                  </div>

                  <div style={shareBox}>
                    <p style={miniLabel}>CATEGORY MAGIC LINKS</p>
                    <div style={tagCloud}>
                      {categories.map(cat => (
                        <button key={cat} onClick={() => copyMagicLink('contest', contest.id, cat)} style={catTag(copying === `${contest.id}-${cat}`)}>
                          {cat} {copying === `${contest.id}-${cat}` ? <Check size={10}/> : <Copy size={10}/>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={statBox}>
                    <p style={miniLabel}>CUMULATIVE VOTES</p>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>{totalVotes.toLocaleString()}</p>
                  </div>
                </div>
               )
            })}
          </div>
        )}
      </div>

      {/* 4. MODALS (Withdrawal & QR) */}
      {showWithdrawModal && (
        <div style={modalBackdrop} onClick={() => setShowWithdrawModal(false)}>
            <div style={modalPaper} onClick={e => e.stopPropagation()}>
                <h3 style={modalTitle}>Withdraw Funds</h3>
                <div style={balancePreview}>
                    <p style={miniLabel}>AVAILABLE</p>
                    <h2 style={{margin:0, fontSize:'32px'}}>GHS {totalRevenue.toLocaleString()}</h2>
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
                        <p style={{margin:0, fontWeight:800, fontSize:'14px'}}>MTN Mobile Money</p>
                        <p style={{margin:0, fontSize:'12px', color:'#666'}}>Saved: 054 **** 123</p>
                    </div>
                </div>
                <button style={payoutBtn(isProcessing)} onClick={handleWithdrawal}>
                    {isProcessing ? 'Processing Request...' : 'Confirm Payout'}
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

// --- STYLING OBJECTS ---
const centerScreen = { padding: '200px', textAlign: 'center', fontWeight: 900, color: '#aaa' };
const financeBar = { background: '#000', color: '#fff', padding: '40px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' };
const subLabel = { margin: 0, fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.5)' };
const revenueText = { margin: 0, fontSize: '36px', fontWeight: 900 };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '14px 24px', borderRadius: '18px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' });
const tabContainer = { display: 'flex', gap: '30px', marginBottom: '40px', borderBottom: '1px solid #eee' };
const tabStyle = (active) => ({ padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 800, textTransform: 'uppercase', color: active ? '#000' : '#aaa', borderBottom: active ? '3px solid #000' : '3px solid transparent' });
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const createLink = { textDecoration: 'none', background: '#f0f9ff', color: '#0ea5e9', padding: '12px 24px', borderRadius: '15px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '35px', border: '1px solid #f0f0f0' };
const cardImage = (url) => ({ height: '160px', background: `url(${url}) center/cover`, borderRadius: '25px', position: 'relative', overflow: 'hidden' });
const cardOverlay = { position: 'absolute', top: 0, right: 0, padding: '15px', display: 'flex', gap: '10px' };
const iconCircle = { width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.95)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' };
const cardTitle = { margin: '15px 0 5px', fontWeight: 900, fontSize: '18px' };
const cardMeta = { display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666' };
const flexBetween = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const iconBox = { width: '45px', height: '45px', borderRadius: '14px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const smallBtn = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' };
const shareBox = { marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' };
const miniLabel = { margin: '0 0 10px', fontSize: '10px', fontWeight: 900, color: '#aaa', letterSpacing: '1px' };
const tagCloud = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const catTag = (active) => ({ padding: '6px 12px', borderRadius: '10px', border: '1px solid #eee', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: active ? '#000' : '#fff', color: active ? '#fff' : '#555', display: 'flex', alignItems: 'center', gap: '5px' });
const statBox = { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '20px' };
const modalBackdrop = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalPaper = { background: '#fff', padding: '50px 40px', borderRadius: '45px', textAlign: 'center', width: '90%', maxWidth: '440px' };
const modalTitle = { fontWeight: 900, fontSize: '24px', margin: '0 0 30px' };
const balancePreview = { background: '#f0f9ff', padding: '20px', borderRadius: '25px', marginBottom: '20px' };
const largeInput = { width: '100%', padding: '20px', borderRadius: '15px', border: '2px solid #f0f0f0', fontSize: '20px', fontWeight: 800, marginBottom: '20px', textAlign: 'center', outline: 'none' };
const momoCard = { display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', background: '#fff', border: '1px solid #eee', borderRadius: '15px', marginBottom: '30px' };
const payoutBtn = (loading) => ({ width: '100%', background: loading ? '#ccc' : '#0ea5e9', color: '#fff', border: 'none', padding: '20px', borderRadius: '20px', fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' });
