# OUSTED — Production Deployment Guide
## The Most Secure Event Ticketing Platform in Ghana

---

## 🔐 SECURITY FEATURES IMPLEMENTED

### Middleware Layer
- **Rate Limiting**: Per-IP, per-route throttling (5 checkout attempts/min, etc.)
- **Timing-safe signature verification** on all Paystack webhooks
- **Malicious agent blocking** (sqlmap, nikto, etc.)
- **Blocked path patterns** (wp-admin, .env, shell.php, etc.)
- **Security headers** on every response: XSS, CSRF, clickjacking protection

### API Security
- **Input sanitization** (all strings stripped of HTML/script chars)
- **Idempotency keys** on webhooks (never process same payment twice)
- **Webhook signature verification** using `crypto.timingSafeEqual()` 
- **Capacity validation** at checkout AND at webhook time
- **SQL injection impossible** (Supabase parameterized queries)
- **Rate-limited endpoints** with proper 429 responses

### Payment Security
- All payments routed through Paystack (never handle raw card data)
- Split payments configured at the API level (not client-side)
- Amounts calculated server-side only
- `PAYSTACK_SECRET_KEY` never exposed to client

---

## 🚀 ENVIRONMENT VARIABLES (Required)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Paystack
PAYSTACK_SECRET_KEY=sk_live_your_key

# App
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

---

## 📋 PRE-LAUNCH CHECKLIST

### Database (Supabase)
- [ ] Run all migrations in `SUPABASE_MIGRATIONS.sql`
- [ ] Enable Realtime for: `events`, `tickets`, `candidates`
- [ ] Create storage buckets: `event-images`, `event-assets`, `competition-images`
- [ ] Set RLS policies (included in migrations)
- [ ] Enable pgcrypto extension

### Paystack
- [ ] Upgrade to live mode (`sk_live_*`)
- [ ] Configure webhook URL: `https://yourdomain.com/api/webhooks/paystack`
- [ ] Verify HMAC signature on test webhook
- [ ] Enable `charge.success` event only
- [ ] Test split payment with test subaccounts

### Deployment (Vercel recommended)
- [ ] Set all environment variables
- [ ] Enable Vercel Edge Functions
- [ ] Configure custom domain
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set `NODE_ENV=production`

---

## 🧠 PSYCHOLOGICAL CONVERSION FEATURES

### For Ticket Buyers
1. **Live viewer count** — "43 people viewing now"
2. **Live purchase toasts** — "Kwame B. just bought a VIP ticket — 8 min ago"
3. **Scarcity indicators** — "🔥 Only 12 left!" with animated progress bar
4. **Countdown timers** — Live seconds countdown on featured events
5. **Wishlist** — Save events, creates investment/attachment
6. **Social proof feed** — Recent purchases shown in checkout sidebar
7. **Waitlist** — FOMO from being on a waitlist makes events feel exclusive

### For Organizers
1. **95% revenue emphasis** — First thing they see
2. **₵0 setup fee** — Removes financial barrier
3. **Statistics dashboard** — Makes data feel real and achievable
4. **Trust signals** — Paystack logo, bank-grade encryption messaging
5. **Feature list** — Addresses every objection before it's raised

---

## 🆕 NEW FEATURES vs ORIGINAL

| Feature | Before | After |
|---------|--------|-------|
| Security headers | None | Full CSP, XSS, HSTS, etc. |
| Rate limiting | None | Per-IP, per-route |
| Webhook idempotency | None | Full idempotency with log |
| Social proof | None | Live viewers + purchase feed |
| Scarcity indicators | None | Real-time bars + badges |
| Waitlist system | None | Full waitlist with positions |
| Countdown timers | None | Live per-second countdown |
| Wishlist | None | localStorage-based |
| Category filtering | None | Filter by event type |
| Ticket quantity | None | Multi-ticket per transaction |
| Input sanitization | Basic | Full XSS prevention |
| Webhook signature | Basic | timingSafeEqual + audit log |
| Mobile UX | Basic | Fully responsive everywhere |
| Next.js config | None | Security headers + image optimization |
| Database indexes | Unknown | Full indexing for performance |
| Print-ready tickets | None | CSS print media queries |
