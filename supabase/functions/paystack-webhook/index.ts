// OUSTED Supabase Edge Function — Paystack webhook
// This is a BACKUP receiver only. The primary webhook handler is
// app/api/webhooks/paystack/route.js (Next.js). Do NOT point Paystack
// at this URL as the primary — it cannot import shared helpers and
// does not handle USSD logic. Only deploy if you need a secondary
// endpoint for redundancy or local Supabase dev testing.
//
// Fixes applied vs original:
//   - Correct import: @supabase/supabase-js (was @supabase/supabase-client@2)
//   - Full metadata extraction (guest_phone, tier_name, quantity, reseller fields)
//   - SMS via Arkesel after ticket creation
//   - Proper idempotency via webhook_log
//   - Payout ledger entry
//   - Vote SMS
//   - Transfer status updates kept

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
const ARKESEL_API_KEY     = Deno.env.get('ARKESEL_API_KEY')     ?? '';
const ARKESEL_SENDER_ID   = Deno.env.get('ARKESEL_SENDER_ID')   ?? 'OUSTED';
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')               ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  ?? '';
const BASE_URL = Deno.env.get('NEXT_PUBLIC_BASE_URL') ?? 'https://ousted.live';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// ─── HELPERS ──────────────────────────────────────────────────

function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))   return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return '+' + p.replace(/^\+/, '');
  return null;
}

