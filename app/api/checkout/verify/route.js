// OUSTED Payment Verification — Resilient fallback for missed webhooks
// Called by frontend after Paystack redirect to confirm payment status
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function sanitizeRef(r) { return String(r || '').replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 100); }

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rawRef = searchParams.get('reference') || searchParams.get('trxref') || '';
  const reference = sanitizeRef(rawRef);

  if (!reference) return NextResponse.json({ error: 'Reference required' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Check if webhook already processed this
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id,ticket_number,guest_email,events:event_id(title,date,location)')
    .eq('reference', reference)
    .limit(1)
    .single()
    .catch(() => ({ data: null }));

  if (existingTicket) {
    return NextResponse.json({ status: 'confirmed', ticket_ready: true, ticket: existingTicket });
  }

  // 2. Check webhook_log status
  const { data: wlog } = await supabase
    .from('webhook_log')
    .select('status')
    .eq('reference', reference)
    .single()
    .catch(() => ({ data: null }));

  if (wlog?.status === 'processing') {
    return NextResponse.json({ status: 'processing', ticket_ready: false, message: 'Your payment is being confirmed. Check back in a moment.' });
  }

  // 3. Verify with Paystack directly (fallback for missed webhooks)
  try {
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const psData = await psRes.json();

    if (!psRes.ok || !psData.status || psData.data?.status !== 'success') {
      return NextResponse.json({ status: 'pending', ticket_ready: false, message: 'Payment not confirmed yet.' });
    }

    // Payment IS confirmed on Paystack but webhook missed — trigger processing manually
    const meta = psData.data?.metadata || {};
    if (meta.type === 'TICKET') {
      // Re-trigger ticket creation via internal webhook simulation
      const webhookBody = JSON.stringify({ event: 'charge.success', data: psData.data });
      const webhookRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Sign with HMAC so our webhook endpoint accepts it
          'x-paystack-signature': require('crypto')
            .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
            .update(webhookBody).digest('hex')
        },
        body: webhookBody
      }).catch(() => null);

      // Give it a moment then check again
      await new Promise(r => setTimeout(r, 1500));
      const { data: retryTicket } = await supabase
        .from('tickets')
        .select('id,ticket_number,guest_email')
        .eq('reference', reference)
        .limit(1)
        .single()
        .catch(() => ({ data: null }));

      if (retryTicket) {
        return NextResponse.json({ status: 'confirmed', ticket_ready: true, ticket: retryTicket, note: 'recovered' });
      }
    }

    return NextResponse.json({ status: 'paid', ticket_ready: false, message: 'Payment confirmed. Your ticket is being generated — check your email.' });

  } catch (err) {
    console.error('[VERIFY] Error:', err.message);
    return NextResponse.json({ status: 'error', ticket_ready: false, message: 'Could not verify payment. Please contact support with your reference.' });
  }
}
