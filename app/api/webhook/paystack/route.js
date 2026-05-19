// DEPRECATED — this route exists for backwards compatibility only.
// The canonical Paystack webhook URL is /api/webhooks/paystack (plural).
//
// If your Paystack dashboard still points here, update it to:
//   https://yourdomain.com/api/webhooks/paystack
//
// This file proxies the request to the correct handler so no payments are lost
// during the transition. Once your Paystack dashboard is updated, this file
// can be deleted.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req) {
  console.warn('[WEBHOOK] ⚠️  Hit deprecated /api/webhook/paystack — proxying to /api/webhooks/paystack. Update your Paystack dashboard webhook URL.');

  const body      = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paystack`,
      {
        method:  'POST',
        headers: {
          'Content-Type':           'application/json',
          'x-paystack-signature':   signature,
          'x-forwarded-from-legacy': 'true',
        },
        body,
      }
    );
    const data = await res.json().catch(() => ({ ok: true }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[WEBHOOK] Proxy error:', err.message);
    // Return 200 so Paystack does not retry and hit this dead-end again
    return NextResponse.json({ ok: true });
  }
}
