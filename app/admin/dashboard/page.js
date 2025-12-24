"use client";
import { ShieldAlert, Database, Globe } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontWeight: 900, fontSize: '36px', marginBottom: '30px' }}>Staff Control Panel</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        <div style={{ background: 'rgba(0,0,0,0.8)', color: 'white', padding: '40px', borderRadius: '35px' }}>
          <h2 style={{ fontWeight: 900 }}>System Health</h2>
          <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '20px' }}>
              <Database size={24} color="#0ea5e9"/>
              <p>Supabase: Online</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', padding: '20px', borderRadius: '20px' }}>
              <ShieldAlert size={24} color="#e73c7e"/>
              <p>Auth: Secured</p>
            </div>
          </div>
        </div>
        <div style={{ background: 'white', padding: '30px', borderRadius: '35px' }}>
           <h3 style={{ fontWeight: 900 }}>Quick Actions</h3>
           <a href="/admin/scan" style={{ display: 'block', padding: '15px', background: '#f5f5f5', borderRadius: '15px', textDecoration: 'none', color: '#000', fontWeight: 700, marginBottom: '10px' }}>Launch Ticket Scanner</a>
           <button style={{ width: '100%', padding: '15px', background: '#f5f5f5', borderRadius: '15px', border: 'none', textAlign: 'left', fontWeight: 700 }}>Export Sales Data</button>
        </div>
      </div>
    </div>
  );
}
