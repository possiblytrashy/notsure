"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy, QrCode, Download
} from 'lucide-react';

export default function IntegratedDashboard() {
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ events: [], contests: [], profile: null });
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(null);
  const [showQR, setShowQR] = useState(null); // Stores the URL for the QR Modal

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fix for the 400 error: Ensure the ID is a clean string
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
    // Using a reliable QR API for instant generation
    setShowQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`);
  };

  const totalRevenue = 14500.50; 

  if (loading) return <div style={loadingText}>Initialising OUSTED Command Centre...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* 1. FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>TOTAL BALANCE</p>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 900 }}>GHS {totalRevenue.toLocaleString()}</h2>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button style={actionBtn('#fff', '#000')}><Wallet size={18}/> Payouts</button>
          <button style={actionBtn('#0ea5e9', '#fff')}>Withdraw <ArrowUpRight size={18}/></button>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div style={tabContainer}>
        {['events', 'contests', 'analytics'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={tabStyle(activeTab === tab)}
          >
            {tab === 'analytics' && <BarChart3 size={16} style={{marginRight: '8px'}}/>}
            {tab}
          </button>
        ))}
      </div>

      {/* 3. DYNAMIC CONTENT AREA */}
      <div style={{ minHeight: '400px' }}>
        <div style={contentHeader}>
          <h3 style={{ fontWeight: 900, fontSize: '24px', margin: 0 }}>
            {activeTab === 'analytics' ? 'Global Insights' : `Manage ${activeTab}`}
          </h3>
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
                <div style={{ height: '160px', background: `url(${event.images?.[0]}) center/cover`, borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
                   <div style={cardOverlay}>
                      <button onClick={() => copyMagicLink('event', event.id)} style={iconCircle}>
                        {copying === event.id ? <Check size={16} color="#22c55e"/> : <LinkIcon size={16}/>}
                      </button>
                      <button onClick={() => generateQR('event', event.id)} style={iconCircle}>
                        <QrCode size={16}/>
                      </button>
                   </div>
                </div>
                <h4 style={{ margin: '18px 0 5px', fontWeight: 900 }}>{event.title}</h4>
                <div style={cardMeta}>
                  <span><Ticket size={14}/> 45 Sold</span>
                  <span style={{color: '#0ea5e9', fontWeight: 800}}>GHS {event.price}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'contests' && (
          <div style={gridStyle}>
            {data.contests.map(contest => {
               const categories = [...new Set(contest.candidates?.map(c => c.category || 'General'))];
               return (
                <div key={contest.id} style={cardStyle}>
                  <div style={contestHeaderRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={iconBox}><Trophy size={20} color="#0ea5e9"/></div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length} Nominees</p>
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '8px'}}>
                      <button onClick={() => generateQR('contest', contest.id)} style={smallLinkBtn}><QrCode size={14}/></button>
                      <button onClick={() => copyMagicLink('contest', contest.id)} style={smallLinkBtn}>
                        {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>}
                      </button>
                    </div>
                  </div>

                  <div style={shareSection}>
                    <p style={sectionLabel}>CATEGORY MAGIC LINKS</p>
                    <div style={tagCloud}>
                      {categories.map(cat => (
                        <button key={cat} onClick={() => copyMagicLink('contest', contest.id, cat)} style={catTag(copying === `${contest.id}-${cat}`)}>
                          {cat} {copying === `${contest.id}-${cat}` ? <Check size={10}/> : <Copy size={10}/>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={statBox}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b' }}>TOTAL VOTES</p>
                      <TrendingUp size={14} color="#22c55e"/>
                    </div>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>
                      {contest.candidates?.reduce((acc, curr) => acc + curr.vote_count, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
               )
            })}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div style={placeholderAnalytics}>
            <BarChart3 size={48} color="#0ea5e9" style={{marginBottom: '20px'}}/>
            <h2 style={{fontWeight: 900}}>Analytics Engine Warming Up</h2>
            <p>Connect your Paystack account to see real-time revenue and conversion heatmaps.</p>
          </div>
        )}
      </div>

      {/* QR MODAL */}
      {showQR && (
        <div style={modalOverlay} onClick={() => setShowQR(null)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{fontWeight: 900, marginBottom: '20px'}}>Poster QR Code</h3>
            <img src={showQR} alt="QR Code" style={{width: '200px', borderRadius: '15px'}} />
            <p style={{fontSize: '12px', color: '#666', marginTop: '15px'}}>Scan to go directly to page</p>
            <button style={actionBtn('#000', '#fff')} onClick={() => window.open(showQR)}>
              <Download size={18}/> Download JPG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// STYLES
const loadingText = { padding: '150px', textAlign: 'center', fontWeight: 900, fontSize: '20px', letterSpacing: '-1px' };
const financeBar = { background: '#000', color: '#fff', padding: '40px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' };
const tabContainer = { display: 'flex', gap: '30px', marginBottom: '40px', borderBottom: '1px solid #eee' };
const tabStyle = (active) => ({ padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: active ? '#000' : '#aaa', borderBottom: active ? '3px solid #000' : '3px solid transparent', display: 'flex', alignItems: 'center' });
const contentHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '12px 22px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' });
const createLink = { textDecoration: 'none', background: '#f0f9ff', color: '#0ea5e9', padding: '12px 24px', borderRadius: '16px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '30px' };
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '40px', border: '1px solid #f0f0f0', transition: 'y 0.3s ease' };
const cardOverlay = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', padding: '15px', gap: '10px' };
const iconCircle = { width: '40px', height: '40px', borderRadius: '14px', background: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' };
const cardMeta = { display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666', marginTop: '10px' };
const contestHeaderRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
const iconBox = { width: '45px', height: '45px', borderRadius: '14px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const shareSection = { marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' };
const sectionLabel = { margin: '0 0 12px', fontSize: '10px', fontWeight: 800, color: '#aaa', letterSpacing: '1px' };
const tagCloud = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const catTag = (active) => ({ padding: '8px 14px', borderRadius: '12px', border: '1px solid #eee', fontSize: '11px', fontWeight: 700, cursor: 'pointer', background: active ? '#000' : '#fff', color: active ? '#fff' : '#555', display: 'flex', alignItems: 'center', gap: '6px' });
const statBox = { marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '24px' };
const smallLinkBtn = { background: '#fff', border: '1px solid #eee', padding: '10px', borderRadius: '12px', cursor: 'pointer', color: '#64748b' };
const placeholderAnalytics = { textAlign: 'center', padding: '100px 20px', background: '#fcfcfc', borderRadius: '40px', border: '2px dashed #eee' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContent = { background: '#fff', padding: '40px', borderRadius: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' };

function TrendingUp({size, color}) {
  return <BarChart3 size={size} color={color} style={{transform: 'rotate(-90deg)'}} />;
}
