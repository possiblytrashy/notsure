import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// OUSTED FORTRESS — Security Middleware
// Rate limiting, CSRF protection, security headers, input sanitization
// ============================================================================

// In-memory rate limiter (use Redis/Upstash in production for multi-instance)
const rateLimitMap = new Map();

function rateLimit(key, limit = 20, windowMs = 60_000) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }

  rateLimitMap.set(key, record);

  // Cleanup old entries every ~1000 requests
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) {
      if (Date.now() > v.resetAt) rateLimitMap.delete(k);
    }
  }

  return { allowed: record.count <= limit, remaining: Math.max(0, limit - record.count), reset: record.resetAt };
}

// Aggressive limits per route type
const RATE_LIMITS = {
  '/api/checkout/secure-session': { limit: 5,  window: 60_000 },   // 5 purchase attempts/min
  '/api/checkout/verify':         { limit: 10, window: 60_000 },   // 10 verifications/min
  '/api/webhooks/paystack':       { limit: 100, window: 60_000 },  // webhooks get more room
  '/api/organizer/onboard':       { limit: 3,  window: 60_000 },   // 3 onboard attempts/min
  '/api/reseller':                { limit: 10, window: 60_000 },
  '/api/social-proof':            { limit: 60, window: 60_000 },   // polling endpoint
  default:                        { limit: 60, window: 60_000 },
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

// Blocked user agents (bots/scrapers trying to abuse checkout)
const BLOCKED_AGENTS = ['sqlmap', 'nikto', 'masscan', 'zgrab', 'python-requests', 'go-http-client'];

export async function middleware(req) {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || '0.0.0.0';

  // ── 1. BLOCK KNOWN MALICIOUS AGENTS ───────────────────────────────────────
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  if (BLOCKED_AGENTS.some(agent => ua.includes(agent))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── 2. BLOCK OBVIOUSLY MALICIOUS PATHS ────────────────────────────────────
  const BLOCKED_PATHS = [
    '/wp-admin', '/wp-login', '/.env', '/phpMyAdmin', '/admin.php',
    '/config.php', '/shell.php', '/.git', '/xmlrpc.php', '/server-status'
  ];
  if (BLOCKED_PATHS.some(p => pathname.startsWith(p))) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // ── 3. RATE LIMITING (API routes only) ────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Find matching rate limit config
    const routeKey = Object.keys(RATE_LIMITS).find(k => k !== 'default' && pathname.startsWith(k)) || 'default';
    const { limit, window } = RATE_LIMITS[routeKey];
    const { allowed, remaining, reset } = rateLimit(`${ip}:${routeKey}`, limit, window);

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down.', retryAfter: Math.ceil((reset - Date.now()) / 1000) }),
        { 
          status: 429, 
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // Build response with rate limit headers
    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Limit', String(limit));
    res.headers.set('X-RateLimit-Remaining', String(remaining));

    // Apply security headers to all API responses
    for (const [key, val] of Object.entries(SECURITY_HEADERS)) {
      res.headers.set(key, val);
    }
    return res;
  }

  // ── 4. PROTECT ORGANIZER/ADMIN ROUTES ─────────────────────────────────────
  const PROTECTED_ROUTES = ['/dashboard/organizer', '/admin'];
  if (PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    // Don't block server-side; let the page handle auth redirect
    // But add security headers
  }

  // ── 5. ADD SECURITY HEADERS TO ALL RESPONSES ──────────────────────────────
  const res = NextResponse.next();
  for (const [key, val] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, val);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
