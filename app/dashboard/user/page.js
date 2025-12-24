"use client";
import { QrCode, Heart, Clock } from 'lucide-react';

export default function UserDashboard() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontWeight: 900, fontSize: '36px', textAlign: 'center', marginBottom: '40px' }}>My Tickets</h1>
      
      {/* Mock Ticket Card */}
      <div style={{ background: 'white', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <div style={{ background: '#000', padding: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 800 }}>NEON JUNGLE</span>
          <span style={{ fontSize: '12px', opacity: 0.6 }}>DEC 28, 2024</span>
        </div>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ padding: '20px', border: '2px dashed #ddd', borderRadius: '20px', display: 'inline-block' }}>
            <QrCode size={180} />
          </div>
          <p style={{ marginTop: '20px', fontWeight: 800, fontSize: '18px' }}>TICKET ID: #8829-UX</p>
          <p style={{ color: '#888', fontSize: '14px' }}>Show this QR code at the entrance for verification.</p>
        </div>
      </div>
    </div>
  );
}
