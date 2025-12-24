import './globals.css';
import { Outfit } from 'next/font/google';
import Link from 'next/link';

const outfit = Outfit({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <nav className="fixed top-4 left-0 right-0 z-50 px-4 max-w-7xl mx-auto">
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-2xl px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lumina-600 to-accent-purple">
             OUSTED
            </Link>
            <div className="flex gap-4">
              <Link href="/dashboard/organizer" className="text-sm font-medium hover:text-lumina-600">Organizer</Link>
              <Link href="/admin/scan" className="text-sm font-medium hover:text-lumina-600">Scanner</Link>
            </div>
          </div>
        </nav>
        <main className="pt-28 px-4 pb-12 max-w-7xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
