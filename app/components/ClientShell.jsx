"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ScanLine, LayoutDashboard, LogIn, Vote, Ticket, LogOut, Sparkles } from 'lucide-react';

export default function ClientShell({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setRole(session.user.user_metadata?.role || 'user'); }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role || 'user');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/'; };
  const dashLink = role === 'organizer' ? '/dashboard/organizer' : role === 'admin' ? '/admin/dashboard' : '/dashboard/user';

  return (
    <>
      <nav className="nav glass" aria-label="Main navigation">
        <a href="/" className="logo" aria-label="OUSTED Home">OUSTED<span style={{ color: '#e73c7e' }}>.</span></a>
        <div className="nav-actions">
          <a href="/voting" className="btn btn-vote" aria-label="Vote for candidates">
            <Vote size={14} aria-hidden="true" />
            <span>VOTE</span>
          </a>
          {!loading && (user ? (
            <a href={dashLink} className="btn btn-outline" aria-label="Go to dashboard">
              <LayoutDashboard size={14} aria-hidden="true" />
              <span className="hide-mobile">{role === 'organizer' ? 'DASHBOARD' : 'MY TICKETS'}</span>
            </a>
          ) : (
            <a href="/login" className="btn btn-outline" aria-label="Sign in to your account">
              <LogIn size={14} aria-hidden="true" />
              <span className="hide-mobile">SIGN IN</span>
            </a>
          ))}
          <a href="/admin/scan" className="btn btn-solid" aria-label="Open gate scanner">
            <ScanLine size={14} aria-hidden="true" />
            <span className="hide-mobile">SCANNER</span>
          </a>
        </div>
      </nav>

      <main id="main-content" style={{ paddingTop: '90px', flex: 1 }}>
        {children}
      </main>

      <footer className="footer glass" aria-label="Site footer">
        <div className="footer-brand">
          <h2>OUSTED<span style={{ color: '#e73c7e' }}>.</span></h2>
          <p>Your premium event platform. Buy tickets, host events, run competitions — all secured by Paystack.</p>
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {['Paystack Secured', 'SSL Encrypted', 'Instant Delivery'].map(t => (
              <span key={t} style={{ fontSize: '10px', fontWeight: 800, background: '#000', color: '#fff', padding: '4px 10px', borderRadius: '6px' }}>{t}</span>
            ))}
          </div>
        </div>
        <nav className="footer-col" aria-label="Platform links">
          <h4>Platform</h4>
          <a href="/voting" className="footer-link"><Vote size={15} aria-hidden="true" /> Voting Console</a>
          <a href="/" className="footer-link"><Ticket size={15} aria-hidden="true" /> All Events</a>
          <a href="/login" className="footer-link"><Sparkles size={15} aria-hidden="true" /> Host an Event</a>
          <a href="/tickets/find" className="footer-link"><ScanLine size={15} aria-hidden="true" /> Find My Ticket</a>
          <div style={{ marginTop: '20px' }}>
            <h4>Legal</h4>
            <a href="/legal/terms" className="footer-link" style={{ fontSize: '12px', opacity: 0.7 }}>Terms & Conditions</a>
            <a href="/legal/privacy" className="footer-link" style={{ fontSize: '12px', opacity: 0.7 }}>Privacy Policy</a>
            <a href="/legal/user-agreement" className="footer-link" style={{ fontSize: '12px', opacity: 0.7 }}>User Agreement</a>
          </div>
        </nav>
        <div className="footer-col">
          <h4>Account</h4>
          <div className="status-card">
            {!loading && (
              user ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 800, marginBottom: '10px', color: '#16a34a' }}>
                    <span className="status-dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                    {role?.toUpperCase()} SESSION
                  </div>
                  <p style={{ fontSize: '11px', opacity: .55, margin: '0 0 12px', wordBreak: 'break-all' }}>{user.email}</p>
                  <button onClick={handleLogout} className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', borderRadius: '10px', padding: '10px' }}>
                    <LogOut size={13} aria-hidden="true" /> SIGN OUT
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 800, marginBottom: '12px', color: '#94a3b8' }}>
                    <span className="status-dot" style={{ background: '#e2e8f0' }} /> Guest Access
                  </div>
                  <a href="/login" className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', borderRadius: '10px', padding: '10px', display: 'flex' }}>
                    <LogIn size={13} aria-hidden="true" /> SIGN IN
                  </a>
                </div>
              )
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
