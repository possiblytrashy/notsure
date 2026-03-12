"use client";
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles, Zap, TrendingUp } from 'lucide-react';

export default function Auth() {
  const [isSignup, setIsSignup] = useState(false);
  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setError('');
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { data, error: authError } = isSignup
        ? await supabase.auth.signUp({ email, password, options: { data: { role, full_name: name } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(authError.message); return; }
      if (data.user) {
        const userRole = data.user.user_metadata?.role || 'user';
        const dest = userRole === 'organizer' ? '/dashboard/organizer' : userRole === 'admin' ? '/admin/dashboard' : '/dashboard/user';
        window.location.href = dest;
      }
    } catch { setError('System error. Please try again.'); }
    finally { setLoading(false); }
  };

  const benefits = role === 'organizer'
    ? [{ icon: TrendingUp, text: 'Keep 95% of every ticket sold' }, { icon: Zap, text: 'Multi-tier ticketing & reseller network' }, { icon: ShieldCheck, text: 'Paystack-secured instant payouts' }]
    : [{ icon: Zap, text: 'Instant digital ticket delivery' }, { icon: ShieldCheck, text: 'Bank-grade payment security' }, { icon: Sparkles, text: 'Early access to exclusive events' }];

  return (
    <div style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center', minHeight: 'calc(100vh - 200px)' }}>
      <style>{`@media(max-width:768px){.auth-grid{grid-template-columns:1fr!important}.auth-info{display:none!important}}`}</style>

      {/* INFO PANEL */}
      <div className="auth-info" style={{ padding: '40px', background: '#000', borderRadius: '36px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '500px' }}>
        <div style={{ marginBottom: '10px' }}><Sparkles size={32} color="#e73c7e" /></div>
        <h2 style={{ fontSize: '38px', fontWeight: 950, letterSpacing: '-2px', margin: '15px 0 20px', lineHeight: 0.9 }}>
          {isSignup ? (role === 'organizer' ? 'Start selling tickets today.' : 'Your pass to Accra\'s best events.') : 'Welcome back.'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 35px' }}>
          {role === 'organizer' ? 'Join the organizers running the most exclusive events in Ghana.' : 'Access all your tickets, voting power, and exclusive events in one place.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {benefits.map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} color="#fff" /></div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AUTH FORM */}
      <div className="auth-grid" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderRadius: '36px', padding: '44px', border: '1px solid rgba(255,255,255,0.6)' }}>
        <h2 style={{ fontWeight: 950, fontSize: '28px', textAlign: 'center', margin: '0 0 8px', letterSpacing: '-1px' }}>{isSignup ? 'Create Account' : 'Sign In'}</h2>
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', fontWeight: 600, margin: '0 0 28px' }}>{isSignup ? 'Join thousands of event-goers in Accra' : 'Access your tickets and dashboard'}</p>

        {/* ROLE SELECTOR */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '16px', padding: '5px', marginBottom: '22px' }}>
          {['user', 'organizer'].map(r => (
            <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '11px', cursor: 'pointer', background: role === r ? '#fff' : 'transparent', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', transition: 'all 0.2s', boxShadow: role === r ? '0 2px 8px rgba(0,0,0,0.08)' : 'none', color: role === r ? '#000' : '#94a3b8', fontFamily: 'inherit' }}>
              {r === 'user' ? '🎟 Ticket Buyer' : '🎤 Organizer'}
            </button>
          ))}
        </div>

        {isSignup && (
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
            <User size={17} color="#94a3b8" />
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }} />
          </div>
        )}
        <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', border: '1px solid #f1f5f9' }}>
          <Mail size={17} color="#94a3b8" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }} />
        </div>
        <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: error ? '12px' : '22px', border: '1px solid #f1f5f9' }}>
          <Lock size={17} color="#94a3b8" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key === 'Enter' && handleAuth()} style={{ background: 'none', border: 'none', outline: 'none', flex: 1, fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }} />
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: '#dc2626', marginBottom: '16px' }}>{error}</div>}

        <button onClick={handleAuth} disabled={loading} style={{ width: '100%', background: loading ? '#94a3b8' : '#000', color: '#fff', border: 'none', padding: '18px', borderRadius: '16px', fontWeight: 900, fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'inherit', transition: 'all 0.2s' }}>
          {loading ? 'PROCESSING...' : <>{isSignup ? 'CREATE ACCOUNT' : 'SIGN IN'} <ArrowRight size={17} /></>}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '18px', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
          <ShieldCheck size={13} /> Secured by Supabase Auth · 256-bit SSL
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span onClick={() => { setIsSignup(!isSignup); setError(''); }} style={{ color: '#000', fontWeight: 900, cursor: 'pointer', textDecoration: 'underline' }}>
            {isSignup ? 'Sign in' : 'Create one'}
          </span>
        </p>
      </div>
    </div>
  );
}
