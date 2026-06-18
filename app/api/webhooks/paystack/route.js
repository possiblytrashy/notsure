// OUSTED WEBHOOK ENGINE v3.3
// Handles: charge.success for TICKET and VOTE purchases
// USSD purchases (meta.channel === 'USSD') are routed to processUSSDPayment.
// Web purchases go through processTicket.
// Idempotent, timing-safe HMAC verification.
//
// v3.3 changes (BUGFIX):
//   - Replaced ALL .catch() chained directly on Supabase query builders.
//     In @supabase/supabase-js v2, the query builder is a PromiseLike (thenable),
//     NOT a real Promise. .catch() is not guaranteed to exist on its prototype.
//     Every chained .catch() is now replaced with try/catch around await.
//   - Fire-and-forget DB writes (logs, counters) are wrapped in async IIFEs
//     with try/catch so they never crash the main flow.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { processUSSDPayment } from '../../ussd/payment-callback/handler.js';

export const runtime = 'nodejs';

function generateTicketNumber() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OT-${ts}-${rand}`;
}

// ─── SMS HELPERS ──────────────────────────────────────────────
function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))   return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  return null;
}

async function sendSMS(phone, message) {
  const apiKey   = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || 'OUSTED';

  if (!apiKey) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping');
    return { success: false, error: 'no_api_key' };
  }

  const e164 = normalisePhone(phone);
  if (!e164) {
    console.warn(`[SMS] Phone normalisation failed: ${phone}`);
    return { success: false, error: 'invalid_phone', raw: phone };
  }

  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: senderId, message, recipients: [e164] }),
    });
    const data = await res.json();
    console.log(`[SMS] Arkesel response for ${e164}:`, JSON.stringify(data));
    return data.status === 'success'
      ? { success: true, phone: e164 }
      : { success: false, error: data.message, raw: data, phone: e164 };
  } catch (e) {
    console.error('[SMS] Network error:', e.message);
    return { success: false, error: e.message };
  }
}

// Log every SMS attempt to sms_log so admins can audit and resend knows history.
// Upsert on (reference, phone) so replaying a webhook never creates duplicate rows.
async function logSMS(supabase, { reference, phone, message, result, channel = 'web' }) {
  const e164 = normalisePhone(phone) || phone || 'unknown';
  try {
    await supabase.from('sms_log').upsert({
      reference,
      phone:   e164,
      message,
      status:  result.success ? 'sent'   : 'failed',
      error:   result.success ? null      : (result.error || 'unknown'),
      channel,
    }, { onConflict: 'reference,phone' });
  } catch (err) {
    console.warn('[SMS] Failed to write sms_log:', err.message);
  }
}

// ─── WEBHOOK ENTRY POINT ──────────────────────────────────────
export async function POST(req) {
  const body      = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
    .update(body)
    .digest('hex');
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

  // ── IDEMPOTENCY CHECK ────────────────────────────────────────
  // FIX: was .single().catch() — .catch() is not a function on Supabase PromiseLike builders.
  // Now using try/catch around await.
  let existing = null;
  try {
    const { data } = await supabase
      .from('webhook_log')
      .select('id,status')
      .eq('reference', reference)
      .single();
    existing = data;
  } catch {
    // No row found or DB error — treat as not yet processed
  }

  if (existing?.status === 'processed') {
    console.log(`[WEBHOOK] Already processed: ${reference}`);
    return NextResponse.json({ ok: true });
  }

  // FIX: was .upsert(...).catch(() => {}) — replaced with try/catch around await
  try {
    await supabase.from('webhook_log').upsert(
      { reference, status: 'processing', raw_payload: event },
      { onConflict: 'reference' }
    );
  } catch { /* non-fatal */ }

  const meta      = event.data.metadata || {};
  const startTime = Date.now();

  try {
    if (meta.type === 'TICKET') {
      if (meta.channel === 'USSD') {
        console.log(`[WEBHOOK] Routing to processUSSDPayment (USSD) | ref: ${reference}`);
        await processUSSDPayment(reference, event.data);
      } else {
        await processTicket(supabase, event.data, meta);
      }
    } else if (meta.type === 'VOTE') {
      await processVote(supabase, event.data, meta);
    }

    // FIX: was .upsert(...).catch(() => {})
    try {
      await supabase.from('webhook_log').upsert({
        reference,
        status:      'processed',
        duration_ms: Date.now() - startTime,
        raw_payload: event,
      }, { onConflict: 'reference' });
    } catch { /* non-fatal */ }

  } catch (err) {
    console.error('[WEBHOOK] Processing error:', err.message);
    // FIX: was .upsert(...).catch(() => {})
    try {
      await supabase.from('webhook_log').upsert({
        reference,
        status:      'failed',
        duration_ms: Date.now() - startTime,
        raw_payload: { ...event, _error: err.message },
      }, { onConflict: 'reference' });
    } catch { /* non-fatal */ }
    // Return 200 to prevent Paystack retry storms
  }

  return NextResponse.json({ ok: true });
}

// ─── TICKET HANDLER ───────────────────────────────────────────
async function processTicket(supabase, data, meta) {
  const {
    event_id, tier_id, guest_email, guest_name,
    reseller_code, event_reseller_id, is_reseller_purchase,
    base_price, platform_fee, reseller_commission, quantity = 1,
  } = meta;

  if (!event_id || !tier_id || !guest_email) throw new Error('Missing ticket metadata');

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

  // FIX: was .single() with no await guard needed here as result is destructured immediately
  // but we add try/catch to be safe
  let tier = null;
  try {
    const { data: tierData } = await supabase
      .from('ticket_tiers')
      .select('max_quantity,name')
      .eq('id', tier_id)
      .single();
    tier = tierData;
  } catch { /* tier not found — proceed without cap check */ }

  if (tier?.max_quantity > 0) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('tier_id', tier_id)
      .eq('status', 'valid');
    if ((count || 0) + qty > tier.max_quantity) {
      console.error(`[WEBHOOK] Oversell prevented for tier ${tier_id}`);
      return;
    }
  }

  // ── Resolve phone BEFORE insert so it lives on the ticket row ──────
  const customFields          = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
  const phoneFromCustomFields = customFields.find(f => f.variable_name === 'guest_phone')?.value || null;
  const phoneFromCustomer     = data.customer?.phone ? String(data.customer.phone).trim() : null;
  const smsPhone =
    (meta.guest_phone       && String(meta.guest_phone).trim())      ||
    (phoneFromCustomFields   && String(phoneFromCustomFields).trim()) ||
    phoneFromCustomer                                                 ||
    null;

  console.log(
    `[WEBHOOK] Phone — guest_phone=${meta.guest_phone || 'none'} | ` +
    `custom_fields=${phoneFromCustomFields || 'none'} | ` +
    `customer.phone=${phoneFromCustomer || 'none'} → ${smsPhone || 'NONE'}`
  );

  // Build ticket rows — guest_phone saved directly so the admin never
  // has to dig through webhook_log.raw_payload
  const tickets = Array.from({ length: qty }, () => ({
    event_id,
    tier_id,
    tier_name:            tier?.name || '',
    reference:            data.reference,
    ticket_number:        generateTicketNumber(),
    guest_email:          guest_email.trim().toLowerCase(),
    guest_name:           guest_name || 'Guest',
    guest_phone:          normalisePhone(smsPhone) || smsPhone || null,
    amount:               base_price || (data.amount / 100 / qty),
    base_amount:          base_price || (data.amount / 100 / qty),
    platform_fee:         platform_fee || 0,
    is_reseller_purchase: is_reseller_purchase || false,
    reseller_code:        reseller_code || 'DIRECT',
    event_reseller_id:    event_reseller_id || null,
    status:               'valid',
    is_scanned:           false,
  }));

  const { error: insertError } = await supabase.from('tickets').insert(tickets);
  if (insertError) throw insertError;

  // ── Update event tickets_sold counter ────────────────────────
  // FIX: .rpc(...).catch(() => { supabase.from(...).single().then(...) })
  // Both the .catch() on rpc AND the .single().then() inside were broken.
  // Now: try/catch the rpc, then try/catch the fallback separately.
  try {
    await supabase.rpc('increment_event_tickets_sold', { event_id_param: event_id, amount: qty });
  } catch {
    // RPC failed — fallback to direct update
    try {
      const { data: ev } = await supabase
        .from('events')
        .select('tickets_sold')
        .eq('id', event_id)
        .single();
      await supabase
        .from('events')
        .update({ tickets_sold: (ev?.tickets_sold || 0) + qty })
        .eq('id', event_id);
    } catch (fallbackErr) {
      console.warn('[WEBHOOK] tickets_sold counter fallback also failed:', fallbackErr.message);
    }
  }

  // ── Update reseller stats ─────────────────────────────────────
  if (is_reseller_purchase && event_reseller_id) {
    const earned = (reseller_commission || 0) * qty;
    // FIX: was .single().catch(() => ({ data: null }))
    let er = null;
    try {
      const { data: erData } = await supabase
        .from('event_resellers')
        .select('tickets_sold,total_earned')
        .eq('id', event_reseller_id)
        .single();
      er = erData;
    } catch { /* not found — default to 0 */ }

    // FIX: was .update(...).eq(...).catch(() => {})
    try {
      await supabase.from('event_resellers').update({
        tickets_sold: (er?.tickets_sold || 0) + qty,
        total_earned: parseFloat(((er?.total_earned || 0) + earned).toFixed(2)),
      }).eq('id', event_reseller_id);
    } catch (err) {
      console.warn('[WEBHOOK] Failed to update reseller stats:', err.message);
    }
  }

  // ── Payout ledger ─────────────────────────────────────────────
  const orgOwes = meta.organizer_owes || (base_price * qty) || 0;
  const resOwes = meta.reseller_owes  || (is_reseller_purchase ? (reseller_commission || 0) * qty : 0);
  // FIX: was .insert(...).catch(() => {})
  try {
    await supabase.from('payout_ledger').insert({
      reference:         data.reference,
      event_id,
      organizer_id:      meta.organizer_id || null,
      event_reseller_id: is_reseller_purchase ? event_reseller_id : null,
      transaction_type:  'TICKET',
      total_collected:   data.amount / 100,
      organizer_owes:    parseFloat(orgOwes.toFixed(2)),
      reseller_owes:     parseFloat(resOwes.toFixed(2)),
      platform_keeps:    parseFloat((data.amount / 100 - orgOwes - resOwes).toFixed(2)),
      status:            'pending',
      notes:             `${qty}x ${tier?.name || 'ticket'} for ${guest_email}`,
    });
  } catch (err) {
    console.warn('[WEBHOOK] Failed to write payout_ledger:', err.message);
  }

  // ── SMS ──────────────────────────────────────────────────────
  const BASE_URL      = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
  const ticketNumbers = tickets.map(t => t.ticket_number).join(', ');

  if (smsPhone) {
    const message = [
      'OUSTED: Payment confirmed!',
      `Event: ${meta.event_title || 'Your event'}`,
      `${tier?.name || meta.tier_name || 'Ticket'} x${qty}`,
      `Ticket(s): ${ticketNumbers}`,
      `Ref: ${data.reference}`,
      `${BASE_URL}/tickets/find?ref=${encodeURIComponent(data.reference)}`,
    ].join('\n');

    const smsResult = await sendSMS(smsPhone, message);
    console.log(`[WEBHOOK] SMS result:`, JSON.stringify(smsResult));
    await logSMS(supabase, { reference: data.reference, phone: smsPhone, message, result: smsResult, channel: 'web' });
  } else {
    console.warn(`[WEBHOOK] No phone for ${guest_email} — SMS skipped`);
    await logSMS(supabase, {
      reference: data.reference,
      phone:     guest_email,
      message:   '(skipped — no phone at checkout)',
      result:    { success: false, error: 'no_phone_provided' },
      channel:   'web',
    });
  }

  console.log(`[WEBHOOK] ✅ ${qty} ticket(s) for ${guest_email} | ref: ${data.reference}`);
}

// ─── VOTE HANDLER ─────────────────────────────────────────────
async function processVote(supabase, data, meta) {
  const {
    candidate_id, candidate_name, contest_id,
    vote_count, voter_email, voter_name,
    vote_price, platform_fee, competition_id,
  } = meta;

  if (!candidate_id || !vote_count) throw new Error('Missing vote metadata');

  const votes = parseInt(vote_count, 10);

  // FIX: was .upsert(...).catch(() => {})
  try {
    await supabase.from('vote_transactions').upsert({
      reference:     data.reference,
      candidate_id,
      contest_id,
      competition_id,
      voter_email:   voter_email?.toLowerCase(),
      voter_name:    voter_name || 'Anonymous',
      vote_count:    votes,
      vote_price:    vote_price || 0,
      platform_fee:  platform_fee || 0,
      amount_paid:   data.amount / 100,
      status:        'confirmed',
    }, { onConflict: 'reference' });
  } catch (err) {
    console.warn('[WEBHOOK] Failed to write vote_transactions:', err.message);
  }

  const { error: rpcError } = await supabase.rpc('increment_vote_count', {
    p_candidate_id:   candidate_id,
    p_vote_increment: votes,
  });
  if (rpcError) {
    // FIX: was .single() with no error handling inside .catch()
    try {
      const { data: cand } = await supabase
        .from('candidates')
        .select('vote_count')
        .eq('id', candidate_id)
        .single();
      await supabase
        .from('candidates')
        .update({ vote_count: (cand?.vote_count || 0) + votes })
        .eq('id', candidate_id);
    } catch (fallbackErr) {
      console.warn('[WEBHOOK] vote_count fallback failed:', fallbackErr.message);
    }
  }

  const voteOrgOwes = meta.organizer_owes || (vote_price * votes) || 0;
  // FIX: was .insert(...).catch(() => {})
  try {
    await supabase.from('payout_ledger').insert({
      reference:         data.reference,
      event_id:          null,
      organizer_id:      meta.organizer_id || null,
      event_reseller_id: null,
      transaction_type:  'VOTE',
      total_collected:   data.amount / 100,
      organizer_owes:    parseFloat(voteOrgOwes.toFixed(2)),
      reseller_owes:     0,
      platform_keeps:    parseFloat((data.amount / 100 - voteOrgOwes).toFixed(2)),
      contest_id:        contest_id || null,
      competition_id:    competition_id || null,
      status:            'pending',
      notes:             `${votes} vote(s) for ${candidate_name}`,
    });
  } catch (err) {
    console.warn('[WEBHOOK] Failed to write payout_ledger (vote):', err.message);
  }

  console.log(`[WEBHOOK] ✅ ${votes} vote(s) for ${candidate_name} | ref: ${data.reference}`);

  // Vote SMS
  const customVoteFields    = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
  const phoneFromVoteFields = customVoteFields.find(f => f.variable_name === 'voter_phone')?.value || null;
  const phoneFromCustomer   = data.customer?.phone ? String(data.customer.phone).trim() : null;
  const voteSmsPhone =
    (meta.voter_phone      && String(meta.voter_phone).trim())     ||
    (phoneFromVoteFields   && String(phoneFromVoteFields).trim())  ||
    phoneFromCustomer                                              ||
    null;

  if (voteSmsPhone) {
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
    const message  = [
      'OUSTED: Votes confirmed!',
      `Voted for: ${candidate_name}`,
      `Votes cast: ${votes}`,
      `Contest: ${meta.contest_title || 'Contest'}`,
      `Ref: ${data.reference}`,
      `${BASE_URL}/voting`,
    ].join('\n');

    const voteSmsResult = await sendSMS(voteSmsPhone, message);
    console.log(`[WEBHOOK] Vote SMS:`, JSON.stringify(voteSmsResult));
    await logSMS(supabase, { reference: data.reference, phone: voteSmsPhone, message, result: voteSmsResult, channel: 'web' });
  }
}
