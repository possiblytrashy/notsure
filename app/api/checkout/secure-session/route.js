// OUSTED CHECKOUT ENGINE v5.0
// ALL payments go to the platform's main Paystack account.
// Organizer and reseller owed amounts are tracked in DB via payout_ledger.
// Admin dashboard shows the ledger — manual transfers from there.
//
// PRICING (customer pays everything):
//   Direct:   base + 5% OUSTED fee + Paystack processing fee
//   Reseller: base + 10% reseller + 5% OUSTED fee + Paystack processing fee
//   Vote:     vote_price + 5% OUSTED fee + Paystack processing fee
//
// PAYSTACK FEE GROSS-UP (v5):
//   Ghana MoMo rate: 1.95% + GHS 0.50 per transaction
//   Formula: total_charged = (desired_net + 0.50) / (1 - 0.0195)
//   This ensures after Paystack deducts their fee we receive exactly desired_net.
//   Fee is shown as a separate named line in the checkout summary so buyers see it clearly.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PLATFORM_EMAIL = process.env.PLATFORM_EMAIL || 'payments@ousted.live';

// ─── PAYSTACK FEE CALCULATOR ──────────────────────────────────
// Ghana MoMo: 1.95% of total charged + GHS 0.50 fixed
// We gross up so the customer pays this on top; platform receives desired_net in full.
// Card users pay a slightly lower actual Paystack fee but are charged the MoMo rate
// since we can't know payment method at checkout time. The surplus (if any) stays with
// the platform. This is standard practice for Ghanaian ticketing platforms.
function calcPaystackFee(desiredNetGHS) {
  const RATE  = 0.0195;
  const FIXED = 0.50; // GHS
  // Solve: total = desired + (total * RATE + FIXED)
  //        total * (1 - RATE) = desired + FIXED
  //        total = (desired + FIXED) / (1 - RATE)
  const total = (desiredNetGHS + FIXED) / (1 - RATE);
  const fee   = total - desiredNetGHS;
  return {
    fee:   parseFloat(fee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function sanitize(s, n = 200) { return String(s || '').trim().replace(/[<>"'`]/g, '').substring(0, n); }
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
    if (body.type === 'VOTE') return handleVotePurchase(body);
    return handleTicketPurchase(body);
  } catch (err) {
    console.error('[CHECKOUT] Error:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── TICKET PURCHASE ──────────────────────────────────────────
async function handleTicketPurchase(body) {
  const { event_id, tier_id, email, guest_name, guest_phone, reseller_code, quantity = 1 } = body;
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  if (!tier_id || !event_id) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  const qty           = Math.max(1, Math.min(10, parseInt(quantity, 10) || 1));
  const normalizedEmail = email.trim().toLowerCase();
  const safeName      = sanitize(guest_name || 'Guest', 100);
  const safePhone     = sanitize(guest_phone || '', 20);
  const safeCode      = sanitize(reseller_code || 'DIRECT', 50);
  const supabase      = getSupabase();

  const { data: tier, error: tierError } = await supabase
    .from('ticket_tiers')
    .select('id,name,price,max_quantity,events!inner(id,title,allows_resellers,organizer_id)')
    .eq('id', tier_id)
    .single();
  if (tierError || !tier) return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });

  if (tier.max_quantity > 0) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('tier_id', tier_id)
      .eq('status', 'valid');
    const available = tier.max_quantity - (count || 0);
    if (available < qty) {
      return NextResponse.json({ error: `Only ${available} ticket${available === 1 ? '' : 's'} remaining`, remaining: available }, { status: 409 });
    }
  }

  const basePrice            = Number(tier.price);
  const platformFeePerTicket = basePrice * 0.05;

  // Reseller lookup
  let resellerData = null, isResellerPurchase = false;
  if (safeCode !== 'DIRECT' && tier.events.allows_resellers) {
    const { data: er } = await supabase
      .from('event_resellers')
      .select('*,resellers:reseller_id(id)')
      .eq('unique_code', safeCode)
      .eq('event_id', event_id)
      .single()
      .catch(() => ({ data: null }));
    if (er?.id) { resellerData = er; isResellerPurchase = true; }
  }

  const resellerMarkupPerTicket = isResellerPurchase ? basePrice * 0.10 : 0;

  // Sub-total per ticket (before Paystack fee)
  const subTotalPerTicket = basePrice + platformFeePerTicket + resellerMarkupPerTicket;

  // Paystack fee is charged per TRANSACTION (not per ticket), so gross-up on total transaction
  const subTotalTransaction    = subTotalPerTicket * qty;
  const { fee: paystackFee, total: buyerTotal } = calcPaystackFee(subTotalTransaction);
  const paystackFeePerTicket   = parseFloat((paystackFee / qty).toFixed(2));
  const buyerPricePerTicket    = parseFloat((buyerTotal / qty).toFixed(2));

  const totalAmountPesewas = Math.round(buyerTotal * 100);

  const result = await initPaystack({
    email: PLATFORM_EMAIL,
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/user?payment=success`,
    metadata: {
      type:                 'TICKET',
      event_id,
      tier_id,
      tier_name:            tier.name,
      event_title:          tier.events.title,
      organizer_id:         tier.events.organizer_id,
      guest_email:          normalizedEmail,
      guest_name:           safeName,
      guest_phone:          safePhone,
      reseller_code:        safeCode,
      event_reseller_id:    resellerData?.id || null,
      is_reseller_purchase: isResellerPurchase,
      base_price:           basePrice,
      buyer_price:          buyerPricePerTicket,
      platform_fee:         platformFeePerTicket,
      paystack_fee:         paystackFeePerTicket,
      reseller_commission:  resellerMarkupPerTicket,
      quantity:             qty,
      organizer_owes:       parseFloat((basePrice * qty).toFixed(2)),
      reseller_owes:        parseFloat((resellerMarkupPerTicket * qty).toFixed(2)),
      custom_fields: [
        { display_name: 'Event',                variable_name: 'event_title',      value: tier.events.title },
        { display_name: 'Guest Name',           variable_name: 'guest_name',       value: safeName },
        { display_name: 'Guest Phone',          variable_name: 'guest_phone',      value: safePhone },
        { display_name: 'Tier',                 variable_name: 'tier_name',        value: tier.name },
        { display_name: 'Qty',                  variable_name: 'quantity',         value: String(qty) },
        { display_name: 'Organizer Gets',       variable_name: 'organizer_amount', value: `GHS ${(basePrice * qty).toFixed(2)}` },
        { display_name: 'OUSTED Fee',           variable_name: 'platform_fee',     value: `GHS ${(platformFeePerTicket * qty).toFixed(2)}` },
        { display_name: 'Paystack Processing',  variable_name: 'paystack_fee',     value: `GHS ${paystackFee.toFixed(2)}` },
      ],
    },
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });

  if (isResellerPurchase && resellerData?.id) {
    supabase.rpc('increment_reseller_clicks', { link_id: resellerData.id }).catch(() => {});
  }

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference:         result.reference,
    summary: {
      base_price:         basePrice,
      platform_fee:       platformFeePerTicket,
      reseller_markup:    resellerMarkupPerTicket,
      paystack_fee:       paystackFeePerTicket,
      total_per_ticket:   buyerPricePerTicket,
      total:              buyerTotal,
      quantity:           qty,
      paystack_fee_total: paystackFee,
    },
  });
}

// ─── VOTE PURCHASE ────────────────────────────────────────────
async function handleVotePurchase(body) {
  const { candidate_id, vote_count, email, voter_name, voter_phone } = body;
  if (!candidate_id || !vote_count || vote_count < 1) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const votes          = Math.max(1, Math.min(1000, parseInt(vote_count, 10)));
  const safeName       = sanitize(voter_name || 'Anonymous', 100);
  const safeVoterPhone = sanitize(voter_phone || '', 20);
  const voterEmail     = isValidEmail(email) ? email.trim().toLowerCase() : 'anonymous@voter.ousted.live';
  const supabase       = getSupabase();

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id,name,contest_id,contests:contest_id(id,title,vote_price,is_active,organizer_id,competition_id,competitions:competition_id(id,title,organizer_id))')
    .eq('id', candidate_id)
    .single();
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  if (!candidate.contests?.is_active) return NextResponse.json({ error: 'Voting is paused for this category' }, { status: 400 });

  const organizerId       = candidate.contests?.competitions?.organizer_id || candidate.contests?.organizer_id;
  const votePrice         = Number(candidate.contests.vote_price);
  const platformFeePerVote = votePrice * 0.05;
  const subTotalVotes     = (votePrice + platformFeePerVote) * votes;

  const { fee: paystackFee, total: buyerTotal } = calcPaystackFee(subTotalVotes);
  const buyerPricePerVote = parseFloat(((votePrice + platformFeePerVote) + (paystackFee / votes)).toFixed(2));

  const totalAmountPesewas = Math.round(buyerTotal * 100);

  const result = await initPaystack({
    email: PLATFORM_EMAIL,
    amount: totalAmountPesewas,
    currency: 'GHS',
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/user?payment=success`,
    metadata: {
      type:               'VOTE',
      candidate_id,
      candidate_name:     candidate.name,
      contest_id:         candidate.contests.id,
      contest_title:      candidate.contests.title,
      competition_id:     candidate.contests.competition_id,
      competition_title:  candidate.contests.competitions?.title,
      organizer_id:       organizerId,
      vote_count:         votes,
      voter_email:        voterEmail,
      voter_name:         safeName,
      voter_phone:        safeVoterPhone,
      vote_price:         votePrice,
      buyer_price:        buyerPricePerVote,
      platform_fee:       platformFeePerVote,
      paystack_fee:       parseFloat((paystackFee / votes).toFixed(2)),
      organizer_owes:     parseFloat((votePrice * votes).toFixed(2)),
      reseller_owes:      0,
      custom_fields: [
        { display_name: 'Voting For',           variable_name: 'candidate',     value: candidate.name },
        { display_name: 'Votes',                variable_name: 'votes',         value: String(votes) },
        { display_name: 'Voter Phone',          variable_name: 'voter_phone',   value: safeVoterPhone },
        { display_name: 'OUSTED Fee',           variable_name: 'platform_fee',  value: `GHS ${(platformFeePerVote * votes).toFixed(2)}` },
        { display_name: 'Paystack Processing',  variable_name: 'paystack_fee',  value: `GHS ${paystackFee.toFixed(2)}` },
      ],
    },
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference:         result.reference,
    summary: {
      candidate_name:     candidate.name,
      vote_price:         votePrice,
      platform_fee:       platformFeePerVote,
      paystack_fee_total: paystackFee,
      total_per_vote:     buyerPricePerVote,
      total:              buyerTotal,
      votes,
    },
  });
}

// ─── PAYSTACK INIT ────────────────────────────────────────────
async function initPaystack(payload) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.status) return { ok: false, message: data.message || 'Payment initialization failed' };
  return { ok: true, authorization_url: data.data.authorization_url, reference: data.data.reference };
}
