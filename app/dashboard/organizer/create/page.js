"use client";
import { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { Camera, MapPin, Calendar, DollarSign, ArrowLeft } from 'lucide-react';

export default function CreateEvent() {
  const [form, setForm] = useState({ title: '', price: '', date: '', location: '', image: '', description: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('events').insert([
      { ...form, organizer_id: user.id, images: [form.image] }
    ]);
    if (!error) window.location.href = '/dashboard/organizer';
    else alert(error.message);
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px' }}>
      <a href="/dashboard/organizer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#666', marginBottom: '30px', fontWeight: 700 }}>
        <ArrowLeft size={18} /> BACK TO DASHBOARD
      </a>
      
      <div style={{ background: 'white', padding: '40px', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontWeight: 900, fontSize: '32px', marginBottom: '40px' }}>Create New Experience</h1>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontWeight: 800, fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Event Title</label>
            <input required placeholder="e.g. Neon Jungle" style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', marginTop: '8px' }} 
              onChange={e => setForm({...form, title: e.target.value})} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ fontWeight: 800, fontSize: '12px', color: '#888' }}>PRICE (GHS)</label>
              <input type="number" required placeholder="150" style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', marginTop: '8px' }} 
                onChange={e => setForm({...form, price: e.target.value})} />
            </div>
            <div>
              <label style={{ fontWeight: 800, fontSize: '12px', color: '#888' }}>DATE</label>
              <input type="text" placeholder="DEC 31" style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', marginTop: '8px' }} 
                onChange={e => setForm({...form, date: e.target.value})} />
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 800, fontSize: '12px', color: '#888' }}>IMAGE URL</label>
            <input placeholder="https://..." style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #eee', marginTop: '8px' }} 
              onChange={e => setForm({...form, image: e.target.value})} />
          </div>

          <button type="submit" style={{ background: '#000', color: '#fff', padding: '20px', borderRadius: '20px', border: 'none', fontWeight: 900, fontSize: '16px', marginTop: '20px', cursor: 'pointer' }}>
            PUBLISH EVENT
          </button>
        </form>
      </div>
    </div>
  );
}
