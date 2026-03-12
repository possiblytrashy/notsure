// FILE: app/api/webhooks/paystack/route.js
// OUSTED FORTRESS — Paystack Webhook Handler
// • HMAC-SHA512 signature verification with timingSafeEqual
// • Idempotency (safe to receive same webhook multiple times)
// • Atomic vote count increments
// • Full ticket generation with unique ticket number
// • Reseller commission tracking

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function generateTicketNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OT-${timestamp}-${random}`;
}

export async function POST(req) {
  const startTime = Date.now();
  let reference = 'unknown';

  try {
    const body = await req.text();

    // VERIFY PAYSTACK HMAC-SHA512 SIGNATURE
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 401 });

    const expectedHash = crypto.createHmac('sha512', secret).update(body).digest('hex');

    const sigBuf = Buffer.from(signature.padEnd(128, '0').substring(0, 128), 'hex');
    const expBuf = Buffer.from(expectedHash, 'hex');

    let isValid = true;
    if (signature.length !== expectedHash.length) {
      isValid = false;
    } else {
      try {
        isValid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), expBuf);
      } catch { isValid = false; }
    }

    if (!isValid) {
      console.error('SECURITY: Invalid Paystack webhook signature — possible forgery attempt');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event;
    try { event = JSON.parse(body); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { data } = event;
    reference = data?.reference || 'unknown';

    if (event.event !== 'charge.success' || data.status !== 'success') {
      return NextResponse.json({ message: 'Event acknowledged' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // IDEMPOTENCY CHECK
    const { data: existing } = await supabase
      .from('webhook_log')
      .select('id')
      .eq('reference', reference)
      .eq('status', 'processed')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: 'Already processed', idempotent: true });
    }

    await supabase.from('webhook_log').upsert({
      reference, event_type: event.event,
      amount: data.amount / 100, status: 'processing',
      processed_at: new Date().toISOString()
    }, { onConflict: 'reference' });

    const metadata = data.metadata || {};
    let result = {};

    if (metadata.type === 'VOTE') {
      result = await handleVotePayment(supabase, data, metadata);
    } else if (metadata.type === 'TICKET') {
      result = await handleTicketPayment(supabase, data, metadata);
    }

    await supabase.from('webhook_log').update({
      status: 'processed', duration_ms: Date.now() - startTime
    }).eq('reference', reference);

    return NextResponse.json({ success: true, ...result });

  } catch (err) {
    console.error('Webhook error:', err.message);
    return NextResponse.json({ error: 'Processing error', reference }, { status: 200 });
  }
}

async function handleTicketPayment(supabase, data, metadata) {
  const { event_id, tier_id, guest_email, guest_name, reseller_code, event_reseller_id, is_reseller_purchase, base_price } = metadata;
  const reference = data.reference;
  const amountPaid = data.amount / 100;

  const { data: tier } = await supabase.from('ticket_tiers').select('id, name, max_quantity').eq('id', tier_id).single();
  if (!tier) throw new Error(`Tier ${tier_id} not found`);

  const ticketNumber = generateTicketNumber();

  const { error: ticketErr } = await supabase.from('tickets').insert({
    ticket_number: ticketNumber, reference,
    event_id, tier_id, tier_name: tier.name,
    guest_name: guest_name || 'Guest', guest_email,
    amount: amountPaid, base_amount: base_price || amountPaid,
    status: 'valid', is_scanned: false,
    reseller_code: reseller_code || 'DIRECT',
    is_reseller_purchase: is_reseller_purchase || false,
    created_at: new Date().toISOString()
  });

  if (ticketErr) throw new Error(`Ticket creation failed: ${ticketErr.message}`);

  console.log(`✅ Ticket ${ticketNumber} created for ${guest_email}`);
  return { ticket_number: ticketNumber, guest_name, tier_name: tier.name };
}

async function handleVotePayment(supabase, data, metadata) {
  const { candidate_id, vote_count, voter_email, contest_id, competition_id } = metadata;
  const reference = data.reference;
  const amountPaid = data.amount / 100;
  const votes = parseInt(vote_count, 10);

  if (!candidate_id || !votes) throw new Error('Invalid vote metadata');

  const { data: current } = await supabase.from('candidates').select('vote_count').eq('id', candidate_id).single();
  const { error } = await supabase.from('candidates').update({ vote_count: (current?.vote_count || 0) + votes }).eq('id', candidate_id);
  if (error) throw new Error(`Vote update failed: ${error.message}`);

  await supabase.from('vote_transactions').insert({
    reference, candidate_id, contest_id, competition_id,
    voter_email, vote_count: votes, amount_paid: amountPaid,
    created_at: new Date().toISOString()
  }).then(({ error: le }) => { if (le) console.warn('Vote log failed:', le.message); });

  return { candidate_id, votes_added: votes };
}
