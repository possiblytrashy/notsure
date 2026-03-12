"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Outfit } from 'next/font/google';
import { ScanLine, LayoutDashboard, LogIn, Vote, Ticket, LogOut, Sparkles } from 'lucide-react';

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: 'OUSTED — Premium Event Ticketing in Accra',
  description: 'Buy tickets for the best events in Accra. Concerts, parties, galas and more. Secured by Paystack.',
};

export default function RootLayout({ children }) {
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
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#000000" />
        <meta name="robots" content="index, follow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <style>{`
          *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
          body{margin:0;-webkit-font-smoothing:antialiased}
          @keyframes mesh{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          .animate-spin{animation:spin 1s linear infinite}
          .bg-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;background:linear-gradient(-45deg,#fdf2f8,#eff6ff,#f0fdf4,#fefce8);background-size:400% 400%;animation:mesh 20s ease infinite}
          .glass{background:rgba(255,255,255,0.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.35)}
          .nav{position:fixed;top:14px;left:50%;transform:translateX(-50%);width:96%;max-width:1280px;border-radius:20px;padding:8px 18px;display:flex;justify-content:space-between;align-items:center;z-index:10000}
          .logo{text-decoration:none;color:#000;font-weight:950;font-size:21px;letter-spacing:-1.5px;flex-shrink:0;margin-right:16px}
          .nav-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex:1}
          .btn{text-decoration:none;color:#000;font-size:10px;font-weight:900;letter-spacing:.5px;display:flex;align-items:center;gap:5px;padding:9px 13px;border-radius:11px;transition:.2s;cursor:pointer;border:none;white-space:nowrap;font-family:inherit}
          .btn-outline{border:1.5px solid rgba(0,0,0,0.15);background:rgba(255,255,255,0.5)}
          .btn-solid{background:#000;color:#fff}
          .btn-vote{color:#fff;background:linear-gradient(135deg,#e73c7e,#c0196a);box-shadow:0 4px 15px rgba(231,60,126,0.35)}
          .btn-outline:hover{background:rgba(255,255,255,0.9);transform:translateY(-1px)}
          .btn-solid:hover{background:#222;transform:translateY(-1px)}
          .hide-mobile{display:flex}
          .footer{margin:80px auto 28px;width:96%;max-width:1280px;border-radius:36px;padding:55px 45px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px;color:#000;position:relative;z-index:1}
          .footer-brand h2{font-size:26px;font-weight:950;letter-spacing:-1.5px;margin:0 0 12px}
          .footer-brand p{font-size:13px;line-height:1.6;opacity:.6;max-width:280px;margin:0}
          .footer-col h4{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px;color:rgba(0,0,0,0.35)}
          .footer-link{display:flex;align-items:center;gap:8px;text-decoration:none;color:#000;font-size:14px;font-weight:600;margin-bottom:13px;transition:.2s}
          .footer-link:hover{opacity:.5;transform:translateX(4px)}
          .status-card{background:rgba(255,255,255,0.5);padding:18px;border-radius:18px;border:1px solid rgba(255,255,255,0.6)}
          .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px}
          @media(max-width:860px){.footer{grid-template-columns:1fr;text-align:center;padding:36px 22px}.footer-brand p{margin:8px auto}.footer-link{justify-content:center}}
          @media(max-width:640px){.nav{padding:7px 10px;width:94%;top:10px}.logo{font-size:18px;margin-right:8px}.hide-mobile{display:none!important}.btn{padding:8px 9px;gap:3px}.nav-actions{gap:5px}}
          ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px}
          ::selection{background:rgba(231,60,126,.15)}
          @media print{.bg-canvas,.nav,.footer{display:none!important}}
        `}</style>
      </head>
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="bg-canvas" />

        {/* NAV */}
        <nav className="nav glass">
          <a href="/" className="logo">OUSTED<span style={{ color: '#e73c7e' }}>.</span></a>
          <div className="nav-actions">
            <a href="/voting" className="btn btn-vote">
              <Vote size={14} />
              <span>VOTE</span>
            </a>
            {!loading && (user ? (
              <a href={dashLink} className="btn btn-outline">
                <LayoutDashboard size={14} />
                <span className="hide-mobile">{role === 'organizer' ? 'DASHBOARD' : 'MY TICKETS'}</span>
              </a>
            ) : (
              <a href="/login" className="btn btn-outline">
                <LogIn size={14} />
                <span className="hide-mobile">SIGN IN</span>
              </a>
            ))}
            <a href="/admin/scan" className="btn btn-solid">
              <ScanLine size={14} />
              <span className="hide-mobile">SCANNER</span>
            </a>
          </div>
        </nav>

        <main style={{ paddingTop: '90px', flex: 1 }}>
          {children}
        </main>

        {/* FOOTER */}
        <footer className="footer glass">
          <div className="footer-brand">
            <h2>OUSTED<span style={{ color: '#e73c7e' }}>.</span></h2>
            <p>Accra's premium event platform. Buy tickets, host events, run competitions — all secured by Paystack.</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {['Paystack Secured', 'SSL Encrypted', 'Instant Delivery'].map(t => (
                <span key={t} style={{ fontSize: '10px', fontWeight: 800, background: '#000', color: '#fff', padding: '4px 10px', borderRadius: '6px' }}>{t}</span>
              ))}
            </div>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <a href="/voting" className="footer-link"><Vote size={15} /> Voting Console</a>
            <a href="/" className="footer-link"><Ticket size={15} /> All Events</a>
            <a href="/login" className="footer-link"><Sparkles size={15} /> Host an Event</a>
            <a href="/tickets/find" className="footer-link"><ScanLine size={15} /> Find My Ticket</a>
          </div>
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
                      <LogOut size={13} /> SIGN OUT
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: 800, marginBottom: '12px', color: '#94a3b8' }}>
                      <span className="status-dot" style={{ background: '#e2e8f0' }} /> Guest Access
                    </div>
                    <a href="/login" className="btn btn-solid" style={{ width: '100%', justifyContent: 'center', borderRadius: '10px', padding: '10px', display: 'flex' }}>
                      <LogIn size={13} /> SIGN IN
                    </a>
                  </div>
                )
              )}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
