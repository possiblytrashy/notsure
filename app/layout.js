import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  const meshStyle = {
    backgroundColor: "#f8fafc",
    backgroundImage: `
      radial-gradient(at 0% 0%, hsla(189, 100%, 56%, 0.15) 0px, transparent 50%),
      radial-gradient(at 100% 0%, hsla(340, 100%, 76%, 0.15) 0px, transparent 50%),
      radial-gradient(at 50% 100%, hsla(225, 39%, 30%, 0.05) 0px, transparent 50%)
    `,
    backgroundAttachment: "fixed",
    minHeight: "100vh",
    margin: 0,
    padding: 0
  };

  const navStyle = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '1000px',
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '24px',
    padding: '15px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
  };

  return (
    <html lang="en">
      <body className={outfit.className} style={meshStyle}>
        <nav style={navStyle}>
          <div style={{ fontWeight: 900, fontSize: '24px', letterSpacing: '-1px' }}>OUSTED.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="/admin/scan" style={{ textDecoration: 'none', color: '#fff', background: '#000', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>SCANNER</a>
          </div>
        </nav>
        <main style={{ paddingTop: '100px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
