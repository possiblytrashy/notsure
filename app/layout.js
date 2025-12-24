import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
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
            background: linear-gradient(-45deg, #f0f9ff, #e0f2fe, #fbcfe8, #e0e7ff);
            background-size: 400% 400%;
            animation: mesh 15s ease infinite;
          }
          button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
          button:active { transform: translateY(0); }
        `}</style>
      </head>
      <body className={`${outfit.className} mesh-bg`} style={{ margin: 0, minHeight: '100vh' }}>
        {/* Advanced Floating Navbar */}
        <nav style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '1100px',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '24px',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
        }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: '#0ea5e9', borderRadius: '8px' }}></div>
            <span style={{ fontWeight: 900, fontSize: '22px', letterSpacing: '-1.5px', color: '#0f172a' }}>LUMINA</span>
          </a>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
            <a href="/voting" style={{ textDecoration: 'none', color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Voting</a>
            <a href="/verify" style={{ textDecoration: 'none', color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Verify</a>
            <a href="/admin/scan" style={{ 
              textDecoration: 'none', 
              color: '#fff', 
              background: '#0f172a', 
              padding: '10px 20px', 
              borderRadius: '14px', 
              fontSize: '11px', 
              fontWeight: 900, 
              letterSpacing: '1px',
              transition: 'all 0.2s'
            }}>SCANNER</a>
          </div>
        </nav>

        <main style={{ paddingTop: '120px', paddingBottom: '100px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
