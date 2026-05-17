// OUSTED WEBHOOK ENGINE v3.0
// Handles: charge.success for TICKET and VOTE purchases
// USSD purchases are routed to processUSSDPayment when meta.channel === 'USSD'

import { NextResponse } from 'next/server';a
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function generateTicketNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OT-${ts}-${rand}`;
}

// ─── ARKESEL SMS ──────────────────────────────────────────────
async function sendSMS(to, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) return;
  const phone = normalisePhoneForSMS(to);
  if (!phone) return;
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: process.env.ARKESEL_SENDER_ID || 'OUSTED',
        message,
        recipients: [phone],
      }),
    });
    const data = await res.json();
    if (data.status !== 'success') console.error('[WEBHOOK SMS] Arkesel error:', JSON.stringify(data));
  } catch (err) {
    console.error('[WEBHOOK SMS] Error:', err.message);
  }
}

function normalisePhoneForSMS(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()]/g, '');
  if (/^233[2-9]\d{8}$/.test(p)) return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  if (/^0[2-9]\d{8}$/.test(p)) return '+233' + p.slice(1);
  return null;
}

export async function POST(req) {
  const body = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').update(body).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
      console.error('[WEBHOOK] Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(body); } catch { return NextResponse.json({ ok: true }); }

  if (event.event !== 'charge.success') return NextResponse.json({ ok: true });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { reference } = event.data;

  const { data: existing } = await supabase.from('webhook_log').select('id,status').eq('reference', reference).single().catch(() => ({ data: null }));
  if (existing?.status === 'processed') return NextResponse.json({ ok: true });

  await supabase.from('webhook_log').upsert({ reference, status: 'processing', raw_payload: event }, { onConflict: 'reference' }).catch(() => {});

  const meta = event.data.metadata || {};
  const startTime = Date.now();

  try {
    if (meta.type === 'TICKET' && meta.channel === 'USSD') {
      const { processUSSDPayment } = await import('../../ussd/payment-callback/handler.js');
      await processUSSDPayment(event.data.reference, event.data);
    } else if (meta.type === 'TICKET') {
      await processTicket(supabase, event.data, meta);
    } else if (meta.type === 'VOTE') {
      await processVote(supabase, event.data, meta);
    }

    await supabase.from('webhook_log').upsert({
      reference, status: 'processed',
      duration_ms: Date.now() - startTime,
      raw_payload: event
    }, { onConflict: 'reference' }).catch(() => {});

  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err.message);
    await supabase.from('webhook_log').upsert({
      reference, status: 'failed',
      duration_ms: Date.now() - startTime,
      raw_payload: { ...event, _error: err.message }
    }, { onConflict: 'reference' }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

async function processTicket(supabase, data, meta) {
  const {
    event_id, tier_id, guest_email, guest_name,
    reseller_code, event_reseller_id, is_reseller_purchase,
    base_price, buyer_price, platform_fee, reseller_commission, quantity = 1
  } = meta;

  if (!event_id || !tier_id || !guest_email) throw new Error('Missing ticket metadata');

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

  const { data: tier } = await supabase.from('ticket_tiers').select('max_quantity,name').eq('id', tier_id).single();
  if (tier?.max_quantity > 0) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tier_id).eq('status', 'valid');
    if ((count || 0) + qty > tier.max_quantity) {
      console.error(`[WEBHOOK] Oversell prevented for tier ${tier_id}`);
      return;
    }
  }

  const tickets = Array.from({ length: qty }, () => ({
    event_id,
    tier_id,
    tier_name: tier?.name || '',
    reference: data.reference,
    ticket_number: generateTicketNumber(),
    guest_email: guest_email.trim().toLowerCase(),
    guest_name: guest_name || 'Guest',
    amount: base_price || (data.amount / 100 / (qty || 1)),
    base_amount: base_price || (data.amount / 100 / (qty || 1)),
    platform_fee: platform_fee || 0,
    is_reseller_purchase: is_reseller_purchase || false,
    reseller_code: reseller_code || 'DIRECT',
    event_reseller_id: event_reseller_id || null,
    status: 'valid',
    is_scanned: false
  }));

  const { error: insertError } = await supabase.from('tickets').insert(tickets);
  if (insertError) throw insertError;

  await supabase.rpc('increment_event_tickets_sold', { event_id_param: event_id, amount: qty }).catch(() => {
    supabase.from('events').select('tickets_sold').eq('id', event_id).single().then(({ data: ev }) => {
      supabase.from('events').update({ tickets_sold: (ev?.tickets_sold || 0) + qty }).eq('id', event_id);
    });
  });

  if (is_reseller_purchase && event_reseller_id) {
    const earned = (reseller_commission || 0) * qty;
    const { data: er } = await supabase.from('event_resellers').select('tickets_sold,total_earned').eq('id', event_reseller_id).single().catch(() => ({ data: null }));
    await supabase.from('event_resellers').update({
      tickets_sold: (er?.tickets_sold || 0) + qty,
      total_earned: parseFloat(((er?.total_earned || 0) + earned).toFixed(2))
    }).eq('id', event_reseller_id).catch(() => {});
  }

  const orgOwes = meta.organizer_owes || (base_price * qty) || 0;
  const resOwes = meta.reseller_owes || (is_reseller_purchase ? (reseller_commission || 0) * qty : 0);
  await supabase.from('payout_ledger').insert({
    reference: data.reference,
    event_id,
    organizer_id: meta.organizer_id || null,
    event_reseller_id: is_reseller_purchase ? event_reseller_id : null,
    transaction_type: 'TICKET',
    total_collected: data.amount / 100,
    organizer_owes: parseFloat(orgOwes.toFixed(2)),
    reseller_owes: parseFloat(resOwes.toFixed(2)),
    platform_keeps: parseFloat((data.amount / 100 - orgOwes - resOwes).toFixed(2)),
    status: 'pending',
    notes: `${qty}x ${tier?.name || 'ticket'} for ${guest_email}`
  }).catch(() => {});

  // ── SMS for web purchases ───────────────────────────────────
  // Send if metadata includes a phone, or if guest_email encodes USSD phone
  const rawPhone = meta.guest_phone || meta.ussd_phone || null;
  const emailPhone = guest_email.match(/^ussd-(\d{9,15})@/)?.[1] || null;
  const smsPhone = rawPhone || (emailPhone ? '+' + emailPhone : null);
  if (smsPhone) {
    const ticketUrl = `${BASE_URL}/tickets/find?ref=${encodeURIComponent(data.reference)}`;
    await sendSMS(smsPhone, [
      'OUSTED Ticket Confirmed!',
      `Event: ${meta.event_title || 'Your event'}`,
      `Tier: ${tier?.name || 'General'} x${qty}`,
      `Ref: ${data.reference}`,
      `View: ${ticketUrl}`,
    ].join('\n'));
  }

  console.warn(`[WEBHOOK] ✅ ${qty} ticket(s) for ${guest_email} | ref: ${data.reference}`);
}

async function processVote(supabase, data, meta) {
  const {
    candidate_id, candidate_name, contest_id,
    vote_count, voter_email, voter_name,
    vote_price, platform_fee, competition_id
  } = meta;

  if (!candidate_id || !vote_count) throw new Error('Missing vote metadata');

  const votes = parseInt(vote_count, 10);

  await supabase.from('vote_transactions').upsert({
    reference: data.reference,
    candidate_id,
    contest_id,
    competition_id,
    voter_email: voter_email?.toLowerCase(),
    voter_name: voter_name || 'Anonymous',
    vote_count: votes,
    vote_price: vote_price || 0,
    platform_fee: platform_fee || 0,
    amount_paid: data.amount / 100,
    status: 'confirmed'
  }, { onConflict: 'reference' }).catch(() => {});

  const { error: rpcError } = await supabase.rpc('increment_vote_count', {
    p_candidate_id: candidate_id,
    p_vote_increment: votes
  });

  if (rpcError) {
    const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', candidate_id).single();
    await supabase.from('candidates').update({ vote_count: (cand?.vote_count || 0) + votes }).eq('id', candidate_id);
  }

  const voteOrgOwes = meta.organizer_owes || (vote_price * votes) || 0;
  await supabase.from('payout_ledger').insert({
    reference: data.reference,
    event_id: null,
    organizer_id: meta.organizer_id || null,
    event_reseller_id: null,
    transaction_type: 'VOTE',
    total_collected: data.amount / 100,
    organizer_owes: parseFloat(voteOrgOwes.toFixed(2)),
    reseller_owes: 0,
    platform_keeps: parseFloat((data.amount / 100 - voteOrgOwes).toFixed(2)),
    contest_id: contest_id || null,
    competition_id: competition_id || null,
    status: 'pending',
    notes: `${votes} vote(s) for ${candidate_name}`
  }).catch(() => {});

  console.warn(`[WEBHOOK] ✅ ${votes} vote(s) for ${candidate_name} | ref: ${data.reference}`);
}
