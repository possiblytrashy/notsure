"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, MapPin, Calendar, ArrowRight, Zap } from 'lucide-react';

export default function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('events').select('*').order('date', { ascending: true });
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

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
      
      {/* Hero Section */}
      <section style={{ textAlign: 'center', marginBottom: '80px' }}>
        <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', fontWeight: 900, letterSpacing: '-4px', margin: '0 0 20px 0', lineHeight: 1 }}>
          Accra <span style={{ color: '#0ea5e9' }}>unlocked.</span>
        </h1>
        <p style={{ fontSize: '18px', color: '#64748b', maxWidth: '600px', margin: '0 auto 40px' }}>
          Secure access to the city's most exclusive parties, galleries, and private events.
        </p>
        
        {/* Advanced Search Bar */}
        <div style={{ position: 'relative', maxWidth: '500px', margin: '0 auto' }}>
          <Search style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={20} />
          <input 
            type="text"
            placeholder="Search by event or venue..."
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '18px 20px 18px 55px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(10px)',
              fontSize: '16px',
              outline: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </section>

      {/* Events Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
        gap: '40px' 
      }}>
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height: '400px', borderRadius: '30px', background: 'rgba(255,255,255,0.3)', animate: 'pulse 2s infinite' }} />)
        ) : filtered.map(event => (
          <a key={event.id} href={`/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit', group: 'true' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(20px)',
              borderRadius: '32px',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              overflow: 'hidden',
              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Image Header */}
              <div style={{ height: '240px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ 
                  position: 'absolute', top: '15px', right: '15px', zIndex: 2,
                  background: 'rgba(34, 197, 94, 0.9)', color: '#fff', padding: '6px 12px', 
                  borderRadius: '100px', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <Zap size={10} fill="white" /> LIVE
                </div>
                <img 
                  src={event.images?.[0] || 'https://images.unsplash.com/photo-1514525253361-bee8a187449a?w=800'} 
                  style={{ width: '100%', height: '100%', objectCover: 'cover', transition: 'transform 0.5s' }}
                />
              </div>

              {/* Content */}
              <div style={{ padding: '28px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0ea5e9', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  <Calendar size={14} /> {new Date(event.date).toLocaleDateString()}
                </div>
                <h3 style={{ fontSize: '26px', fontWeight: 900, margin: '0 0 8px 0', color: '#0f172a' }}>{event.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                  <MapPin size={14} /> {event.location || "Venue TBD"}
                </div>
                
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Starting from</span>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a' }}>GHS {event.price}</div>
                  </div>
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '16px', background: '#0f172a', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' 
                  }}>
                    <ArrowRight size={20} />
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
