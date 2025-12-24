"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, User, Briefcase, ShieldCheck } from 'lucide-react';

export default function UnifiedLogin() {
  const [role, setRole] = useState('user'); // user, organizer, admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else window.location.href = role === 'admin' ? '/admin/dashboard' : role === 'organizer' ? '/dashboard/organizer' : '/dashboard/user';
  };

  const portalStyles = {
    user: { color: '#0ea5e9', label: 'Party Attendee' },
    organizer: { color: '#e73c7e', label: 'Event Host' },
    admin: { color: '#000', label: 'System Staff' }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '60px auto', padding: '40px', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', borderRadius: '40px', border: '1px solid white', textAlign: 'center' }}>
      <h2 style={{ fontWeight: 900, fontSize: '32px', marginBottom: '10px' }}>Welcome Back</h2>
      <p style={{ color: '#666', marginBottom: '30px' }}>Access your {portalStyles[role].label} portal</p>

      {/* Role Switcher */}
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '15px', padding: '5px', marginBottom: '30px' }}>
        {['user', 'organizer', 'admin'].map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{
            flex: 1, padding: '10px', border: 'none', borderRadius: '10px', cursor: 'pointer',
            background: role === r ? 'white' : 'transparent', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase',
            transition: '0.3s', boxShadow: role === r ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'
          }}>{r}</button>
        ))}
      </div>

      <input type="email" placeholder="Email Address" onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '15px', outline: 'none' }} />
      <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '25px', outline: 'none' }} />
      
      <button onClick={handleLogin} style={{ width: '100%', padding: '18px', borderRadius: '15px', border: 'none', background: portalStyles[role].color, color: 'white', fontWeight: 900, cursor: 'pointer' }}>
        ENTER {role.toUpperCase()} PORTAL
      </button>
    </div>
  );
}
