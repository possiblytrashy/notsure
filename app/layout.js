"use client"; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Outfit } from 'next/font/google';
import { 
  ScanLine, 
  LayoutDashboard, 
  LogIn, 
  Vote, 
  Ticket,
  LogOut
} from 'lucide-react'; 

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <style>{`
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

          .glass-panel {
            background: rgba(255, 255, 255, 0.72);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.35);
          }

          /* --- NAV STYLES --- */
          .glass-nav {
            position: fixed;
            top: 20px; left: 50%; transform: translateX(-50%);
            width: 95%; maxWidth: 1200px;
            border-radius: 22px;
            padding: 8px 20px;
            display: flex; 
            justify-content: space-between;
            align-items: center;
            z-index: 10000;
          }

          .nav-logo {
            text-decoration: none; color: #000; font-weight: 950; font-size: 22px;
            letter-spacing: -1.5px;
            flex-shrink: 0;
            margin-right: 20px;
          }

          .nav-actions { 
            display: flex; 
            gap: 10px; 
            align-items: center;
            justify-content: flex-end;
            flex: 1;
          }

          .btn-nav {
            text-decoration: none; color: #000; font-size: 10px; font-weight: 900;
            letter-spacing: 0.5px; display: flex; alignItems: center; gap: 6px;
            padding: 10px 14px; border-radius: 12px; transition: 0.2s;
            cursor: pointer; border: none;
            white-space: nowrap;
          }

          .btn-outline { border: 2px solid #000; background: rgba(255,255,255,0.3); }
          .btn-solid { background: #000; color: #fff; }
          .btn-vote { color: #fff; background: #e73c7e; box-shadow: 0 4px 12px rgba(231, 60, 126, 0.3); }

          /* --- FOOTER STYLES --- */
          .glass-footer {
            margin: 80px auto 30px;
            width: 95%;
            max-width: 1200px;
            border-radius: 35px;
            padding: 60px 40px;
            display: grid;
            grid-template-columns: 1.5fr 1fr 1fr;
            gap: 40px;
            color: #000;
            position: relative;
            z-index: 1;
          }

          .footer-brand h2 { font-size: 28px; font-weight: 950; letter-spacing: -1.5px; margin: 0 0 15px 0; }
          .footer-brand p { font-size: 14px; line-height: 1.6; opacity: 0.7; max-width: 300px; }
          .footer-col h4 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 25px; color: rgba(0,0,0,0.4); }
          
          .footer-link {
            display: flex; align-items: center; gap: 8px; text-decoration: none;
            color: #000; font-size: 15px; font-weight: 600; margin-bottom: 15px; transition: 0.2s;
          }
          .footer-link:hover { opacity: 0.5; transform: translateX(5px); }

          .user-status-card {
            background: rgba(255, 255, 255, 0.4); padding: 20px;
            border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.5);
          }

          .status-indicator { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-bottom: 12px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; }

          /* --- MOBILE OPTIMIZATION --- */
          @media (max-width: 850px) {
            .glass-footer { grid-template-columns: 1fr; text-align: center; padding: 40px 24px; }
            .footer-brand p { margin: 10px auto; }
            .footer-link { justify-content: center; }
          }

          @media (max-width: 640px) {
            .glass-nav { padding: 8px 12px; width: 94%; top: 12px; }
            .nav-logo { font-size: 19px; margin-right: 10px; }
            .hide-mobile-text { display: none; }
            .vote-text { display: inline !important; font-size: 10px; }
            .btn-nav { padding: 8px 10px; gap: 4px; }
            .nav-actions { gap: 6px; }
          }
          
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        `}</style>
      </head>
      
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="background-canvas"></div>

        {/* NAVIGATION */}
        <nav className="glass-nav glass-panel">
          <a href="/" className="nav-logo">
            OUSTED<span style={{ color: '#e73c7e' }}>.</span>
          </a>
          
          <div className="nav-actions">
            <a href="/voting" className="btn-nav btn-vote">
              <Vote size={15} />
              <span className="vote-text">VOTE</span>
            </a>
            
            {!loading && (
              user ? (
                <a href="/dashboard/organizer" className="btn-nav btn-outline">
                  <LayoutDashboard size={16} />
                  <span className="hide-mobile-text">DASHBOARD</span>
                </a>
              ) : (
                <a href="/login" className="btn-nav btn-outline">
                  <LogIn size={16} />
                  <span className="hide-mobile-text">SIGN IN</span>
                </a>
              )
            )}

            <a href="/admin/scan" className="btn-nav btn-solid">
              <ScanLine size={16} />
              <span className="hide-mobile-text">SCANNER</span>
            </a>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main style={{ paddingTop: '100px', flex: 1 }}>
          {children}
        </main>
        
        {/* FOOTER */}
        <footer className="glass-footer glass-panel">
          <div className="footer-brand">
            <h2>OUSTED<span style={{ color: '#e73c7e' }}>.</span></h2>
            <p>
              The premium choice for event organizers and voters. 
              Secure, transparent, and built for luxury experiences.
            </p>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <a href="/voting" className="footer-link"><Vote size={16} /> Voting Console</a>
            <a href="/events" className="footer-link"><Ticket size={16} /> All Events</a>
            <a href="/dashboard/organizer/contests/create" className="footer-link">Host a Contest</a>
          </div>

          <div className="footer-col">
            <h4>Account Status</h4>
            <div className="user-status-card">
              {!loading && (
                <>
                  <div className="status-indicator">
                    <div className="dot" style={{ 
                      background: user ? '#10b981' : '#f59e0b', 
                      boxShadow: user ? '0 0 12px #10b981' : 'none' 
                    }}></div>
                    {user ? 'Verified Session' : 'Guest Access'}
                  </div>
                  
                  {user ? (
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '12px', opacity: 0.6, margin: '0 0 15px 0', wordBreak: 'break-all' }}>
                        {user.email}
                      </p>
                      <button onClick={handleLogout} className="btn-nav btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                        <LogOut size={14} /> SIGN OUT
                      </button>
                    </div>
                  ) : (
                    <a href="/login" className="btn-nav btn-solid" style={{ width: '100%', justifyContent: 'center' }}>
                      LOGIN TO VOTE
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
