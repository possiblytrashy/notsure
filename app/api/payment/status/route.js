// Payment status polling — zero failure approach
// Clients poll this after Paystack redirect to confirm ticket/vote creation
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference');
  if (!reference || reference.length > 200) return NextResponse.json({ status: 'failed', message: 'Invalid reference' }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Check webhook_log first (fastest)
  const { data: wh } = await supabase.from('webhook_log').select('status,raw_payload').eq('reference', reference).single().catch(() => ({ data: null }));

  if (wh?.status === 'processed') {
    // Fetch the resulting ticket(s) or vote
    const { data: tickets } = await supabase.from('tickets').select('*, events!event_id(title,date,location), ticket_tiers:tier_id(name)').eq('reference', reference).limit(5);
    const { data: vote } = await supabase.from('vote_transactions').select('*').eq('reference', reference).single().catch(() => ({ data: null }));
    return NextResponse.json({ status: 'confirmed', message: 'Payment confirmed!', tickets: tickets || [], vote: vote || null });
  }
  if (wh?.status === 'failed') return NextResponse.json({ status: 'failed', message: 'Payment failed. Please try again.' });

  // 2. Double-check directly with Paystack API (in case webhook was delayed)
  try {
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const psData = await psRes.json();
    if (psData?.data?.status === 'success') {
      // Webhook either in-flight or missed — trigger manual processing
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paystack/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal' },
        body: JSON.stringify({ reference, data: psData.data })
      }).catch(() => {});
      return NextResponse.json({ status: 'pending', message: 'Payment received — issuing your ticket now...' });
    }
    if (psData?.data?.status === 'failed') return NextResponse.json({ status: 'failed', message: 'Payment was declined by your bank.' });
  } catch {}

  // 3. Still processing
  return NextResponse.json({ status: 'pending', message: 'Verifying payment...' });
}
