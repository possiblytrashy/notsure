"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, MapPin, Calendar, ArrowRight, Zap } from 'lucide-react';

const Skeleton = () => (
  <div style={{ 
    background: 'rgba(255,255,255,0.3)', 
    borderRadius: '35px', 
    padding: '20px', 
    height: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  }}>
    <div className="skeleton-pulse" style={{ height: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '25px' }} />
    <div className="skeleton-pulse" style={{ height: '30px', width: '70%', background: 'rgba(0,0,0,0.05)', borderRadius: '10px' }} />
    <div className="skeleton-pulse" style={{ height: '20px', width: '40%', background: 'rgba(0,0,0,0.05)', borderRadius: '10px' }} />
    <div style={{ marginTop: 'auto', height: '50px', background: 'rgba(0,0,0,0.05)', borderRadius: '15px' }} className="skeleton-pulse" />
  </div>
);

export default function Home() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      {/* HERO SECTION */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '70px', fontWeight: 900, margin: 0, letterSpacing: '-4px', lineHeight: 0.9 }}>
          Experience <br/><span style={{ color: 'rgba(0,0,0,0.4)' }}>Everything.</span>
        </h1>
        <div style={{ position: 'relative', maxWidth: '500px', margin: '40px auto' }}>
          <Search size={20} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
          <input 
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Accra's best events..." 
            style={{ width: '100%', padding: '20px 60px', borderRadius: '25px', border: 'none', outline: 'none', background: 'white', fontSize: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}
          />
        </div>
      </div>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
  {loading ? (
    <>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </>
  ) : (
    filtered.map(event => (
       <a key={event.id} href={`/events/${event.id}`}>
          {/* ... existing event card content */}
       </a>
    ))
  )}
</div>
      {/* EVENTS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
        {filtered.map(event => (
          <a key={event.id} href={`/events/${event.id}`} style={{ 
            textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,0.4)', 
            backdropFilter: 'blur(10px)', borderRadius: '35px', padding: '20px', border: '1px solid rgba(255,255,255,0.5)',
            display: 'flex', flexDirection: 'column', transition: '0.3s'
          }}>
            <div style={{ height: '250px', borderRadius: '25px', background: '#ccc', backgroundImage: `url(${event.images?.[0]})`, backgroundSize: 'cover', backgroundPosition: 'center', marginBottom: '20px' }} />
            <div style={{ padding: '0 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#e73c7e', textTransform: 'uppercase' }}>{event.date}</span>
                <Zap size={14} fill="#e73c7e" color="#e73c7e" />
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 10px 0' }}>{event.title}</h3>
              <p style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#666', fontSize: '14px', margin: '0 0 20px 0' }}>
                <MapPin size={14} /> {event.location}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '20px' }}>
                <span style={{ fontWeight: 900, fontSize: '20px' }}>GHS {event.price}</span>
                <div style={{ background: '#000', color: '#fff', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ORGANIZER CALL TO ACTION */}
      <section style={{ 
        marginTop: '100px', padding: '60px', borderRadius: '40px', 
        background: '#000', color: '#fff', textAlign: 'center' 
      }}>
        <h2 style={{ fontSize: '40px', fontWeight: 900, marginBottom: '20px' }}>Hosting an event?</h2>
        <p style={{ color: '#ccc', maxWidth: '600px', margin: '0 auto 30px', fontSize: '18px' }}>
          Join the most exclusive network in Accra. Sell tickets and manage entries with OUSTED.
        </p>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ 
            background: '#fff', color: '#000', padding: '18px 35px', borderRadius: '20px', 
            textDecoration: 'none', fontWeight: 900, fontSize: '14px' 
          }}>BECOME AN ORGANIZER</a>
          <a href="/login" style={{ 
            background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '18px 35px', 
            borderRadius: '20px', textDecoration: 'none', fontWeight: 900, fontSize: '14px',
            border: '1px solid rgba(255,255,255,0.2)' 
          }}>USER DASHBOARD</a>
        </div>
      </section>
    </div>
  );
}
