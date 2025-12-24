"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function EventPage() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);

  // Add this function inside your EventPage component in app/events/[id]/page.js
const handlePurchase = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return window.location.href = '/login';

  const ticketData = {
    event_id: id,
    user_id: user.id,
    qr_code: `TICKET-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  };

  const { error } = await supabase.from('tickets').insert([ticketData]);
  if (!error) window.location.href = '/dashboard/user';
  else alert("Purchase failed: " + error.message);
};

// Update your button to:
<button onClick={handlePurchase} style={{ /* existing styles */ }}>
  SECURE ACCESS
</button>

  useEffect(() => {
    async function get() {
      const { data } = await supabase.from('events').select('*').eq('id', id).single();
      setEvent(data);
    }
    if (id) get();
  }, [id]);

  if (!event) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ background: 'white', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }}>
        <img src={event.images?.[0]} style={{ width: '100%', height: '450px', objectFit: 'cover' }} />
        <div style={{ padding: '50px' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 900, margin: '0 0 20px 0' }}>{event.title}</h1>
          <div style={{ display: 'flex', gap: '30px', marginBottom: '30px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Price</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>GHS {event.price}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Date</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 900 }}>{event.date}</p>
            </div>
          </div>
          <p style={{ color: '#555', lineHeight: 1.6, fontSize: '18px', marginBottom: '40px' }}>{event.description || "Join us for an unforgettable experience in the heart of the city."}</p>
        
      // Update your button to:
<button onClick={handlePurchase} style={{ width: '100%', background: '#000', color: '#fff', border: 'none', padding: '25px', 
            borderRadius: '20px', fontWeight: 900, fontSize: '16px', letterSpacing: '2px', cursor: 'pointer'}}>
  SECURE ACCESS
</button>
        </div>
      </div>
    </div>
  );
}
