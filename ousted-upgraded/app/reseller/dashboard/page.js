// FILE: app/reseller/dashboard/page.js
// NEW FILE - Create this for reseller dashboard

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, Link2, MousePointerClick, DollarSign, 
  Copy, Check, ExternalLink, Loader2, LogOut
} from 'lucide-react';

export default function ResellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [reseller, setReseller] = useState(null);
  const [stats, setStats] = useState(null);
  const [links, setLinks] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      await fetchResellerData(user.id);
    };
    init();
  }, [router]);

  const fetchResellerData = async (userId) => {
    try {
      setLoading(true);

      // Get reseller profile
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!resellerData) {
        // Not a reseller yet
        setLoading(false);
        return;
      }

      setReseller(resellerData);

      // Get stats
      const { data: statsData } = await supabase
        .rpc('get_reseller_stats', { p_reseller_id: resellerData.id });

      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      // Get reseller links
      const { data: linksData } = await supabase
        .from('event_resellers')
        .select(`
          *,
          events:event_id (id, title, date, images)
        `)
        .eq('reseller_id', resellerData.id)
        .order('created_at', { ascending: false });

      setLinks(linksData || []);

    } catch (err) {
      console.error('Error fetching reseller data:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (code) => {
    const link = `${window.location.origin}/events/${code.split('-')[0]}?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navigateToEvents = () => {
    router.push('/reseller/events');
  };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="animate-spin" size={40} color="#CDa434" />
        <p style={styles.loadingText}>LOADING DASHBOARD...</p>
      </div>
    );
  }

  if (!reseller) {
    return (
      <div style={styles.container}>
        <div style={styles.notReseller}>
          <h2 style={styles.notResellerTitle}>Reseller Program</h2>
          <p style={styles.notResellerText}>
            You're not enrolled as a reseller yet. Contact support to join the program.
          </p>
          <button onClick={() => router.push('/dashboard')} style={styles.backBtn}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Reseller Dashboard</h1>
          <p style={styles.subtitle}>Track your earnings & performance</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={18} />
        </button>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon('#10b981')}>
            <DollarSign size={20} />
          </div>
          <p style={styles.statLabel}>Total Earned</p>
          <p style={styles.statValue}>GHS {stats?.total_earned?.toFixed(2) || '0.00'}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon('#f59e0b')}>
            <TrendingUp size={20} />
          </div>
          <p style={styles.statLabel}>Pending Payout</p>
          <p style={styles.statValue}>GHS {stats?.pending_payout?.toFixed(2) || '0.00'}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon('#3b82f6')}>
            <MousePointerClick size={20} />
          </div>
          <p style={styles.statLabel}>Total Clicks</p>
          <p style={styles.statValue}>{stats?.total_clicks || 0}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon('#8b5cf6')}>
            <Link2 size={20} />
          </div>
          <p style={styles.statLabel}>Total Sales</p>
          <p style={styles.statValue}>{stats?.total_sales || 0}</p>
        </div>
      </div>

      {/* Affiliate Links */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={styles.sectionTitle}>Your Affiliate Links</h2>
          <button onClick={navigateToEvents} style={styles.addEventBtn}>
            + Browse Events
          </button>
        </div>
        
        {links.length === 0 ? (
          <p style={styles.emptyState}>No affiliate links yet. Contact organizers to get links for their events.</p>
        ) : (
          <div style={styles.linksGrid}>
            {links.map(link => {
              const fullLink = `${window.location.origin}/events/${link.event_id}?ref=${link.unique_code}`;
              const conversionRate = link.clicks > 0 ? ((link.sales_count / link.clicks) * 100).toFixed(1) : '0.0';
              
              return (
                <div key={link.id} style={styles.linkCard}>
                  <div style={styles.linkHeader}>
                    <div 
                      style={{
                        ...styles.linkImage,
                        backgroundImage: `url(${link.events?.images?.[0] || '/placeholder.jpg'})`
                      }}
                    />
                    <div style={styles.linkInfo}>
                      <h3 style={styles.linkTitle}>{link.events?.title}</h3>
                      <p style={styles.linkCode}>{link.unique_code}</p>
                    </div>
                  </div>

                  <div style={styles.linkStats}>
                    <div style={styles.linkStat}>
                      <span style={styles.linkStatLabel}>Clicks</span>
                      <span style={styles.linkStatValue}>{link.clicks}</span>
                    </div>
                    <div style={styles.linkStat}>
                      <span style={styles.linkStatLabel}>Sales</span>
                      <span style={styles.linkStatValue}>{link.sales_count}</span>
                    </div>
                    <div style={styles.linkStat}>
                      <span style={styles.linkStatLabel}>Conv. Rate</span>
                      <span style={styles.linkStatValue}>{conversionRate}%</span>
                    </div>
                  </div>

                  <div style={styles.linkActions}>
                    <button 
                      onClick={() => copyLink(link.unique_code)}
                      style={styles.copyBtn}
                    >
                      {copiedCode === link.unique_code ? (
                        <><Check size={16} /> Copied!</>
                      ) : (
                        <><Copy size={16} /> Copy Link</>
                      )}
                    </button>
                    <a 
                      href={fullLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.visitBtn}
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#fff',
    padding: '20px',
    fontFamily: 'sans-serif'
  },
  loadingScreen: {
    height: '100vh',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '10px',
    letterSpacing: '3px',
    color: '#666',
    fontWeight: 'bold'
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: '900',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '5px 0 0'
  },
  logoutBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: '#111',
    border: '1px solid #222',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statsGrid: {
    maxWidth: '1200px',
    margin: '0 auto 40px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '20px'
  },
  statCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '20px',
    padding: '24px'
  },
  statIcon: (color) => ({
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    background: color + '20',
    color: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px'
  }),
  statLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '600',
    margin: '0 0 8px'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '900',
    margin: 0
  },
  section: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '800',
    marginBottom: '20px'
  },
  emptyState: {
    textAlign: 'center',
    color: '#666',
    padding: '60px 20px'
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px'
  },
  linkCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '20px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  linkHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  linkImage: {
    width: '60px',
    height: '60px',
    borderRadius: '12px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    flexShrink: 0
  },
  linkInfo: {
    flex: 1,
    minWidth: 0
  },
  linkTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  linkCode: {
    fontSize: '11px',
    color: '#666',
    margin: 0,
    fontFamily: 'monospace'
  },
  linkStats: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#0a0a0a',
    borderRadius: '12px'
  },
  linkStat: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  linkStatLabel: {
    fontSize: '10px',
    color: '#666',
    fontWeight: '600'
  },
  linkStatValue: {
    fontSize: '16px',
    fontWeight: '800'
  },
  linkActions: {
    display: 'flex',
    gap: '8px'
  },
  copyBtn: {
    flex: 1,
    background: '#CDa434',
    color: '#000',
    border: 'none',
    padding: '12px',
    borderRadius: '12px',
    fontWeight: '800',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  },
  visitBtn: {
    width: '44px',
    height: '44px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    textDecoration: 'none'
  },
  notReseller: {
    maxWidth: '500px',
    margin: '100px auto',
    textAlign: 'center',
    padding: '40px'
  },
  notResellerTitle: {
    fontSize: '28px',
    fontWeight: '900',
    marginBottom: '16px'
  },
  notResellerText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px'
  },
  backBtn: {
    background: '#CDa434',
    color: '#000',
    border: 'none',
    padding: '14px 30px',
    borderRadius: '12px',
    fontWeight: '800',
    cursor: 'pointer'
  },
  addEventBtn: {
    background: '#CDa434',
    color: '#000',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: 'pointer'
  }
};
