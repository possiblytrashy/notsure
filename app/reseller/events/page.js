// FILE: app/reseller/events/page.js
// NEW FILE - Self-service event selection for resellers

"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Search, Calendar, MapPin, Loader2, 
  Plus, Check, ExternalLink, Copy, ChevronLeft
} from 'lucide-react';

export default function ResellerEventBrowse() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [reseller, setReseller] = useState(null);
  
  const [events, setEvents] = useState([]);
  const [myLinks, setMyLinks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Get reseller profile
      const { data: resellerData } = await supabase
        .from('resellers')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!resellerData) {
        router.push('/reseller/onboard');
        return;
      }

      setReseller(resellerData);
      await fetchData(resellerData.id);
    };
    init();
  }, [router]);

  const fetchData = async (resellerId) => {
    try {
      setLoading(true);

      // Fetch all active events that allow resellers
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .eq('is_deleted', false)
        .eq('allows_resellers', true)
        .order('created_at', { ascending: false });

      setEvents(eventsData || []);

      // Fetch reseller's existing links
      const { data: linksData } = await supabase
        .from('event_resellers')
        .select('*')
        .eq('reseller_id', resellerId);

      setMyLinks(linksData || []);

    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createLink = async (eventId) => {
    setCreating(eventId);
    try {
      const res = await fetch('/api/reseller/create-my-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId })
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh links
        await fetchData(reseller.id);
        alert('Link created! You can now share it.');
      } else {
        alert(data.error || 'Failed to create link');
      }
    } catch (err) {
      console.error('Create link error:', err);
      alert('An error occurred');
    } finally {
      setCreating(null);
    }
  };

  const copyLink = (code, eventId) => {
    const link = `${window.location.origin}/events/${eventId}?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const hasLink = (eventId) => {
    return myLinks.find(link => link.event_id === eventId);
  };

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="animate-spin" size={40} color="#CDa434" />
        <p style={styles.loadingText}>LOADING EVENTS...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={20} /> Back
        </button>
        <h1 style={styles.title}>Browse Events</h1>
        <div style={{ width: '60px' }} />
      </div>

      {/* Search */}
      <div style={styles.searchContainer}>
        <Search size={18} color="#666" />
        <input
          type="text"
          placeholder="Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Info Banner */}
      <div style={styles.infoBanner}>
        <p style={styles.infoText}>
          💡 Create a unique link for any event and earn 10% commission on every sale!
        </p>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <p style={styles.emptyState}>
          {searchQuery ? 'No events match your search' : 'No events available yet'}
        </p>
      ) : (
        <div style={styles.eventsGrid}>
          {filteredEvents.map(event => {
            const existingLink = hasLink(event.id);
            const isCreating = creating === event.id;

            return (
              <div key={event.id} style={styles.eventCard}>
                <div
                  style={{
                    ...styles.eventImage,
                    backgroundImage: `url(${event.images?.[0] || event.image_url || '/placeholder.jpg'})`
                  }}
                />
                <div style={styles.eventContent}>
                  <h3 style={styles.eventTitle}>{event.title}</h3>
                  <div style={styles.eventMeta}>
                    <div style={styles.metaItem}>
                      <Calendar size={14} color="#666" />
                      <span>{event.date}</span>
                    </div>
                    <div style={styles.metaItem}>
                      <MapPin size={14} color="#666" />
                      <span>{event.location}</span>
                    </div>
                  </div>

                  {existingLink ? (
                    <div style={styles.linkActions}>
                      <div style={styles.linkCode}>
                        <span style={styles.linkCodeText}>{existingLink.unique_code}</span>
                      </div>
                      <button
                        onClick={() => copyLink(existingLink.unique_code, event.id)}
                        style={styles.copyBtn}
                      >
                        {copiedCode === existingLink.unique_code ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      <a
                        href={`/events/${event.id}?ref=${existingLink.unique_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.viewBtn}
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={() => createLink(event.id)}
                      disabled={isCreating}
                      style={styles.createBtn(isCreating)}
                    >
                      {isCreating ? (
                        <><Loader2 className="animate-spin" size={16} /> Creating...</>
                      ) : (
                        <><Plus size={16} /> Create Link</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backBtn: {
    background: '#111',
    border: '1px solid #222',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '700'
  },
  title: {
    fontSize: '28px',
    fontWeight: '900',
    margin: 0
  },
  searchContainer: {
    maxWidth: '1200px',
    margin: '0 auto 30px',
    background: '#111',
    border: '1px solid #222',
    borderRadius: '16px',
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  searchInput: {
    background: 'none',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: '15px',
    flex: 1,
    fontFamily: 'inherit'
  },
  infoBanner: {
    maxWidth: '1200px',
    margin: '0 auto 30px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '16px'
  },
  infoText: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
    textAlign: 'center'
  },
  emptyState: {
    textAlign: 'center',
    color: '#666',
    padding: '60px 20px',
    fontSize: '16px'
  },
  eventsGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px'
  },
  eventCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: '20px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  eventImage: {
    height: '180px',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  },
  eventContent: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  eventTitle: {
    fontSize: '18px',
    fontWeight: '800',
    margin: 0,
    lineHeight: '1.3'
  },
  eventMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#666'
  },
  linkActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  },
  linkCode: {
    flex: 1,
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  linkCodeText: {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#CDa434',
    fontWeight: '700'
  },
  copyBtn: {
    width: '44px',
    height: '44px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewBtn: {
    width: '44px',
    height: '44px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none'
  },
  createBtn: (disabled) => ({
    background: disabled ? '#333' : '#CDa434',
    color: disabled ? '#666' : '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '800',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px'
  })
};
