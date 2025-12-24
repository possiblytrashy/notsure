"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Plus, BarChart3, Users, Ticket, Calendar, 
  Trophy, Wallet, ArrowUpRight, Settings, Image as ImageIcon,
  Link as LinkIcon, Share2, Check, Copy
} from 'lucide-react';

export default function IntegratedDashboard() {
  const [activeTab, setActiveTab] = useState('events');
  const [data, setData] = useState({ events: [], contests: [], profile: null });
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(null); // Feedback for copy button

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [eventsRes, contestsRes] = await Promise.all([
        supabase.from('events').select('*').eq('organizer_id', user.id),
        supabase.from('contests').select('*, candidates(*)').eq('organizer_id', user.id)
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

  // MAGIC LINK GENERATOR
  const copyMagicLink = (type, id, cat = null) => {
    const baseUrl = window.location.origin;
    let path = type === 'event' ? `/events/${id}` : `/voting/${id}`;
    if (cat) path += `?cat=${encodeURIComponent(cat)}`;
    
    const fullUrl = `${baseUrl}${path}`;
    navigator.clipboard.writeText(fullUrl);
    
    setCopying(cat ? `${id}-${cat}` : id);
    setTimeout(() => setCopying(null), 2000);
  };

  const totalRevenue = 14500.50; 

  if (loading) return <div style={{ padding: '150px', textAlign: 'center', fontWeight: 800 }}>Loading Dashboard...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '120px 20px' }}>
      
      {/* 1. FINANCIAL TOP BAR */}
      <div style={financeBar}>
        <div>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>TOTAL BALANCE</p>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 900 }}>GHS {totalRevenue.toLocaleString()}</h2>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button style={actionBtn('#fff', '#000')}><Wallet size={18}/> Payout Settings</button>
          <button style={actionBtn('#0ea5e9', '#fff')}>Withdraw <ArrowUpRight size={18}/></button>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '30px', marginBottom: '40px', borderBottom: '1px solid #eee' }}>
        {['events', 'contests', 'analytics'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '15px 5px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '16px', fontWeight: 800, textTransform: 'uppercase',
              color: activeTab === tab ? '#000' : '#aaa',
              borderBottom: activeTab === tab ? '3px solid #000' : '3px solid transparent'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. DYNAMIC CONTENT AREA */}
      <div style={{ minHeight: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 900, fontSize: '24px' }}>Manage {activeTab}</h3>
          <a 
            href={activeTab === 'events' ? '/dashboard/organizer/create' : '/dashboard/organizer/contests/create'} 
            style={createLink}
          >
            <Plus size={20}/> New {activeTab.slice(0, -1)}
          </a>
        </div>

        {activeTab === 'events' && (
          <div style={gridStyle}>
            {data.events.map(event => (
              <div key={event.id} style={cardStyle}>
                <div style={{ height: '150px', background: `url(${event.images?.[0]}) center/cover`, borderRadius: '20px', position: 'relative' }}>
                   <button 
                    onClick={() => copyMagicLink('event', event.id)}
                    style={floatingLinkBtn}
                   >
                    {copying === event.id ? <Check size={16}/> : <LinkIcon size={16}/>}
                   </button>
                </div>
                <h4 style={{ margin: '15px 0 5px', fontWeight: 900 }}>{event.title}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666' }}>
                  <span><Ticket size={14}/> 45 Sold</span>
                  <span style={{fontWeight: 800, color: '#000'}}>GHS {event.price}</span>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={iconBox}><Trophy size={24} color="#0ea5e9"/></div>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 900 }}>{contest.title}</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{contest.candidates?.length} Candidates</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => copyMagicLink('contest', contest.id)} 
                      style={smallLinkBtn}
                      title="Copy Contest Link"
                    >
                      {copying === contest.id ? <Check size={14}/> : <LinkIcon size={14}/>}
                    </button>
                  </div>

                  <div style={shareSection}>
                    <p style={sectionLabel}>CATEGORY MAGIC LINKS</p>
                    <div style={tagCloud}>
                      {categories.map(cat => (
                        <button 
                          key={cat} 
                          onClick={() => copyMagicLink('contest', contest.id, cat)}
                          style={catTag(copying === `${contest.id}-${cat}`)}
                        >
                          {cat} {copying === `${contest.id}-${cat}` ? <Check size={10}/> : <Copy size={10}/>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={statBox}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, color: '#64748b' }}>TOTAL VOTES</p>
                    <p style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>
                      {contest.candidates?.reduce((acc, curr) => acc + curr.vote_count, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
               )
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// STYLES
const financeBar = { background: '#000', color: '#fff', padding: '40px', borderRadius: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' };
const actionBtn = (bg, col) => ({ background: bg, color: col, border: 'none', padding: '12px 20px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' });
const createLink = { textDecoration: 'none', background: '#f0f9ff', color: '#0ea5e9', padding: '10px 20px', borderRadius: '12px', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' };
const cardStyle = { background: '#fff', padding: '25px', borderRadius: '35px', border: '1px solid #eee', position: 'relative' };
const iconBox = { width: '50px', height: '50px', borderRadius: '15px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const floatingLinkBtn = { position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.9)', border: 'none', width: '35px', height: '35px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const smallLinkBtn = { background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' };
const sectionLabel = { margin: '20px 0 10px', fontSize: '10px', fontWeight: 800, color: '#aaa', letterSpacing: '1px' };
const shareSection = { marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '15px' };
const tagCloud = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const catTag = (isCopied) => ({ 
  padding: '6px 12px', borderRadius: '8px', border: '1px solid #eee', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
  background: isCopied ? '#000' : '#fff', color: isCopied ? '#fff' : '#555',
  display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s'
});
const statBox = { marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '15px' };
