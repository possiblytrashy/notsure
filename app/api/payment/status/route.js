// Payment status polling — distinguishes TICKET vs VOTE payments correctly
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

    // ── 1. Check webhook_log ─────────────────────────────────
    let webhookStatus = null;
    try {
      const { data: wh } = await supabase
        .from('webhook_log')
        .select('status,raw_payload')
        .eq('reference', reference)
        .maybeSingle();
      webhookStatus = wh?.status || null;

      if (webhookStatus === 'processed') {
        // Determine type from raw_payload metadata
        const txType = wh?.raw_payload?.data?.metadata?.type || null;
        if (txType === 'VOTE') {
          return NextResponse.json({
            status: 'confirmed', type: 'vote',
            message: '🗳️ Votes confirmed! Your votes have been counted.'
          });
        }
        // For tickets, fetch the actual ticket records
        let tickets = [];
        try {
          const { data } = await supabase
            .from('tickets')
            .select('id,ticket_number,reference,guest_name,tier_name,event_id')
            .eq('reference', reference)
            .limit(5);
          tickets = data || [];
        } catch {}
        return NextResponse.json({
          status: 'confirmed', type: 'ticket',
          message: '🎟️ Ticket confirmed! Appearing in your vault.',
          tickets
        });
      }
    } catch {}

    if (webhookStatus === 'failed') {
      return NextResponse.json({ status: 'failed', message: 'Payment failed. Please try again or contact support.' });
    }

    // ── 2. Check tickets table directly ─────────────────────
    try {
      const { data: t } = await supabase
        .from('tickets').select('id').eq('reference', reference).limit(1);
      if (t?.length) {
        return NextResponse.json({
          status: 'confirmed', type: 'ticket',
          message: '🎟️ Ticket confirmed! Appearing in your vault.'
        });
      }
    } catch {}

    // ── 3. Check vote_transactions directly ─────────────────
    try {
      const { data: v } = await supabase
        .from('vote_transactions').select('id,vote_count').eq('reference', reference).limit(1);
      if (v?.length) {
        const count = v[0]?.vote_count || 1;
        return NextResponse.json({
          status: 'confirmed', type: 'vote',
          message: `🗳️ ${count} vote${count !== 1 ? 's' : ''} confirmed! Results are updating.`
        });
      }
    } catch {}

    // ── 4. Verify with Paystack directly ─────────────────────
    try {
      const psRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      if (psRes.ok) {
        const psData = await psRes.json();
        const txStatus = psData?.data?.status;
        const txType = psData?.data?.metadata?.type || 'TICKET';

        if (txStatus === 'success') {
          const pendingMsg = txType === 'VOTE'
            ? 'Payment received — counting your votes...'
            : 'Payment received — issuing your ticket now...';
          // Fire manual webhook fallback
          fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paystack/manual`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal'
            },
            body: JSON.stringify({ reference, data: psData.data })
          }).catch(() => {});
          return NextResponse.json({
            status: 'pending',
            type: txType.toLowerCase(),
            message: pendingMsg
          });
        }
        if (txStatus === 'failed' || txStatus === 'reversed') {
          return NextResponse.json({ status: 'failed', message: 'Payment was not successful. Please try again.' });
        }
      }
    } catch {}

    // ── 5. Still waiting ──────────────────────────────────────
    return NextResponse.json({ status: 'pending', message: 'Verifying your payment...' });

  } catch (err) {
    console.error('[payment/status] error:', err.message);
    return NextResponse.json({ status: 'pending', message: 'Checking payment status...' });
  }
}
