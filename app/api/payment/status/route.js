// Payment status polling — called by client after Paystack redirect
// Fixed: removed .catch() on Supabase query builder (not supported in v2)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const reference = searchParams.get('reference');
    if (!reference || reference.length > 200) {
      return NextResponse.json({ status: 'failed', message: 'Invalid reference' }, { status: 400 });
    }

    const supabase = db();

    // 1. Check webhook_log — fastest signal that the webhook processed it
    let webhookStatus = null;
    try {
      const { data: wh } = await supabase
        .from('webhook_log')
        .select('status')
        .eq('reference', reference)
        .maybeSingle();           // maybeSingle() never throws on 0 rows
      webhookStatus = wh?.status || null;
    } catch {}

    if (webhookStatus === 'processed') {
      // Look up the ticket
      let tickets = [];
      try {
        const { data } = await supabase
          .from('tickets')
          .select('id,ticket_number,reference,guest_name,tier_name,event_id')
          .eq('reference', reference)
          .limit(5);
        tickets = data || [];
      } catch {}
      return NextResponse.json({ status: 'confirmed', message: 'Payment confirmed! Your ticket is ready.', tickets });
    }

    if (webhookStatus === 'failed') {
      return NextResponse.json({ status: 'failed', message: 'Payment failed. Please try again or contact support.' });
    }

    // 2. Check if ticket already exists (webhook may have run before log was written)
    let ticketExists = false;
    try {
      const { data } = await supabase
        .from('tickets')
        .select('id')
        .eq('reference', reference)
        .limit(1);
      ticketExists = (data?.length || 0) > 0;
    } catch {}

    if (ticketExists) {
      return NextResponse.json({ status: 'confirmed', message: 'Payment confirmed! Your ticket is ready.' });
    }

    // 3. Check vote_transactions
    let voteExists = false;
    try {
      const { data } = await supabase
        .from('vote_transactions')
        .select('id')
        .eq('reference', reference)
        .limit(1);
      voteExists = (data?.length || 0) > 0;
    } catch {}

    if (voteExists) {
      return NextResponse.json({ status: 'confirmed', message: 'Votes confirmed!' });
    }

    // 4. Verify directly with Paystack
    try {
      const psRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      if (psRes.ok) {
        const psData = await psRes.json();
        const txStatus = psData?.data?.status;

        if (txStatus === 'success') {
          // Paystack confirms success but webhook hasn't fired yet — trigger fallback
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paystack/manual`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal'
            },
            body: JSON.stringify({ reference, data: psData.data })
          }).catch(() => {});
          return NextResponse.json({ status: 'pending', message: 'Payment received — issuing your ticket now...' });
        }

        if (txStatus === 'failed' || txStatus === 'reversed') {
          return NextResponse.json({ status: 'failed', message: 'Payment was not successful. Please try again.' });
        }
      }
    } catch {}

    // 5. Still waiting
    return NextResponse.json({ status: 'pending', message: 'Verifying your payment...' });

  } catch (err) {
    console.error('[payment/status] error:', err.message);
    return NextResponse.json({ status: 'pending', message: 'Checking payment status...' });
  }
}
