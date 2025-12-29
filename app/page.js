"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, MapPin, Calendar, ArrowRight, Zap, Flame, Ticket, LayoutGrid } from 'lucide-react';

// Enhanced Skeleton with Pulse Animation
const Skeleton = () => (
  <div style={styles.card}>
    <div style={{ height: '200px', background: '#eee', borderRadius: '25px', animation: 'pulse 1.5s infinite ease-in-out' }} />
    <div style={{ height: '20px', width: '70%', background: '#eee', marginTop: '15px', borderRadius: '10px' }} />
    <div style={{ height: '15px', width: '40%', background: '#eee', marginTop: '10px', borderRadius: '10px' }} />
  </div>
);

export default function Home() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // --- UPDATED QUERY: Filter out deleted events ---
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('is_deleted', false) // Only show events that are NOT deleted
          .order('date', { ascending: true });
        
        setEvents(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = events.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
  
  // Logic for Sections
  const featuredEvent = filtered[0];
  const upcomingEvents = filtered.slice(1);

  return (
    <div style={styles.pageWrapper}>
      <style>{`
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        @media (max-width: 768px) {
          .hero-title { font-size: 45px !important; }
          .grid-container { grid-template-columns: 1fr !important; }
          .hero-section { padding: 40px 10px !important; }
        }
      `}</style>

      {/* --- HERO SECTION --- */}
      <section style={styles.heroSection} className="hero-section">
        <div style={styles.badge}><Flame size={14} /> NOW TRENDING IN ACCRA</div>
        <h1 style={styles.heroTitle} className="hero-title">
          Experience <br/><span style={{ color: 'rgba(0,0,0,0.3)' }}>Everything.</span>
        </h1>
        
        <div style={styles.searchContainer}>
          <Search size={20} style={styles.searchIcon} />
          <input 
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parties, concerts, or art..." 
            style={styles.searchInput}
          />
        </div>
      </section>

      {/* --- FEATURED SECTION --- */}
      {!search && featuredEvent && !loading && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}><Zap size={22} color="#e73c7e" /> Featured Experience</h2>
          </div>
          <a href={`/events/${featuredEvent.id}`} style={styles.featuredCard}>
            <div style={{...styles.cardImg, backgroundImage: `url(${featuredEvent.images?.[0]})`, height: '400px'}} />
            <div style={styles.featuredOverlay}>
              <span style={styles.dateTag}>{featuredEvent.date}</span>
              <h3 style={styles.featuredTitle}>{featuredEvent.title}</h3>
              <p style={styles.locationTag}><MapPin size={16} /> {featuredEvent.location}</p>
            </div>
          </a>
        </section>
      )}

      {/* --- UPCOMING EVENTS GRID --- */}
      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}><LayoutGrid size={22} /> {search ? 'Results' : 'Upcoming Events'}</h2>
          <span style={styles.countBadge}>{filtered.length} Events</span>
        </div>

        <div style={styles.grid} className="grid-container">
          {loading ? (
            [1, 2, 3].map(n => <Skeleton key={n} />)
          ) : (
            (search ? filtered : upcomingEvents).map(event => (
              <a key={event.id} href={`/events/${event.id}`} style={styles.card}>
                <div style={{...styles.cardImg, backgroundImage: `url(${event.images?.[0]})` }} />
                <div style={styles.cardContent}>
                  <div style={styles.cardHeader}>
                    <span style={styles.dateTagSmall}>{event.date}</span>
                    <Zap size={14} color="#e73c7e" />
                  </div>
                  <h3 style={styles.cardTitle}>{event.title}</h3>
                  <p style={styles.cardLocation}><MapPin size={14} /> {event.location}</p>
                  
                  <div style={styles.cardFooter}>
                    <span style={styles.priceTag}>GHS {event.price}</span>
                    <div style={styles.arrowCircle}><ArrowRight size={18} /></div>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
        
        {!loading && filtered.length === 0 && (
          <div style={styles.noResults}>
            <Ticket size={48} color="#ccc" />
            <p>No events found matching your search.</p>
          </div>
        )}
      </section>

      {/* --- ORGANIZER CTA --- */}
      <section style={styles.ctaBox}>
        <h2 style={styles.ctaTitle}>Hosting an event?</h2>
        <p style={styles.ctaText}>Join Accra's most exclusive network. Sell tickets and manage entries with ease.</p>
        <div style={styles.ctaBtns}>
          <a href="/login" style={styles.btnWhite}>CREATE EVENT</a>
          <a href="/login" style={styles.btnOutline}>ORGANIZER LOGIN</a>
        </div>
      </section>
    </div>
  );
}

// Styles remain unchanged
const styles = {
  pageWrapper: { maxWidth: '1200px', margin: '0 auto', padding: '0 20px 100px' },
  heroSection: { textAlign: 'center', padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  badge: { background: '#f1f5f9', padding: '8px 16px', borderRadius: '100px', fontSize: '11px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' },
  heroTitle: { fontSize: '80px', fontWeight: 950, margin: 0, letterSpacing: '-5px', lineHeight: 0.85 },
  searchContainer: { position: 'relative', width: '100%', maxWidth: '550px', marginTop: '40px' },
  searchIcon: { position: 'absolute', left: '25px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' },
  searchInput: { width: '100%', padding: '25px 30px 25px 65px', borderRadius: '30px', border: 'none', background: '#fff', fontSize: '16px', fontWeight: 600, boxShadow: '0 20px 40px rgba(0,0,0,0.06)', outline: 'none' },
  section: { marginTop: '60px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' },
  sectionTitle: { fontSize: '24px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 },
  countBadge: { background: '#000', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 },
  featuredCard: { position: 'relative', display: 'block', borderRadius: '40px', overflow: 'hidden', textDecoration: 'none', color: '#fff' },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' },
  featuredTitle: { fontSize: '42px', fontWeight: 900, margin: '10px 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' },
  card: { textDecoration: 'none', color: 'inherit', background: '#fff', borderRadius: '35px', padding: '15px', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' },
  cardImg: { width: '100%', height: '240px', borderRadius: '25px', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: '#f1f5f9' },
  cardContent: { padding: '15px 10px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  dateTagSmall: { fontSize: '11px', fontWeight: 900, color: '#e73c7e' },
  cardTitle: { fontSize: '22px', fontWeight: 900, margin: '0 0 5px 0', lineHeight: 1.2 },
  cardLocation: { fontSize: '14px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 },
  cardFooter: { marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  priceTag: { fontWeight: 900, fontSize: '18px' },
  arrowCircle: { background: '#000', color: '#fff', width: '40px', height: '40px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ctaBox: { marginTop: '100px', padding: '60px 20px', borderRadius: '50px', background: '#000', color: '#fff', textAlign: 'center' },
  ctaTitle: { fontSize: '36px', fontWeight: 900, marginBottom: '15px' },
  ctaText: { color: '#94a3b8', fontSize: '18px', maxWidth: '500px', margin: '0 auto 40px' },
  ctaBtns: { display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' },
  btnWhite: { background: '#fff', color: '#000', padding: '20px 40px', borderRadius: '20px', fontWeight: 900, textDecoration: 'none' },
  btnOutline: { border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '20px 40px', borderRadius: '20px', fontWeight: 900, textDecoration: 'none' },
  noResults: { padding: '100px 0', textAlign: 'center', color: '#94a3b8' }
};
