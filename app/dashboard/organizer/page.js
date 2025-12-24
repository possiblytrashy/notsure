"use client";
import { useState, useEffect } from 'react';
import { Plus, BarChart3, Users, Ticket, Calendar, MapPin, Edit3 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export default function OrganizerDashboard() {
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMyEvents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('organizer_id', user.id)
          .order('created_at', { ascending: false });
        setMyEvents(data || []);
      }
      setLoading(false);
    }
    fetchMyEvents();
  }, []);

  const stats = [
    { label: 'Tickets Sold', val: '0', icon: <Ticket color="#e73c7e"/> },
    { label: 'Revenue', val: 'GHS 0.00', icon: <BarChart3 color="#0ea5e9"/> },
    { label: 'Active Events', val: myEvents.length.toString(), icon: <Calendar color="#22c55e"/> }
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 10 }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '36px', margin: 0 }}>Organizer Hub</h1>
        
        {/* THE FIXED BUTTON */}
        <a href="/dashboard/organizer/create" style={{ 
          background: '#000', 
          color: '#fff', 
          padding: '15px 25px', 
          borderRadius: '18px', 
          textDecoration: 'none', 
          fontWeight: 800, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}>
          <Plus size={20} /> CREATE EVENT
        </a>
      </div>

      {/* STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '50px' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ padding: '30px', background: 'white', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.5)' }}>
            {s.icon}
            <p style={{ margin: '15px 0 5px', color: '#888', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>{s.label}</p>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{s.val}</h2>
          </div>
        ))}
      </div>

      {/* MY EVENTS LIST */}
      <div style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '40px', borderRadius: '40px', border: '1px solid white' }}>
        <h3 style={{ fontWeight: 900, fontSize: '22px', marginBottom: '25px' }}>Your Live Events</h3>
        
        {loading ? (
          <div className="skeleton-pulse" style={{ height: '100px', borderRadius: '20px' }} />
        ) : myEvents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {myEvents.map(event => (
              <div key={event.id} style={{ 
                background: 'white', padding: '20px', borderRadius: '22px', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '14px', background: '#eee', backgroundImage: `url(${event.images?.[0]})`, backgroundSize: 'cover' }} />
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800 }}>{event.title}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#888' }}><MapPin size={12} /> {event.location} • {event.date}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                   <div style={{ background: '#f5f5f5', padding: '10px 15px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>GHS {event.price}</div>
                   <button style={{ background: 'none', border: '1px solid #eee', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}><Edit3 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
             <p style={{ color: '#666', marginBottom: '20px' }}>You haven't created any events yet.</p>
             <a href="/dashboard/organizer/create" style={{ color: '#0ea5e9', fontWeight: 800, textDecoration: 'none' }}>Launch your first event →</a>
          </div>
        )}
      </div>
    </div>
  );
}
