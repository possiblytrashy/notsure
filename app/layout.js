// SERVER COMPONENT — exports metadata for SEO
// Client nav/footer logic lives in ClientShell.jsx

import { Outfit } from 'next/font/google';
import ClientShell from './components/ClientShell';

const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
const SITE_NAME = 'OUSTED';
const SITE_DESCRIPTION = 'Buy tickets for the best events — concerts, parties, competitions. Instant delivery, secured by Paystack. Sell tickets as a reseller and earn 10% commission.';
const OG_IMAGE = `${SITE_URL}/og-default.png`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'OUSTED — Premium Event Ticketing',
    template: '%s | OUSTED'
  },
  description: SITE_DESCRIPTION,
  keywords: ['event tickets', 'buy tickets online', 'Ghana events', 'concert tickets', 'party tickets', 'event ticketing platform', 'Paystack tickets', 'vote for candidates', 'online voting', 'ticket reseller'],
  authors: [{ name: 'OUSTED', url: SITE_URL }],
  creator: 'OUSTED',
  publisher: 'OUSTED',
  applicationName: 'OUSTED',
  category: 'Entertainment',
  classification: 'Event Ticketing',
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_GH',
    alternateLocale: ['en_US', 'en_GB'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'OUSTED — Premium Event Ticketing',
    description: SITE_DESCRIPTION,
    images: [
      { url: OG_IMAGE, width: 1200, height: 630, alt: 'OUSTED Event Ticketing Platform' }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@oustedlive',
    creator: '@oustedlive',
    title: 'OUSTED — Premium Event Ticketing',
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  icons: {
    icon: [
      { url: '/api/icon?size=32', sizes: '32x32', type: 'image/png' },
      { url: '/api/icon?size=192', sizes: '192x192', type: 'image/png' },
      { url: '/api/icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/api/icon?size=180&bg=CDA434&fg=000000', sizes: '180x180', type: 'image/png' }],
    shortcut: '/api/icon?size=32',
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OUSTED',
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || '',
  },
  alternates: {
    canonical: SITE_URL,
    types: {
      'application/rss+xml': `${SITE_URL}/feed.xml`,
    },
  },
  other: {
    'msapplication-TileColor': '#000000',
    'theme-color': '#000000',
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#000000',
};

// Organization JSON-LD — appears on every page
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'OUSTED',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  sameAs: [
    'https://twitter.com/oustedlive',
    'https://instagram.com/oustedlive',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@ousted.live',
  }
};

// WebSite JSON-LD — enables Google sitelinks search box
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'OUSTED',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
    'query-input': 'required name=search_term_string'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        {/* Preconnects for perf */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.co'} />
        <link rel="dns-prefetch" href="https://api.paystack.co" />
        <link rel="dns-prefetch" href="https://api.qrserver.com" />

        {/* Organization + WebSite structured data on every page */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />

        {/* PWA / Mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />

        <style>{`
          *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
          body{margin:0;-webkit-font-smoothing:antialiased}
          @keyframes mesh{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
          @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          .animate-spin{animation:spin 1s linear infinite}
          .bg-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;background:linear-gradient(-45deg,#fdf2f8,#eff6ff,#f0fdf4,#fefce8);background-size:400% 400%;animation:mesh 20s ease infinite}
          .glass{background:rgba(255,255,255,0.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,0.35)}
          .nav{position:fixed;top:14px;left:50%;transform:translateX(-50%);width:96%;max-width:1280px;border-radius:20px;padding:8px 18px;display:flex;justify-content:space-between;align-items:center;z-index:10000}
          .logo{text-decoration:none;color:#000;font-weight:950;font-size:21px;letter-spacing:-1.5px;flex-shrink:0;margin-right:16px}
          .nav-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex:1}
          .btn{text-decoration:none;color:#000;font-size:10px;font-weight:900;letter-spacing:.5px;display:flex;align-items:center;gap:5px;padding:9px 13px;border-radius:11px;transition:.2s;cursor:pointer;border:none;white-space:nowrap;font-family:inherit}
          .btn-outline{border:1.5px solid rgba(0,0,0,0.15);background:rgba(255,255,255,0.5)}
          .btn-solid{background:#000;color:#fff}
          .btn-vote{color:#fff;background:linear-gradient(135deg,#e73c7e,#c0196a);box-shadow:0 4px 15px rgba(231,60,126,0.35)}
          .btn-outline:hover{background:rgba(255,255,255,0.9);transform:translateY(-1px)}
          .btn-solid:hover{background:#222;transform:translateY(-1px)}
          .hide-mobile{display:flex}
          .footer{margin:80px auto 28px;width:96%;max-width:1280px;border-radius:36px;padding:55px 45px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:40px;color:#000;position:relative;z-index:1}
          .footer-brand h2{font-size:26px;font-weight:950;letter-spacing:-1.5px;margin:0 0 12px}
          .footer-brand p{font-size:13px;line-height:1.6;opacity:.6;max-width:280px;margin:0}
          .footer-col h4{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px;color:rgba(0,0,0,0.35)}
          .footer-link{display:flex;align-items:center;gap:8px;text-decoration:none;color:#000;font-size:14px;font-weight:600;margin-bottom:13px;transition:.2s}
          .footer-link:hover{opacity:.5;transform:translateX(4px)}
          .status-card{background:rgba(255,255,255,0.5);padding:18px;border-radius:18px;border:1px solid rgba(255,255,255,0.6)}
          .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px}
          @media(max-width:860px){.footer{grid-template-columns:1fr;text-align:center;padding:36px 22px}.footer-brand p{margin:8px auto}.footer-link{justify-content:center}}
          @media(max-width:640px){.nav{padding:7px 10px;width:94%;top:10px}.logo{font-size:18px;margin-right:8px}.hide-mobile{display:none!important}.btn{padding:8px 9px;gap:3px}.nav-actions{gap:5px}}
          ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px}
          ::selection{background:rgba(231,60,126,.15)}
          @media print{.bg-canvas,.nav,.footer{display:none!important}}
          /* ── GLOBAL MOBILE FIXES ─────────────────────────────────── */
          *{box-sizing:border-box}
          html,body{overflow-x:hidden;width:100%}
          img,video,canvas,svg{max-width:100%}
          input,select,textarea,button{max-width:100%;font-family:inherit}

          /* Prevent iOS input zoom */
          input[type="text"],input[type="email"],input[type="tel"],
          input[type="number"],input[type="password"],select,textarea{
            font-size:16px!important
          }

          /* Organizer dashboard — full desktop layout collapses on mobile */
          @media(max-width:768px){
            /* Main wrapper: remove desktop padding */
            .od-wrapper{padding:16px 12px 90px!important;max-width:100vw!important}

            /* Balance card: reduce padding, font sizes */
            .od-balance-card{padding:24px 20px!important;border-radius:20px!important}
            .od-balance-value{font-size:36px!important;letter-spacing:-1.5px!important;margin:12px 0!important}

            /* Stat cards: single column */
            .od-stats-row{flex-direction:column!important;gap:12px!important}
            .od-stat-card{padding:18px!important}

            /* Nav: stack logo + actions */
            .od-top-nav{flex-wrap:wrap;gap:10px!important;margin-bottom:24px!important}
            .od-header-actions{gap:8px!important}
            .od-user-brief{display:none}

            /* Tab bar: scrollable, no wrap */
            .od-tabs{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:none}
            .od-tabs::-webkit-scrollbar{display:none}

            /* Card grids: single column */
            .od-card-grid{grid-template-columns:1fr!important;gap:16px!important}
            .od-analytics-grid{grid-template-columns:1fr!important;gap:14px!important}

            /* Tables: card layout */
            .od-table-wrapper{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
            .od-data-table{min-width:600px}

            /* View headers: stack */
            .od-view-header{flex-direction:column!important;gap:12px!important;align-items:flex-start!important;margin-bottom:20px!important}

            /* Edit modal grid: single column */
            .od-edit-grid{grid-template-columns:1fr!important;gap:18px!important}

            /* Filter row: wrap */
            .od-filter-group{flex-wrap:wrap!important;gap:8px!important}
            .od-search-input{width:120px!important}

            /* Balance action buttons: stack */
            .od-settings-btn{padding:12px 16px!important;width:100%!important;justify-content:center!important}

            /* Event card images: shorter on mobile */
            .od-item-image{height:160px!important}
          }

          /* Organizer Create page */
          @media(max-width:768px){
            .oc-main{padding:14px 12px 80px!important}
            .oc-two-col{grid-template-columns:1fr!important;gap:0!important}
            .oc-tier-grid{grid-template-columns:1fr!important}
            .oc-img-grid{grid-template-columns:repeat(2,1fr)!important}
            .oc-map-coord{font-size:11px!important}
          }

          /* User dashboard */
          @media(max-width:640px){
            .ud-stats-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
            .ud-header-actions{gap:6px!important}
            .ud-next-event{padding:14px!important}
            .ud-wallet-row{grid-template-columns:1fr!important;gap:8px!important}
          }

          /* Event page */
          @media(max-width:640px){
            .ep-hero{height:220px!important}
            .ep-content{padding:14px 12px 100px!important}
            .ep-tier-grid{grid-template-columns:1fr!important}
            .ep-qty-row{flex-direction:column!important;gap:8px!important}
            .ep-buy-sticky{padding:12px 14px!important}
          }

          /* Reseller dashboard */
          @media(max-width:640px){
            .rd-stats{grid-template-columns:1fr 1fr!important;gap:10px!important}
            .rd-table{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .rd-table table{min-width:500px}
            .rd-link-card{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}
          }

          /* Admin dashboard */
          @media(max-width:768px){
            .ad-wrapper{padding:14px 12px 90px!important}
            .ad-stats{grid-template-columns:1fr 1fr!important;gap:10px!important}
            .ad-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
            .ad-table{min-width:560px}
            .ad-ledger-filter{flex-wrap:wrap!important;gap:8px!important}
          }

          /* Scan page — make the camera reader full width on mobile */
          @media(max-width:640px){
            #reader{width:100%!important}
            #reader video{width:100%!important;height:auto!important;object-fit:cover}
            #reader__dashboard_section_swaplink{font-size:11px!important}
          }

        `}</style>
      </head>
      <body className={outfit.className} style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="bg-canvas" />
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