function generateTicketNumber(): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OT-${ts}-${rand}`;
}

async function sendSMS(phone: string, message: string): Promise<void> {
  if (!ARKESEL_API_KEY) { console.warn('[SMS] ARKESEL_API_KEY not set'); return; }
  const e164 = normalisePhone(phone);
  if (!e164) { console.warn(`[SMS] Cannot normalise phone: ${phone}`); return; }
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': ARKESEL_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: ARKESEL_SENDER_ID, message, recipients: [e164] }),
    });
    const data = await res.json();
    console.log(`[SMS] Arkesel → ${e164}:`, JSON.stringify(data));
  } catch (err) {
    console.error('[SMS] Network error:', err);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const signature = req.headers.get('x-paystack-signature');
  if (!signature) return new Response('Missing Signature', { status: 401, headers: corsHeaders });

  const rawBody = await req.text();

  // HMAC-SHA512 verification using Web Crypto (Deno-compatible)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(PAYSTACK_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-512' }, false, ['verify']
  );
  const hexToBytes = (hex: string) =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
  const isValid = await crypto.subtle.verify('HMAC', key, hexToBytes(signature), encoder.encode(rawBody));
  if (!isValid) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return new Response('OK', { status: 200, headers: corsHeaders }); }

  const { event, data } = body;

  // ── TRANSFER STATUS UPDATES (payout tracking) ─────────────────
  const transferStatuses: Record<string, string> = {
    'transfer.success': 'completed',
    'transfer.failed': 'failed',
    'transfer.reversed': 'reversed',
  };
  if (transferStatuses[event]) {
    await supabase.from('payouts').update({ status: transferStatuses[event] }).eq('paystack_transfer_code', data.transfer_code);
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (event !== 'charge.success') {
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const { reference, metadata: meta = {}, amount, customer } = data;

  // ── IDEMPOTENCY ───────────────────────────────────────────────
  const { data: existing } = await supabase.from('webhook_log').select('status').eq('reference', reference).single().catch(() => ({ data: null }));
  if (existing?.status === 'processed') {
    return new Response(JSON.stringify({ received: true, note: 'already_processed' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  await supabase.from('webhook_log').upsert({ reference, status: 'processing', raw_payload: body }, { onConflict: 'reference' }).catch(() => {});

  try {
    if (meta.type === 'TICKET') {
      await handleTicket(supabase, data, meta, customer);
    } else if (meta.type === 'VOTE') {
      await handleVote(supabase, data, meta, customer);
    }

    await supabase.from('webhook_log').upsert({ reference, status: 'processed', raw_payload: body }, { onConflict: 'reference' }).catch(() => {});
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[EDGE] Processing error:', err.message);
    await supabase.from('webhook_log').upsert({ reference, status: 'failed', raw_payload: { ...body, _error: err.message } }, { onConflict: 'reference' }).catch(() => {});
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function handleTicket(supabase: any, data: any, meta: any, customer: any) {
  const {
    event_id, tier_id, guest_name, guest_email: metaEmail,
    base_price, platform_fee, reseller_code, event_reseller_id,
    is_reseller_purchase, reseller_commission,
    quantity = 1, organizer_id, organizer_owes, reseller_owes,
  } = meta;

  const resolvedEmail = (metaEmail || customer?.email || '').toLowerCase();
  if (!event_id || !tier_id || !resolvedEmail) throw new Error('Missing required ticket fields');

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));

  // Fetch tier name for ticket records
  const { data: tier } = await supabase.from('ticket_tiers').select('name,max_quantity').eq('id', tier_id).single().catch(() => ({ data: null }));

  // Capacity guard
  if (tier?.max_quantity > 0) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tier_id).eq('status', 'valid');
    if ((count || 0) + qty > tier.max_quantity) {
      console.error(`[EDGE] Oversell prevented tier=${tier_id}`);
      return;
    }
  }

  const tickets = Array.from({ length: qty }, () => ({
    event_id,
    tier_id,
    tier_name: tier?.name || meta.tier_name || '',
    reference: data.reference,
    ticket_number: generateTicketNumber(),
    guest_email: resolvedEmail,
    guest_name: guest_name || customer?.name || 'Guest',
    amount: base_price || (data.amount / 100 / qty),
    base_amount: base_price || (data.amount / 100 / qty),
    platform_fee: platform_fee || 0,
    is_reseller_purchase: is_reseller_purchase || false,
    reseller_code: reseller_code || 'DIRECT',
    event_reseller_id: event_reseller_id || null,
    status: 'valid',
    is_scanned: false,
  }));

  const { error: insertErr } = await supabase.from('tickets').insert(tickets);
  if (insertErr) throw insertErr;

  // Tickets sold counter
  await supabase.rpc('increment_event_tickets_sold', { event_id_param: event_id, amount: qty }).catch(() => {});

  // Payout ledger
  const orgOwes  = organizer_owes  ?? parseFloat(((base_price || 0) * qty).toFixed(2));
  const resOwes  = reseller_owes   ?? parseFloat(((is_reseller_purchase ? (reseller_commission || 0) : 0) * qty).toFixed(2));
  await supabase.from('payout_ledger').insert({
    reference: data.reference,
    event_id,
    organizer_id: organizer_id || null,
    event_reseller_id: is_reseller_purchase ? event_reseller_id : null,
    transaction_type: 'TICKET',
    total_collected: data.amount / 100,
    organizer_owes: orgOwes,
    reseller_owes: resOwes,
    platform_keeps: parseFloat((data.amount / 100 - orgOwes - resOwes).toFixed(2)),
    status: 'pending',
    notes: `${qty}x ${tier?.name || 'ticket'} (edge fn)`,
  }).catch(() => {});

  // SMS
  const customFields: any[] = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
  const cfPhone = customFields.find((f: any) => f.variable_name === 'guest_phone')?.value || null;
  const smsPhone = meta.guest_phone || cfPhone || customer?.phone || null;

  console.log(`[EDGE] SMS — guest_phone=${meta.guest_phone || 'none'} cf=${cfPhone || 'none'} customer.phone=${customer?.phone || 'none'} → ${smsPhone || 'NONE'}`);

  if (smsPhone) {
    const ticketNumbers = tickets.map((t: any) => t.ticket_number).join(', ');
    await sendSMS(smsPhone, [
      'OUSTED: Payment confirmed!',
      `Event: ${meta.event_title || 'Your event'}`,
      `${tier?.name || meta.tier_name || 'Ticket'} x${qty}`,
      `Ticket(s): ${ticketNumbers}`,
      `Ref: ${data.reference}`,
      `${BASE_URL}/tickets/find?ref=${encodeURIComponent(data.reference)}`,
    ].join('\n'));
  }

  console.log(`[EDGE] ✅ ${qty} ticket(s) for ${resolvedEmail} | ref: ${data.reference}`);
}

async function handleVote(supabase: any, data: any, meta: any, customer: any) {
  const { candidate_id, candidate_name, contest_id, competition_id, vote_count, voter_email, voter_name, vote_price, platform_fee, organizer_id, organizer_owes } = meta;
  if (!candidate_id || !vote_count) throw new Error('Missing vote metadata');
  const votes = parseInt(vote_count, 10);

  await supabase.from('vote_transactions').upsert({
    reference: data.reference,
    candidate_id, contest_id, competition_id,
    voter_email: (voter_email || customer?.email || '').toLowerCase(),
    voter_name: voter_name || 'Anonymous',
    vote_count: votes,
    vote_price: vote_price || 0,
    platform_fee: platform_fee || 0,
    amount_paid: data.amount / 100,
    status: 'confirmed',
  }, { onConflict: 'reference' }).catch(() => {});

  const { error: rpcErr } = await supabase.rpc('increment_vote_count', { p_candidate_id: candidate_id, p_vote_increment: votes });
  if (rpcErr) {
    const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', candidate_id).single();
    await supabase.from('candidates').update({ vote_count: (cand?.vote_count || 0) + votes }).eq('id', candidate_id);
  }

  const orgOwes = organizer_owes ?? parseFloat(((vote_price || 0) * votes).toFixed(2));
  await supabase.from('payout_ledger').insert({
    reference: data.reference,
    event_id: null,
    organizer_id: organizer_id || null,
    transaction_type: 'VOTE',
    total_collected: data.amount / 100,
    organizer_owes: orgOwes,
    reseller_owes: 0,
    platform_keeps: parseFloat((data.amount / 100 - orgOwes).toFixed(2)),
    contest_id: contest_id || null,
    competition_id: competition_id || null,
    status: 'pending',
    notes: `${votes} vote(s) for ${candidate_name} (edge fn)`,
  }).catch(() => {});

  console.log(`[EDGE] ✅ ${votes} vote(s) for ${candidate_name} | ref: ${data.reference}`);

  // SMS for votes
  const customVoteFields: any[] = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
  const cfVotePhone = customVoteFields.find((f: any) => f.variable_name === 'voter_phone')?.value || null;
  const voteSmsPhone = meta.voter_phone || cfVotePhone || customer?.phone || null;
  if (voteSmsPhone) {
    await sendSMS(voteSmsPhone, [
      'OUSTED: Votes confirmed!',
      `Voted for: ${candidate_name}`,
      `Votes cast: ${votes}`,
      `Contest: ${meta.contest_title || 'Contest'}`,
      `Ref: ${data.reference}`,
      `${BASE_URL}/voting`,
    ].join('\n'));
  }
}
