/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paystack.com https://*.paystack.co",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://*.paystack.com https://nominatim.openstreetmap.org",
              "frame-src https://*.paystack.com https://*.paystack.co",
              "worker-src blob: 'self'",
            ].join('; ')
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    domains: [
      'images.unsplash.com',
      'api.qrserver.com',
      'res.cloudinary.com',
      'lh3.googleusercontent.com',
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Performance
  compress: true,
  poweredByHeader: false, // Don't reveal Next.js
  
  // Redirects
  async redirects() {
    return [
      { source: '/dashboard', destination: '/dashboard/user', permanent: false },
    ];
  },
};

module.exports = nextConfig;
