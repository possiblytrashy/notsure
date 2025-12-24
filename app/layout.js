import './globals.css';
import { Outfit } from 'next/font/google';
import Link from 'next/link';

const outfit = Outfit({ 
  subsets: ['latin'],
  display: 'swap', 
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${outfit.className} antialiased min-h-screen relative`}>
        {/* Navigation Bar */}
        <nav className="fixed top-6 left-0 right-0 z-50 px-4">
          <div className="max-w-5xl mx-auto bg-white/40 backdrop-blur-md border border-white/20 shadow-2xl rounded-[2rem] px-8 py-4 flex justify-between items-center transition-all duration-300 hover:bg-white/50">
            <Link 
              href="/" 
              className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-lumina-600 to-accent-purple"
            >
              OUSTED<span className="text-lumina-500">.</span>
            </Link>
            
            <div className="flex items-center gap-8">
              <Link 
                href="/dashboard/organizer" 
                className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-lumina-600 transition-colors"
              >
                Organizer
              </Link>
              <Link 
                href="/admin/scan" 
                className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-lumina-600 hover:scale-105 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                Scanner
              </Link>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main className="relative z-10 pt-32 px-4 pb-20 max-w-7xl mx-auto">
          {children}
        </main>

        {/* Optional: Subtle background overlay to ensure text readability */}
        <div className="fixed inset-0 bg-white/10 pointer-events-none -z-10" />
      </body>
    </html>
  );
}
