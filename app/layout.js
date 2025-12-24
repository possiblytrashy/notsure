"use client"; // Required because we are using state and effects
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Ensure this path is correct
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check current session status
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    getInitialSession();

    // 2. Listen for auth changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <html lang="en" style={{ scrollBehavior: 'smooth' }}>
      <head>
        <style>{`
          @keyframes mesh {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .mesh-bg {
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: mesh 15s ease infinite;
            background-attachment: fixed;
          }
          .glass-nav {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(20px) saturate(160%);
            -webkit-backdrop-filter: blur(20px) saturate(160%);
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          * { box-sizing: border-box; }
        `}</style>
      </head>
      <body className={`${outfit.className} mesh-bg`} style={{ margin: 0, minHeight: '100vh' }}>
        
        <nav className="glass-nav" style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          width: '95%', maxWidth: '1200px', borderRadius: '24px', padding: '12px 30px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10000,
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)'
        }}>
          <a href="/" style={{ textDecoration: 'none', color: '#000', fontWeight: 900, fontSize: '24px', letterSpacing: '-1.5px' }}>
            OUSTED<span style={{ color: '#e73c7e' }}>.</span>
          </a>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <a href="/voting" style={{ textDecoration: 'none', color: '#333', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginRight: '10px' }}>Voting</a>
            
            {/* DYNAMIC TOGGLE BUTTON */}
            {!loading && (
              user ? (
                <a href="/dashboard/organizer" style={{ 
                  textDecoration: 'none', color: '#000', border: '2px solid #000', padding: '8px 18px', 
                  borderRadius: '14px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.5px',
                  background: 'rgba(255,255,255,0.4)'
                }}>DASHBOARD</a>
              ) : (
                <a href="/login" style={{ 
                  textDecoration: 'none', color: '#000', border: '2px solid #000', padding: '8px 18px', 
                  borderRadius: '14px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.5px' 
                }}>SIGN IN</a>
              )
            )}

            <a href="/admin/scan" style={{ 
              textDecoration: 'none', color: '#fff', background: '#000', padding: '10px 20px', 
              borderRadius: '15px', fontSize: '11px', fontWeight: 900, letterSpacing: '1px' 
            }}>SCANNER</a>
          </div>
        </nav>

        <main style={{ paddingTop: '110px' }}>{children}</main>
      </body>
    </html>
  );
}
