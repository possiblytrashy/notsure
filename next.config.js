/** @type {import('next').NextConfig} */

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.vercel.app'; 

const nextConfig = {
  // ── SECURITY + SEO HEADERS ───────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paystack.com https://*.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://*.paystack.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org",
              "frame-src https://*.paystack.com https://*.paystack.co",
              "worker-src blob: 'self'",
              "media-src 'self' blob:", 
            ].join('; ')
          },
          // SEO/Perf
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/(.*)\\.(ico|png|svg|jpg|jpeg|webp|woff2|woff)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache OG images for 24h
      {
        source: '/api/og(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      // Feed
      {
        source: '/feed.xml',
        headers: [
          { key: 'Content-Type', value: 'application/rss+xml' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
    ];
  },

  // ── REDIRECTS ─────────────────────────────────────────────────
  async redirects() {
    return [
      { source: '/dashboard', destination: '/dashboard/user', permanent: false },
      { source: '/ticket/:ref', destination: '/tickets/find?ref=:ref', permanent: true },
      // WWW → non-www (set NEXT_PUBLIC_BASE_URL without www)
    ];
  },

  // ── IMAGE OPTIMIZATION ────────────────────────────────────────
  images: {
    domains: [
      'images.unsplash.com',
      'api.qrserver.com',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
      'oaiskhwsfqbmqdldbynh.supabase.co',  // your Supabase storage
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    deviceSizes: [390, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // ── PERFORMANCE ───────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // ── COMPILER ─────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // ── EXPERIMENTAL ─────────────────────────────────────────────
  experimental: {
    // ppr: false, // enable in Next 15+
  },
};

module.exports = nextConfig;
