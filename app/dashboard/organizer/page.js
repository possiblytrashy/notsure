"use client";
import { Plus, BarChart3, Users, Ticket } from 'lucide-react';

export default function OrganizerDashboard() {
  const stats = [
    { label: 'Tickets Sold', val: '1,284', icon: <Ticket color="#e73c7e"/> },
    { label: 'Revenue', val: 'GHS 45,000', icon: <BarChart3 color="#0ea5e9"/> },
    { label: 'Attendees', val: '890', icon: <Users color="#22c55e"/> }
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontWeight: 900, fontSize: '36px' }}>Organizer Hub</h1>
        <button style={{ background: '#000', color: '#fff', padding: '12px 24px', borderRadius: '15px', border: 'none', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> CREATE EVENT
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '40px' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ padding: '30px', background: 'white', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
            {s.icon}
            <p style={{ margin: '10px 0 5px', color: '#888', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase' }}>{s.label}</p>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900 }}>{s.val}</h2>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.5)', padding: '30px', borderRadius: '30px', border: '1px solid white' }}>
        <h3 style={{ fontWeight: 900, marginBottom: '20px' }}>Your Active Events</h3>
        <p style={{ color: '#666' }}>No active events found. Click "Create Event" to start.</p>
      </div>
    </div>
  );
}
