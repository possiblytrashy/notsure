"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    async function fetchEvents() {
      // Stripped down query to avoid "column not found" crashes
      const { data } = await supabase.from('events').select('*');
      setEvents(data || []);
    }
    fetchEvents();
  }, []);

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.4)',
    backdropFilter: 'blur(12px)',
    borderRadius: '32px',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    padding: '24px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
    transition: 'transform 0.3s ease',
    textDecoration: 'none',
    color: 'inherit'
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '60px' }}>
        <h1 style={{ fontSize: '4rem', fontWeight: 900, margin: 0 }}>LUMINA.</h1>
        <p style={{ opacity: 0.6 }}>Exclusive Accra Experiences</p>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '30px' 
      }}>
        {events.map(event => (
          <a key={event.id} href={`/events/${event.id}`} style={cardStyle}>
            <div style={{ 
              height: '200px', 
              borderRadius: '20px', 
              background: '#e2e8f0',
              backgroundImage: `url(${event.images?.[0]})`,
              backgroundSize: 'cover',
              marginBottom: '20px'
            }} />
            <h3 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px 0' }}>{event.title}</h3>
            <p style={{ color: '#0ea5e9', fontWeight: 900, fontSize: '20px' }}>GHS {event.price}</p>
            <div style={{ marginTop: '20px', padding: '12px', background: '#000', color: '#fff', textAlign: 'center', borderRadius: '14px', fontWeight: 'bold', fontSize: '14px' }}>
              GET TICKETS
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
