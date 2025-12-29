"use client"; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Outfit } from 'next/font/google';
import { 
  ScanLine, 
  LayoutDashboard, 
  LogIn, 
  Vote, 
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

          .glass-nav {
            position: fixed;
            top: 20px; left: 50%; transform: translateX(-50%);
            width: 95%; maxWidth: 1200px;
            border-radius: 22px;
            padding: 8px 20px;
            display: flex; justifyContent: space-between; alignItems: center;
            z-index: 10000;
          }

          .nav-logo {
            text-decoration: none; color: #000; font-weight: 950; font-size: 22px;
            letter-spacing: -1.5px;
            min-width: 100px; /* Ensures space after logo */
          }

          .nav-actions { display: flex; gap: 8px; alignItems: center; }

          .btn-nav {
            text-decoration: none; color: #000; font-size: 10px; font-weight: 900;
            letter-spacing: 0.5px; display: flex; alignItems: center; gap: 6px;
            padding: 10px 14px; border-radius: 12px; transition: 0.2s;
            cursor: pointer; border: none;
          }

          .btn-outline { border: 2px solid #000; background: rgba(255,255,255,0.3); }
          .btn-solid { background: #000; color: #fff; }
          .btn-vote { color: #e73c7e; background: rgba(231, 60, 126, 0.1); }

          /* FOOTER STYLES */
          .glass-footer {
            margin: 80px auto 30px; width: 95%; maxWidth: 1200px;
            border-radius: 35px; padding: 40px;
            display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 40px;
          }
          .footer-link { display: block; text-decoration: none; color: #000; font-size: 15px; font-weight: 600; margin-bottom: 15px; }

          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

          /* --- MOBILE OPTIMIZATION --- */
          @media (max-width: 640px) {
            .glass-nav { padding: 8px 12px; width: 94%; top: 12px; }
            .nav-logo { font-size: 18px; min-width: 80px; }
            
            /* HIDE TEXT for Dashboard/Scanner to make room for VOTE */
            .hide-mobile-text { display: none; }
            
            /* KEEP VOTE TEXT visible but smaller */
            .vote-text { display: inline !important; font-size: 9px; }

            .btn-nav { padding: 8px 10px; gap: 4px; }
            .nav-actions { gap: 5px; }

            .glass-footer { grid-template-columns: 1fr; text-align: center; }
          }
        `}</style>
      </head>
      
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="background-canvas"></div>

        <nav className="glass-nav glass-panel">
          <a href="/" className="nav-logo">
            OUSTED<span style={{ color: '#e73c7e' }}>.</span>
          </a>
          
          <div className="nav-actions">
            {/* VOTE: Priority Action - Text stays visible on mobile */}
            <a href="/voting" className="btn-nav btn-vote">
              <Vote size={16} />
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

        <main style={{ paddingTop: '100px', flex: 1 }}>
          {children}
        </main>

        <footer className="glass-footer glass-panel">
          <div>
            <h2 style={{fontWeight: 900, letterSpacing: '-1.5px', margin: 0}}>OUSTED<span style={{color: '#e73c7e'}}>.</span></h2>
            <p style={{fontSize: '13px', opacity: 0.6}}>Premium Experience Platform.</p>
          </div>
          <div>
            <p style={{fontWeight: 800, fontSize: '12px', opacity: 0.4, textTransform: 'uppercase'}}>Quick Links</p>
            <a href="/voting" className="footer-link">Voting Console</a>
            <a href="/events" className="footer-link">All Events</a>
          </div>
          <div>
             <p style={{fontWeight: 800, fontSize: '12px', opacity: 0.4, textTransform: 'uppercase'}}>Account</p>
             {user ? (
               <button onClick={handleLogout} className="btn-nav btn-solid" style={{width: '100%', justifyContent: 'center'}}>LOGOUT</button>
             ) : (
               <a href="/login" className="btn-nav btn-solid" style={{width: '100%', justifyContent: 'center'}}>LOGIN</a>
             )}
          </div>
        </footer>
      </body>
    </html>
  );
}
