"use client"; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Outfit } from 'next/font/google';
import { 
  ScanLine, 
  LayoutDashboard, 
  LogIn, 
  Vote, 
  LogOut, 
  Ticket,
  ShieldCheck
} from 'lucide-react'; 

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Session Check
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getInitialSession();

    // 2. Auth Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/'; // Hard redirect to clear state
  };

  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        {/* Prevents mobile browser zoom on input focus (Luxury UX) */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        
        <style>{`
          /* --- GLOBAL ANIMATED BACKGROUND --- */
          @keyframes mesh {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          .background-canvas {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: -1;
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: mesh 15s ease infinite;
          }

          /* --- SHARED GLASSMORPHISM --- */
          .glass-panel {
            background: rgba(255, 255, 255, 0.72);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.35);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
          }

          /* --- NAVIGATION --- */
          .glass-nav {
            position: fixed;
            top: 20px; left: 50%; transform: translateX(-50%);
            width: 95%; maxWidth: 1200px;
            border-radius: 22px;
            padding: 10px 24px;
            display: flex; justifyContent: space-between; alignItems: center;
            z-index: 10000;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .nav-logo {
            text-decoration: none; color: #000; font-weight: 950; font-size: 22px;
            letter-spacing: -1.5px; display: flex; alignItems: center;
          }

          .nav-actions { display: flex; gap: 10px; alignItems: center; }

          /* --- BUTTONS --- */
          .btn-nav {
            text-decoration: none; color: #000; font-size: 11px; font-weight: 900;
            letter-spacing: 0.5px; display: flex; alignItems: center; gap: 8px;
            padding: 10px 16px; border-radius: 14px; transition: 0.2s;
            cursor: pointer; border: none;
          }

          .btn-outline { border: 2.5px solid #000; background: rgba(255,255,255,0.3); }
          .btn-solid { background: #000; color: #fff; }
          .btn-ghost { background: transparent; }

          /* --- FOOTER --- */
          .glass-footer {
            margin: 80px auto 30px;
            width: 95%; maxWidth: 1200px;
            border-radius: 35px;
            padding: 50px 40px;
            display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 40px;
          }

          .footer-col h4 { 
            font-size: 11px; font-weight: 800; text-transform: uppercase; 
            letter-spacing: 1.5px; margin-bottom: 25px; color: rgba(0,0,0,0.4); 
          }
          .footer-link { 
            display: block; text-decoration: none; color: #000; 
            font-size: 15px; font-weight: 600; margin-bottom: 15px; 
          }

          .user-status-card {
            background: rgba(255,255,255,0.5); padding: 15px; border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.5);
          }

          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

          /* --- MOBILE OPTIMIZATION (ANTI-SCRUNCH) --- */
          @media (max-width: 850px) {
            .glass-footer { grid-template-columns: 1fr; text-align: center; padding: 40px 20px; }
            .footer-link { justify-content: center; }
          }

          @media (max-width: 640px) {
            .glass-nav { padding: 8px 12px; top: 15px; width: 94%; }
            .nav-logo { font-size: 18px; }
            .btn-text { display: none; } /* Critical: Hide text to prevent scrunching */
            .btn-nav { padding: 12px; border-radius: 12px; }
            .nav-actions { gap: 6px; }
            .nav-actions a[href="/voting"] { color: #e73c7e; } /* Highlight Vote on Mobile */
          }
        `}</style>
        <script src="https://js.paystack.co/v1/inline.js" async></script>
      </head>
      
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Background Layer */}
        <div className="background-canvas"></div>

        {/* --- NAVBAR --- */}
        <nav className="glass-nav glass-panel">
          <a href="/" className="nav-logo">
            OUSTED<span style={{ color: '#e73c7e' }}>.</span>
          </a>
          
          <div className="nav-actions">
            {/* VOTE: Primary Action for users */}
            <a href="/voting" className="btn-nav btn-ghost">
              <Vote size={18} />
              <span className="btn-text">VOTE</span>
            </a>
            
            {!loading && (
              user ? (
                <a href="/dashboard/organizer" className="btn-nav btn-outline">
                  <LayoutDashboard size={18} />
                  <span className="btn-text">DASHBOARD</span>
                </a>
              ) : (
                <a href="/login" className="btn-nav btn-outline">
                  <LogIn size={18} />
                  <span className="btn-text">SIGN IN</span>
                </a>
              )
            )}

            <a href="/admin/scan" className="btn-nav btn-solid">
              <ScanLine size={18} />
              <span className="btn-text">SCANNER</span>
            </a>
          </div>
        </nav>

        {/* --- MAIN CONTENT --- */}
        <main style={{ paddingTop: '110px', flex: 1, position: 'relative', zIndex: 1 }}>
          {children}
        </main>

        {/* --- FOOTER --- */}
        <footer className="glass-footer glass-panel">
          <div className="footer-brand">
            <h2 style={{fontWeight: 900, letterSpacing: '-1.5px'}}>OUSTED<span style={{color: '#e73c7e'}}>.</span></h2>
            <p style={{fontSize: '14px', lineHeight: '1.6', opacity: 0.7}}>
              The ultimate luxury experience platform. Create, Manage, and Secure your high-end events with Paystack-integrated split payments.
            </p>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <a href="/voting" className="footer-link">Live Voting</a>
            <a href="/events" className="footer-link">Find Events</a>
            <a href="/dashboard/organizer/contests/create" className="footer-link">Create Contest</a>
          </div>

          <div className="footer-col">
            <h4>System Status</h4>
            {!loading && (
              <div className="user-status-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ 
                    width: '10px', height: '10px', borderRadius: '50%', 
                    backgroundColor: user ? '#10b981' : '#f59e0b',
                    boxShadow: user ? '0 0 10px #10b981' : 'none'
                  }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' }}>
                    {user ? 'Verified Session' : 'Guest Mode'}
                  </span>
                </div>
                
                {user ? (
                  <>
                    <p style={{ fontSize: '12px', margin: '0 0 15px 0', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Logged in as: <strong>{user.email}</strong>
                    </p>
                    <button onClick={handleLogout} className="btn-nav btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                      <LogOut size={14} /> SIGN OUT
                    </button>
                  </>
                ) : (
                  <a href="/login" className="btn-nav btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                    SIGN IN TO VOTE
                  </a>
                )}
              </div>
            )}
          </div>
        </footer>

      </body>
    </html>
  );
}
