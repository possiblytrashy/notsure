"use client"; 

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; 
import { Outfit } from 'next/font/google';
import { ScanLine, LayoutDashboard, LogIn } from 'lucide-react'; // Icons for mobile mode

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

  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        {/* Crucial for Mobile: Prevents auto-zoom on inputs */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        
        <style>{`
          /* --- ANIMATED BACKGROUND --- */
          @keyframes mesh {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          /* Fixed container for background - Solves iOS jitter bugs */
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

          /* --- GLASS NAVIGATION --- */
          .glass-nav {
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.3);
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
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            transition: all 0.3s ease;
          }

          .nav-logo {
            text-decoration: none;
            color: #000;
            font-weight: 900;
            font-size: 24px;
            letter-spacing: -1.5px;
          }

          .nav-actions {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .nav-link {
            text-decoration: none;
            color: #333;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
          }

          /* BUTTON STYLES */
          .btn-outline {
            text-decoration: none;
            color: #000;
            border: 2px solid #000;
            padding: 10px 18px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.5px;
            background: rgba(255,255,255,0.4);
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          }

          .btn-solid {
            text-decoration: none;
            color: #fff;
            background: #000;
            padding: 10px 20px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 1px;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
          }

          * { box-sizing: border-box; }

          /* --- MOBILE OPTIMIZATION --- */
          @media (max-width: 640px) {
            .glass-nav {
              padding: 10px 16px; /* Reduce padding to save space */
              top: 15px;
              width: 92%;
            }

            .nav-logo {
              font-size: 20px; /* Slightly smaller logo */
            }

            /* Hide text labels on mobile, show only Icons */
            .btn-text {
              display: none;
            }
            
            .nav-link {
              display: none; /* Hide 'Voting' link on very small screens if crowded */
            }

            .btn-outline, .btn-solid {
              padding: 10px; /* Square buttons */
              border-radius: 12px;
            }
          }
        `}</style>
        <script src="https://js.paystack.co/v1/inline.js"></script>
      </head>
      
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh' }}>
        
        {/* Fixed Background Layer */}
        <div className="background-canvas"></div>

        <nav className="glass-nav">
          <a href="/" className="nav-logo">
            OUSTED<span style={{ color: '#e73c7e' }}>.</span>
          </a>
          
          <div className="nav-actions">
            {/* Hidden on mobile to save space */}
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

        <main style={{ paddingTop: '110px' }}>{children}</main>
      </body>
    </html>
  );
}
