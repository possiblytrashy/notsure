"use client"; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Outfit } from 'next/font/google';
import { ScanLine, LayoutDashboard, LogIn, User, Vote, LogOut } from 'lucide-react'; 

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
    window.location.reload();
  };

  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        
        <style>{`
          /* --- BACKGROUND ANIMATION --- */
          @keyframes mesh {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          .background-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -1;
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: mesh 15s ease infinite;
          }

          /* --- GLASS COMPONENTS (NAV & FOOTER) --- */
          .glass-panel {
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
          }

          /* NAV SPECIFIC */
          .glass-nav {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 95%;
            max-width: 1200px;
            border-radius: 24px;
            padding: 12px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10000;
            transition: all 0.3s ease;
          }

          /* FOOTER SPECIFIC */
          .glass-footer {
            margin: 60px auto 20px; /* Space from content */
            width: 95%;
            max-width: 1200px;
            border-radius: 32px;
            padding: 40px;
            display: grid;
            grid-template-columns: 1.5fr 1fr 1fr;
            gap: 40px;
            color: #0f172a;
          }

          .footer-brand h2 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -1px; }
          .footer-brand p { font-size: 13px; opacity: 0.6; margin-top: 10px; line-height: 1.6; }

          .footer-col h4 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; opacity: 0.5; }
          .footer-link { display: block; text-decoration: none; color: #000; font-size: 14px; font-weight: 600; margin-bottom: 12px; transition: 0.2s; }
          .footer-link:hover { opacity: 0.6; transform: translateX(5px); }

          /* LOGIN INDICATION BADGE */
          .user-badge {
            background: rgba(0,0,0,0.05);
            padding: 12px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
          }
          .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
          .status-dot.offline { background: #f59e0b; }

          /* NAV ELEMENTS */
          .nav-logo { text-decoration: none; color: #000; font-weight: 900; font-size: 24px; letter-spacing: -1.5px; }
          .nav-actions { display: flex; gap: 12px; align-items: center; }
          .nav-link { text-decoration: none; color: #333; font-size: 12px; font-weight: 800; text-transform: uppercase; }

          .btn-outline {
            text-decoration: none; color: #000; border: 2px solid #000; padding: 10px 18px; border-radius: 14px;
            font-size: 11px; font-weight: 900; letter-spacing: 0.5px; background: rgba(255,255,255,0.4);
            display: flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer;
          }
          .btn-solid {
            text-decoration: none; color: #fff; background: #000; padding: 10px 20px; border-radius: 14px;
            font-size: 11px; font-weight: 900; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; white-space: nowrap;
          }

          * { box-sizing: border-box; }

          /* --- MOBILE OPTIMIZATION --- */
          @media (max-width: 768px) {
            .glass-footer {
              grid-template-columns: 1fr; /* Stack columns */
              padding: 30px 24px;
              text-align: center;
              gap: 30px;
              margin-bottom: 100px; /* Space for sticky buttons if any */
            }
            .user-badge { justify-content: center; }
            .footer-link:hover { transform: none; }
          }

          @media (max-width: 640px) {
            .glass-nav { padding: 10px 16px; top: 15px; width: 92%; }
            .nav-logo { font-size: 20px; }
            .btn-text, .nav-link { display: none; } /* Hide text, show icons */
            .btn-outline, .btn-solid { padding: 10px; border-radius: 12px; }
          }
        `}</style>
        <script src="https://js.paystack.co/v1/inline.js"></script>
      </head>
      
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        <div className="background-canvas"></div>

        {/* --- NAVBAR --- */}
        <nav className="glass-nav glass-panel">
          <a href="/" className="nav-logo">OUSTED<span style={{ color: '#e73c7e' }}>.</span></a>
          
          <div className="nav-actions">
            <a href="/voting" className="nav-link">Voting</a>
            
            {!loading && (
              user ? (
                <a href="/dashboard/organizer" className="btn-outline">
                  <LayoutDashboard size={14} />
                  <span className="btn-text">DASHBOARD</span>
                </a>
              ) : (
                <a href="/login" className="btn-outline">
                  <LogIn size={14} />
                  <span className="btn-text">SIGN IN</span>
                </a>
              )
            )}

            <a href="/admin/scan" className="btn-solid">
              <ScanLine size={14} />
              <span className="btn-text">SCANNER</span>
            </a>
          </div>
        </nav>

        {/* --- MAIN CONTENT --- */}
        <main style={{ paddingTop: '110px', flex: 1 }}>{children}</main>

        {/* --- NEW GLASS FOOTER --- */}
        <footer className="glass-footer glass-panel">
          
          {/* Col 1: Brand */}
          <div className="footer-brand">
            <h2>OUSTED.</h2>
            <p>The premium experience platform.<br/>Next generation ticketing & voting.</p>
          </div>

          {/* Col 2: Navigation */}
          <div className="footer-col">
            <h4>Platform</h4>
            <a href="/events" className="footer-link">Browse Events</a>
            <a href="/voting" className="footer-link" style={{display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center'}}>
               <Vote size={14} /> Voting Console
            </a>
            <a href="/help" className="footer-link">Support</a>
          </div>

          {/* Col 3: User Status / Login Indication */}
          <div className="footer-col">
            <h4>Account Status</h4>
            {!loading && (
              user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="user-badge">
                    <span className="status-dot"></span>
                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                      {user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button onClick={handleLogout} className="btn-outline" style={{width: '100%', justifyContent: 'center'}}>
                    <LogOut size={14} /> <span className="btn-text">SIGN OUT</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="user-badge">
                    <span className="status-dot offline"></span>
                    <span>Guest Access</span>
                  </div>
                  <a href="/login" className="btn-solid" style={{width: '100%', justifyContent: 'center'}}>
                     LOGIN TO VOTE
                  </a>
                </div>
              )
            )}
          </div>
        </footer>

      </body>
    </html>
  );
}
