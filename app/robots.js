// app/robots.js — generates /robots.txt

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/events/', '/voting'],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/api/',
          '/reseller/',
          '/login',
        ],
      },
      {
        // Block AI scrapers from training on content
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'CCBot', 'anthropic-ai'],
        disallow: ['/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
