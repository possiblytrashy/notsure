// OUSTED CHECKOUT ENGINE v3.0
// Pricing model: organizer keeps their full set price. Platform adds 5% on top. Reseller adds 10% on top.
// Direct:  buyer pays price × 1.05 → organizer gets price, platform gets price × 0.05
// Reseller: buyer pays price × 1.15 → organizer gets price, reseller gets price × 0.10, platform gets price × 0.05
// Voting:  buyer pays vote_price × 1.05 → organizer gets vote_price, platform gets vote_price × 0.05

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function sanitize(s, n = 200) { return String(s || '').trim().replace(/[<>"'`]/g, '').substring(0, n); }

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

  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!tier_id || !event_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const qty = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));
  const normalizedEmail = email.trim().toLowerCase();
  const safeName = sanitize(guest_name || 'Guest', 100);
  const safeCode = sanitize(reseller_code || 'DIRECT', 50);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: tier, error: tierError } = await supabase
    .from('ticket_tiers')
    .select(`id,name,price,max_quantity,events!inner(id,title,allows_resellers,organizer_profile_id,organizers:organizer_profile_id(paystack_subaccount_code))`)
    .eq('id', tier_id).single();

  if (tierError || !tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });

  // Capacity check
  if (tier.max_quantity > 0) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('tier_id', tier_id).eq('status', 'valid');
    const available = tier.max_quantity - (count || 0);
    if (available < qty) return NextResponse.json({ error: `Only ${available} ticket${available === 1 ? '' : 's'} remaining`, remaining: available }, { status: 409 });
  }

  const organizerSubaccount = tier.events?.organizers?.paystack_subaccount_code;
  if (!organizerSubaccount) return NextResponse.json({ error: 'Event payment setup incomplete. Contact the organizer.' }, { status: 400 });

  // ── PRICING MODEL ────────────────────────────────────────────────
  // Organizer keeps their full price. Platform fee (5%) is ADDED ON TOP.
  // Reseller markup (10%) is ALSO ADDED ON TOP. Platform still gets 5% of base.
  const basePrice = Number(tier.price); // organizer's set price per ticket

  // Reseller lookup
  let resellerData = null;
  let isResellerPurchase = false;
  if (safeCode !== 'DIRECT' && tier.events.allows_resellers) {
    const { data: er } = await supabase
      .from('event_resellers')
      .select(`*,resellers:reseller_id(id,paystack_subaccount_code)`)
      .eq('unique_code', safeCode).eq('event_id', event_id).single();
    if (er?.resellers?.paystack_subaccount_code) { resellerData = er; isResellerPurchase = true; }
  }

  const platformFeePerTicket = basePrice * 0.05;                         // 5% of organizer price
  const resellerMarkupPerTicket = isResellerPurchase ? basePrice * 0.10 : 0; // 10% of organizer price
  const buyerPricePerTicket = basePrice + platformFeePerTicket + resellerMarkupPerTicket;
  const totalBuyerAmount = buyerPricePerTicket * qty;

  // Convert to pesewas (GHS × 100)
  const totalAmountPesewas = Math.round(totalBuyerAmount * 100);
  const organizerSharePesewas = Math.round(basePrice * qty * 100);         // organizer gets full base
  const platformFeePesewas = Math.round(platformFeePerTicket * qty * 100); // platform gets 5% of base
  const resellerSharePesewas = Math.round(resellerMarkupPerTicket * qty * 100); // reseller gets 10% of base

  const paystackPayload = {
    email: normalizedEmail,
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?payment=success`,
    metadata: {
      type: 'TICKET', event_id, tier_id,
      guest_email: normalizedEmail, guest_name: safeName,
      reseller_code: safeCode, event_reseller_id: resellerData?.id || null,
      is_reseller_purchase: isResellerPurchase,
      base_price: basePrice,                           // organizer's set price
      buyer_price: buyerPricePerTicket,                // what buyer actually paid per ticket
      platform_fee: platformFeePerTicket,              // 5% platform fee per ticket
      reseller_commission: resellerMarkupPerTicket,    // 10% reseller per ticket
      quantity: qty,
      custom_fields: [
        { display_name: 'Event', variable_name: 'event_title', value: tier.events.title },
        { display_name: 'Guest Name', variable_name: 'guest_name', value: safeName },
        { display_name: 'Tier', variable_name: 'tier_name', value: tier.name },
        { display_name: 'Quantity', variable_name: 'quantity', value: String(qty) },
        { display_name: 'Organizer Receives', variable_name: 'organizer_amount', value: `GHS ${(basePrice * qty).toFixed(2)}` },
        { display_name: 'Platform Fee', variable_name: 'platform_fee', value: `GHS ${(platformFeePerTicket * qty).toFixed(2)}` }
      ]
    }
  };

  // ── PAYSTACK SPLIT CONFIGURATION ────────────────────────────────
  if (isResellerPurchase && resellerData?.resellers?.paystack_subaccount_code) {
    // 3-way split: buyer pays base + 10% + 5%, all split precisely
    paystackPayload.split = {
      type: 'flat',
      bearer_type: 'account', // main account (platform) bears Paystack processing fees
      subaccounts: [
        { subaccount: organizerSubaccount, share: organizerSharePesewas },
        { subaccount: resellerData.resellers.paystack_subaccount_code, share: resellerSharePesewas }
        // platform_fee stays with main account (remainder)
      ]
    };
  } else {
    // 2-way: buyer pays base + 5%, organizer gets base, platform gets 5%
    paystackPayload.subaccount = organizerSubaccount;
    paystackPayload.transaction_charge = platformFeePesewas; // platform keeps this
    paystackPayload.bearer = 'account'; // platform bears Paystack's own processing fee
  }

  // Track reseller click
  if (isResellerPurchase && resellerData?.id) {
    supabase.rpc('increment_reseller_clicks', { link_id: resellerData.id }).catch(() => {});
  }

  const result = await initPaystack(paystackPayload);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference: result.reference,
    summary: {
      base_price: basePrice,
      platform_fee: platformFeePerTicket,
      reseller_markup: resellerMarkupPerTicket,
      total_per_ticket: buyerPricePerTicket,
      total: totalBuyerAmount,
      quantity: qty
    }
  });
}

async function handleVotePurchase(body) {
  const { candidate_id, vote_count, email, voter_name } = body;

  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!candidate_id || !vote_count || vote_count < 1) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();
  const safeName = sanitize(voter_name || 'Anonymous', 100);
  const votes = Math.max(1, Math.min(1000, parseInt(vote_count, 10)));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: candidate } = await supabase
    .from('candidates')
    .select(`id,name,contest_id,contests:contest_id(id,title,vote_price,is_active,organizer_id,competition_id,competitions:competition_id(id,title,organizer_id))`)
    .eq('id', candidate_id).single();

  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  if (!candidate.contests?.is_active) return NextResponse.json({ error: 'Voting is paused for this category' }, { status: 400 });

  const organizerId = candidate.contests?.competitions?.organizer_id || candidate.contests?.organizer_id;
  const { data: organizer } = await supabase
    .from('organizers')
    .select('paystack_subaccount_code')
    .eq('user_id', organizerId).single();

  if (!organizer?.paystack_subaccount_code) return NextResponse.json({ error: 'Organizer payment setup incomplete' }, { status: 400 });

  // ── VOTE PRICING ─────────────────────────────────────────────────
  // Organizer sets vote_price. Platform adds 5% on top. Voter pays vote_price × 1.05
  const votePrice = Number(candidate.contests.vote_price); // organizer's set price per vote
  const platformFeePerVote = votePrice * 0.05;
  const buyerPricePerVote = votePrice + platformFeePerVote;
  const totalAmount = buyerPricePerVote * votes;
  const totalAmountPesewas = Math.round(totalAmount * 100);
  const organizerSharePesewas = Math.round(votePrice * votes * 100);
  const platformFeePesewas = Math.round(platformFeePerVote * votes * 100);

  const paystackPayload = {
    email: normalizedEmail,
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/user?payment=success`,
    metadata: {
      type: 'VOTE',
      candidate_id, candidate_name: candidate.name,
      contest_id: candidate.contests.id, contest_title: candidate.contests.title,
      competition_id: candidate.contests.competition_id,
      competition_title: candidate.contests.competitions?.title,
      vote_count: votes,
      voter_email: normalizedEmail, voter_name: safeName,
      vote_price: votePrice,           // organizer's set price
      buyer_price: buyerPricePerVote,  // what voter actually paid
      platform_fee: platformFeePerVote,
      custom_fields: [
        { display_name: 'Voting For', variable_name: 'candidate', value: candidate.name },
        { display_name: 'Voter Name', variable_name: 'voter_name', value: safeName },
        { display_name: 'Votes', variable_name: 'votes', value: String(votes) },
        { display_name: 'Platform Fee', variable_name: 'platform_fee', value: `GHS ${(platformFeePerVote * votes).toFixed(2)}` }
      ]
    },
    subaccount: organizer.paystack_subaccount_code,
    transaction_charge: platformFeePesewas, // platform keeps 5% of base vote_price
    bearer: 'account'
  };

  const result = await initPaystack(paystackPayload);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference: result.reference,
    summary: {
      candidate_name: candidate.name,
      vote_price: votePrice,
      platform_fee: platformFeePerVote,
      total_per_vote: buyerPricePerVote,
      total: totalAmount,
      votes
    }
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
