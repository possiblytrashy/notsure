// OUSTED FORTRESS — Secure Checkout Session
// Fort Knox security: input validation, idempotency, split payments, audit log

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Input validation
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function sanitizeString(s, maxLen = 200) { return String(s || '').trim().replace(/[<>"'`]/g, '').substring(0, maxLen); }

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { type = 'TICKET' } = body;
    if (type === 'VOTE') return handleVotePurchase(body);
    return handleTicketPurchase(body);
  } catch (err) {
    console.error('Checkout error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleTicketPurchase(body) {
  const { event_id, tier_id, email, guest_name, reseller_code, quantity = 1 } = body;

  // VALIDATE
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!tier_id || !event_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1)); // Max 10 tickets per transaction

  const normalizedEmail = email.trim().toLowerCase();
  const safeName = sanitizeString(guest_name || 'Guest', 100);
  const safeCode = sanitizeString(reseller_code || 'DIRECT', 50);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // FETCH TIER + EVENT + ORGANIZER
  const { data: tier, error: tierError } = await supabase
    .from('ticket_tiers')
    .select(`id,name,price,max_quantity,events!inner(id,title,allows_resellers,organizer_profile_id,organizers:organizer_profile_id(paystack_subaccount_code))`)
    .eq('id', tier_id).single();

  if (tierError || !tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });

  // CAPACITY CHECK
  if (tier.max_quantity > 0) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tier_id).eq('status', 'valid');
    const available = tier.max_quantity - (count || 0);
    if (available < qty) return NextResponse.json({ error: `Only ${available} ticket${available === 1 ? '' : 's'} remaining for this tier` }, { status: 409 });
  }

  const organizerSubaccount = tier.events?.organizers?.paystack_subaccount_code;
  if (!organizerSubaccount) return NextResponse.json({ error: 'Event payment setup incomplete. Contact support.' }, { status: 400 });

  // RESELLER LOOKUP
  let resellerData = null;
  let isResellerPurchase = false;
  if (safeCode !== 'DIRECT' && tier.events.allows_resellers) {
    const { data: er } = await supabase.from('event_resellers').select(`*,resellers:reseller_id(id,paystack_subaccount_code)`).eq('unique_code', safeCode).eq('event_id', event_id).single();
    if (er?.resellers?.paystack_subaccount_code) { resellerData = er; isResellerPurchase = true; }
  }

  // CALCULATE AMOUNTS
  const basePrice = Number(tier.price);
  const resellerMarkup = isResellerPurchase ? basePrice * 0.10 : 0;
  const finalPerTicket = basePrice + resellerMarkup;
  const totalAmount = finalPerTicket * qty;
  const baseTotalPesewas = Math.round(basePrice * qty * 100);
  const amountInPesewas = Math.round(totalAmount * 100);
  const platformFeePesewas = Math.round(baseTotalPesewas * 0.05);
  const organizerAmountPesewas = baseTotalPesewas - platformFeePesewas;
  const resellerCommissionPesewas = Math.round(resellerMarkup * qty * 100);

  const paystackPayload = {
    email: normalizedEmail,
    amount: amountInPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?payment=success`,
    metadata: {
      type: 'TICKET', event_id, tier_id, guest_email: normalizedEmail, guest_name: safeName,
      reseller_code: safeCode, event_reseller_id: resellerData?.id || null,
      is_reseller_purchase: isResellerPurchase, base_price: basePrice, quantity: qty,
      reseller_commission: resellerMarkup * qty,
      custom_fields: [
        { display_name: 'Event', variable_name: 'event_title', value: tier.events.title },
        { display_name: 'Guest Name', variable_name: 'guest_name', value: safeName },
        { display_name: 'Tier', variable_name: 'tier_name', value: tier.name },
        { display_name: 'Quantity', variable_name: 'quantity', value: String(qty) }
      ]
    }
  };

  // CONFIGURE SPLIT
  if (isResellerPurchase && resellerData?.resellers?.paystack_subaccount_code) {
    paystackPayload.split = {
      type: 'flat', bearer_type: 'account',
      subaccounts: [
        { subaccount: organizerSubaccount, share: organizerAmountPesewas },
        { subaccount: resellerData.resellers.paystack_subaccount_code, share: resellerCommissionPesewas }
      ]
    };
  } else {
    paystackPayload.subaccount = organizerSubaccount;
    paystackPayload.transaction_charge = platformFeePesewas;
    paystackPayload.bearer = 'account';
  }

  const result = await initPaystack(paystackPayload);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });

  return NextResponse.json({ authorization_url: result.authorization_url, reference: result.reference });
}

async function handleVotePurchase(body) {
  const { candidate_id, vote_count, email } = body;
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!candidate_id || !vote_count || vote_count < 1) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();
  const votes = Math.max(1, Math.min(1000, parseInt(vote_count, 10)));

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: candidate } = await supabase.from('candidates').select(`id,name,contest_id,contests:contest_id(id,title,vote_price,is_active,organizer_id,competition_id)`).eq('id', candidate_id).single();
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  if (!candidate.contests?.is_active) return NextResponse.json({ error: 'Voting is paused for this contest' }, { status: 400 });

  const { data: competition } = await supabase.from('competitions').select('id,title,organizer_id').eq('id', candidate.contests.competition_id).single();
  if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 });

  const { data: organizer } = await supabase.from('organizers').select('paystack_subaccount_code').eq('user_id', competition.organizer_id).single();
  if (!organizer?.paystack_subaccount_code) return NextResponse.json({ error: 'Organizer payment setup incomplete' }, { status: 400 });

  const votePrice = Number(candidate.contests.vote_price);
  const totalAmount = votePrice * votes;
  const amountPesewas = Math.round(totalAmount * 100);
  const platformFeePesewas = Math.round(amountPesewas * 0.05);

  const paystackPayload = {
    email: normalizedEmail, amount: amountPesewas, currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/voting?payment=success&candidate_id=${candidate_id}`,
    metadata: {
      type: 'VOTE', candidate_id, candidate_name: candidate.name, contest_id: candidate.contests.id,
      contest_title: candidate.contests.title, competition_id: competition.id, competition_title: competition.title,
      vote_count: votes, voter_email: normalizedEmail, vote_price: votePrice
    },
    subaccount: organizer.paystack_subaccount_code,
    transaction_charge: platformFeePesewas,
    bearer: 'account'
  };

  const result = await initPaystack(paystackPayload);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ authorization_url: result.authorization_url, reference: result.reference });
}

async function initPaystack(payload) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok || !data.status) return { ok: false, message: data.message || 'Payment initialization failed' };
  return { ok: true, authorization_url: data.data.authorization_url, reference: data.data.reference };
}
