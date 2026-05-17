// OUSTED CHECKOUT ENGINE v4.0
// ALL payments go to the platform's main Paystack account.
// Organizer and reseller owed amounts are tracked in the DB via payout_ledger.
// Admin dashboard shows the ledger — manual transfers from there.
//
// Pricing (unchanged from buyer perspective):
//   Direct:   buyer pays price × 1.05 → platform collects all, owes organizer: price
//   Reseller: buyer pays price × 1.15 → platform collects all, owes organizer: price, owes reseller: price×0.10
//   Vote:     buyer pays vote_price × 1.05 → platform collects all, owes organizer: vote_price

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function sanitize(s, n = 200) { return String(s || '').trim().replace(/[<>"'`]/g, '').substring(0, n); }
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
    if (body.type === 'VOTE') return handleVotePurchase(body);
    return handleTicketPurchase(body);
  } catch (err) {
    console.error('Checkout error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function handleTicketPurchase(body) {
  const { event_id, tier_id, email, guest_name, guest_phone, reseller_code, quantity = 1 } = body;
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!tier_id || !event_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));
  const normalizedEmail = email.trim().toLowerCase();
  const safeName = sanitize(guest_name || 'Guest', 100);
  const safePhone = sanitize(guest_phone || '', 20);
  const safeCode = sanitize(reseller_code || 'DIRECT', 50);
  const supabase = getSupabase();

  const { data: tier, error: tierError } = await supabase
    .from('ticket_tiers')
    .select('id,name,price,max_quantity,events!inner(id,title,allows_resellers,organizer_id)')
    .eq('id', tier_id).single();
  if (tierError || !tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });

  if (tier.max_quantity > 0) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tier_id).eq('status', 'valid');
    const available = tier.max_quantity - (count || 0);
    if (available < qty) return NextResponse.json({ error: `Only ${available} ticket${available === 1 ? '' : 's'} remaining`, remaining: available }, { status: 409 });
  }

  const basePrice = Number(tier.price);
  const platformFeePerTicket = basePrice * 0.05;
  let resellerData = null, isResellerPurchase = false;
  if (safeCode !== 'DIRECT' && tier.events.allows_resellers) {
    const { data: er } = await supabase.from('event_resellers').select('*,resellers:reseller_id(id)').eq('unique_code', safeCode).eq('event_id', event_id).single();
    if (er?.id) { resellerData = er; isResellerPurchase = true; }
  }

  const resellerMarkupPerTicket = isResellerPurchase ? basePrice * 0.10 : 0;
  const buyerPricePerTicket = basePrice + platformFeePerTicket + resellerMarkupPerTicket;
  const totalBuyerAmount = buyerPricePerTicket * qty;
  const totalAmountPesewas = Math.round(totalBuyerAmount * 100);

  const result = await initPaystack({
    email: PLATFORM_EMAIL,
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/user?payment=success`,
    metadata: {
      type: 'TICKET', event_id, tier_id, tier_name: tier.name,
      event_title: tier.events.title, organizer_id: tier.events.organizer_id,
      guest_email: normalizedEmail, guest_name: safeName, guest_phone: safePhone,
      reseller_code: safeCode, event_reseller_id: resellerData?.id || null,
      is_reseller_purchase: isResellerPurchase,
      base_price: basePrice, buyer_price: buyerPricePerTicket,
      platform_fee: platformFeePerTicket, reseller_commission: resellerMarkupPerTicket, quantity: qty,
      organizer_owes: parseFloat((basePrice * qty).toFixed(2)),
      reseller_owes: parseFloat((resellerMarkupPerTicket * qty).toFixed(2)),
      custom_fields: [
        { display_name: 'Event',          variable_name: 'event_title',      value: tier.events.title },
        { display_name: 'Guest Name',     variable_name: 'guest_name',       value: safeName },
        { display_name: 'Guest Phone',    variable_name: 'guest_phone',      value: safePhone },
        { display_name: 'Tier',           variable_name: 'tier_name',        value: tier.name },
        { display_name: 'Qty',            variable_name: 'quantity',         value: String(qty) },
        { display_name: 'Organizer Gets', variable_name: 'organizer_amount', value: `GHS ${(basePrice * qty).toFixed(2)}` },
        { display_name: 'Platform Fee',   variable_name: 'platform_fee',     value: `GHS ${(platformFeePerTicket * qty).toFixed(2)}` },
      ]
    }
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  if (isResellerPurchase && resellerData?.id) supabase.rpc('increment_reseller_clicks', { link_id: resellerData.id }).catch(() => {});

  return NextResponse.json({
    authorization_url: result.authorization_url, reference: result.reference,
    summary: { base_price: basePrice, platform_fee: platformFeePerTicket, reseller_markup: resellerMarkupPerTicket, total_per_ticket: buyerPricePerTicket, total: totalBuyerAmount, quantity: qty }
  });
}

async function handleVotePurchase(body) {
  const { candidate_id, vote_count, email, voter_name } = body;
  if (!candidate_id || !vote_count || vote_count < 1) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const votes = Math.max(1, Math.min(1000, parseInt(vote_count, 10)));
  const safeName = sanitize(voter_name || 'Anonymous', 100);
  const voterEmail = isValidEmail(email) ? email.trim().toLowerCase() : 'anonymous@voter.ousted.live';
  const supabase = getSupabase();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id,name,contest_id,contests:contest_id(id,title,vote_price,is_active,organizer_id,competition_id,competitions:competition_id(id,title,organizer_id))')
    .eq('id', candidate_id).single();
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  if (!candidate.contests?.is_active) return NextResponse.json({ error: 'Voting is paused for this category' }, { status: 400 });

  const organizerId = candidate.contests?.competitions?.organizer_id || candidate.contests?.organizer_id;
  const votePrice = Number(candidate.contests.vote_price);
  const platformFeePerVote = votePrice * 0.05;
  const buyerPricePerVote = votePrice + platformFeePerVote;
  const totalAmount = buyerPricePerVote * votes;
  const totalAmountPesewas = Math.round(totalAmount * 100);

  const result = await initPaystack({
    email: PLATFORM_EMAIL,           // hardcoded — all vote money to platform
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/user?payment=success`,
    metadata: {
      type: 'VOTE', candidate_id, candidate_name: candidate.name,
      contest_id: candidate.contests.id, contest_title: candidate.contests.title,
      competition_id: candidate.contests.competition_id,
      competition_title: candidate.contests.competitions?.title,
      organizer_id: organizerId,
      vote_count: votes, voter_email: voterEmail, voter_name: safeName,
      vote_price: votePrice, buyer_price: buyerPricePerVote, platform_fee: platformFeePerVote,
      organizer_owes: parseFloat((votePrice * votes).toFixed(2)),
      reseller_owes: 0,
      custom_fields: [
        { display_name: 'Voting For',   variable_name: 'candidate',    value: candidate.name },
        { display_name: 'Votes',        variable_name: 'votes',        value: String(votes) },
        { display_name: 'Platform Fee', variable_name: 'platform_fee', value: `GHS ${(platformFeePerVote * votes).toFixed(2)}` }
      ]
    }
    // NO subaccount, NO split — 100% to platform Paystack account
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({
    authorization_url: result.authorization_url, reference: result.reference,
    summary: { candidate_name: candidate.name, vote_price: votePrice, platform_fee: platformFeePerVote, total_per_vote: buyerPricePerVote, total: totalAmount, votes }
  });
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
