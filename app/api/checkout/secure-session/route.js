// FILE: app/api/checkout/secure-session/route.js
// UPDATED - Handles both TICKET purchases and VOTE purchases
// Uses Paystack Split Payments for proper revenue distribution

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { type } = body; // 'TICKET' or 'VOTE'

    // Route to appropriate handler based on purchase type
    if (type === 'VOTE') {
      return await handleVotePurchase(body);
    } else {
      return await handleTicketPurchase(body);
    }

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: err.message 
    }, { status: 500 });
  }
}

// ============================================================================
// VOTING PURCHASE HANDLER
// ============================================================================
async function handleVotePurchase(body) {
  const { candidate_id, vote_count, email } = body;

  // 1. Validation
  if (!email || !email.includes('@')) {
    return NextResponse.json({ 
      error: "A valid email is required." 
    }, { status: 400 });
  }

  if (!candidate_id || !vote_count || vote_count < 1) {
    return NextResponse.json({ 
      error: "Missing required fields or invalid vote count." 
    }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Fetch Candidate with Contest and Competition Details
  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select(`
      id,
      name,
      contest_id,
      contests!inner (
        id,
        title,
        vote_price,
        is_active,
        organizer_id,
        competition_id,
        competitions!inner (
          id,
          title,
          organizer_id,
          organizers:organizer_id (
            id,
            paystack_subaccount_code
          )
        )
      )
    `)
    .eq('id', candidate_id)
    .single();

  if (candidateError || !candidate) {
    console.error("Candidate fetch error:", candidateError);
    return NextResponse.json({ 
      error: "Candidate not found." 
    }, { status: 404 });
  }

  // 3. Check if voting is active
  if (!candidate.contests?.is_active) {
    return NextResponse.json({ 
      error: "Voting is currently paused for this contest." 
    }, { status: 400 });
  }

  // 4. Check Organizer has Subaccount
  const organizerSubaccount = candidate.contests?.competitions?.organizers?.paystack_subaccount_code;
  
  if (!organizerSubaccount) {
    console.error("❌ Organizer has no Paystack subaccount!");
    console.error("Debug Candidate Data:", JSON.stringify(candidate, null, 2));
    return NextResponse.json({ 
      error: "Competition organizer payment setup incomplete. Please contact support." 
    }, { status: 400 });
  }

  // 5. Calculate Amounts
  const votePrice = Number(candidate.contests.vote_price);
  const totalAmount = votePrice * vote_count;
  
  const amountInPesewas = Math.round(totalAmount * 100);
  const platformFeeInPesewas = Math.round(amountInPesewas * 0.05); // 5% platform fee
  const organizerAmountInPesewas = amountInPesewas - platformFeeInPesewas;

  // 6. Normalize Email
  const normalizedEmail = email.trim().toLowerCase();

  // 7. Build Paystack Payload
  const paystackPayload = {
    email: normalizedEmail,
    amount: amountInPesewas,
    currency: "GHS",
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/voting?payment=success&candidate_id=${candidate_id}`,
    metadata: {
      type: 'VOTE',
      candidate_id: candidate_id,
      candidate_name: candidate.name,
      contest_id: candidate.contests.id,
      contest_title: candidate.contests.title,
      competition_id: candidate.contests.competitions.id,
      competition_title: candidate.contests.competitions.title,
      vote_count: vote_count,
      voter_email: normalizedEmail,
      vote_price: votePrice,
      total_amount: totalAmount,
      custom_fields: [
        {
          display_name: "Competition",
          variable_name: "competition_title",
          value: candidate.contests.competitions.title
        },
        {
          display_name: "Contest",
          variable_name: "contest_title",
          value: candidate.contests.title
        },
        {
          display_name: "Candidate",
          variable_name: "candidate_name",
          value: candidate.name
        },
        {
          display_name: "Votes",
          variable_name: "vote_count",
          value: String(vote_count)
        }
      ]
    }
  };

  // 8. Configure 2-Way Split Payment (Platform + Organizer)
  paystackPayload.subaccount = organizerSubaccount;
  paystackPayload.transaction_charge = platformFeeInPesewas; // Platform's 5%
  paystackPayload.bearer = "account"; // Platform bears Paystack fees
  
  console.log("💰 Vote purchase - 2-way split configured:", {
    total: amountInPesewas / 100,
    platform: platformFeeInPesewas / 100,
    organizer: organizerAmountInPesewas / 100,
    votes: vote_count
  });

  // 9. Initialize Transaction with Paystack
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paystackPayload),
  });

  const result = await paystackRes.json();

  if (!paystackRes.ok || !result.status) {
    console.error("Paystack API Error:", result);
    return NextResponse.json({ 
      error: result.message || "Payment initialization failed" 
    }, { status: 400 });
  }

  console.log("✅ Paystack vote session created:", result.data.reference);

  return NextResponse.json({ 
    authorization_url: result.data.authorization_url,
    reference: result.data.reference
  });
}

// ============================================================================
// TICKET PURCHASE HANDLER (Original Logic)
// ============================================================================
async function handleTicketPurchase(body) {
  const { event_id, tier_id, email, guest_name, reseller_code } = body;

  // 1. Validation
  if (!email || !email.includes('@')) {
    return NextResponse.json({ 
      error: "A valid email is required." 
    }, { status: 400 });
  }

  if (!tier_id || !event_id) {
    return NextResponse.json({ 
      error: "Missing required fields." 
    }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Fetch Tier with Event and Organizer Details
  const { data: tier, error: tierError } = await supabase
    .from('ticket_tiers')
    .select(`
      id,
      name,
      price,
      events!inner (
        id,
        title,
        allows_resellers,
        organizer_subaccount,
        organizer_profile_id,
        organizers:organizer_profile_id (
          paystack_subaccount_code
        )
      )
    `)
    .eq('id', tier_id)
    .single();

  if (tierError || !tier) {
    console.error("Tier fetch error:", tierError);
    return NextResponse.json({ 
      error: "Ticket tier not found." 
    }, { status: 404 });
  }

  // 3. Check Organizer has Subaccount
  const organizerSubaccount = 
    tier.events?.organizers?.paystack_subaccount_code || 
    tier.events?.organizer_subaccount;
  
  if (!organizerSubaccount) {
    console.error("❌ Organizer has no Paystack subaccount! Checked both profile and event columns.");
    console.error("Debug Tier Data:", JSON.stringify(tier, null, 2));
    return NextResponse.json({ 
      error: "Event organizer payment setup incomplete. Please contact support." 
    }, { status: 400 });
  }

  // 4. Check if this is a Reseller Purchase
  let resellerData = null;
  let isResellerPurchase = false;

  if (reseller_code && reseller_code !== "DIRECT" && tier.events.allows_resellers) {
    const { data: eventReseller, error: resellerError } = await supabase
      .from('event_resellers')
      .select(`
        *,
        resellers:reseller_id (
          id,
          paystack_subaccount_code
        )
      `)
      .eq('unique_code', reseller_code)
      .eq('event_id', event_id)
      .single();

    if (eventReseller && !resellerError && eventReseller.resellers?.paystack_subaccount_code) {
      resellerData = eventReseller;
      isResellerPurchase = true;
      console.log("✅ Valid reseller with subaccount:", reseller_code);
    } else {
      console.log("⚠️ Invalid/incomplete reseller, processing as direct");
    }
  }

  // 5. Calculate Amounts
  let basePrice = Number(tier.price);
  let finalPrice = basePrice;
  let resellerCommission = 0;

  if (isResellerPurchase) {
    finalPrice = basePrice * 1.10; // 10% markup
    resellerCommission = basePrice * 0.10;
  }

  const amountInPesewas = Math.round(finalPrice * 100);
  const basePriceInPesewas = Math.round(basePrice * 100);
  const platformFeeInPesewas = Math.round(basePriceInPesewas * 0.05); // 5% of base
  const resellerCommissionInPesewas = Math.round(resellerCommission * 100);
  const organizerAmountInPesewas = basePriceInPesewas - platformFeeInPesewas;

  // 6. Normalize Email
  const normalizedEmail = email.trim().toLowerCase();

  // 7. Build Paystack Payload
  const paystackPayload = {
    email: normalizedEmail,
    amount: amountInPesewas,
    currency: "GHS",
    callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?payment=success`,
    metadata: {
      type: 'TICKET',
      event_id: event_id,
      tier_id: tier_id,
      guest_email: normalizedEmail,
      guest_name: guest_name || 'Guest',
      reseller_code: reseller_code || "DIRECT",
      event_reseller_id: resellerData?.id || null,
      is_reseller_purchase: isResellerPurchase,
      base_price: basePrice,
      reseller_commission: resellerCommission,
      custom_fields: [
        {
          display_name: "Event",
          variable_name: "event_title",
          value: tier.events.title
        },
        {
          display_name: "Guest Name",
          variable_name: "guest_name",
          value: guest_name || 'Guest'
        },
        {
          display_name: "Tier ID",
          variable_name: "tier_id",
          value: tier_id
        }
      ]
    }
  };

  // 8. Configure Split Payment
  const resellerSubaccount = resellerData?.resellers?.paystack_subaccount_code;

  if (isResellerPurchase && resellerSubaccount) {
    // 3-WAY SPLIT: Platform, Organizer, Reseller
    paystackPayload.split = {
      type: "flat",
      bearer_type: "account", // Platform bears all Paystack fees
      subaccounts: [
        {
          subaccount: organizerSubaccount,
          share: organizerAmountInPesewas
        },
        {
          subaccount: resellerSubaccount,
          share: resellerCommissionInPesewas
        }
      ]
    };
    
    console.log("💰 3-way split configured:", {
      total: amountInPesewas / 100,
      platform: platformFeeInPesewas / 100,
      organizer: organizerAmountInPesewas / 100,
      reseller: resellerCommissionInPesewas / 100
    });

  } else {
    // 2-WAY SPLIT: Platform and Organizer
    paystackPayload.subaccount = organizerSubaccount;
    paystackPayload.transaction_charge = platformFeeInPesewas;
    paystackPayload.bearer = "account";
    
    console.log("💰 2-way split configured:", {
      total: amountInPesewas / 100,
      platform: platformFeeInPesewas / 100,
      organizer: organizerAmountInPesewas / 100
    });
  }

  console.log("Initializing Paystack Transaction:", {
    email: normalizedEmail,
    amount: amountInPesewas / 100,
    tier: tier.name,
    isResellerPurchase
  });

  // 9. Initialize Transaction with Paystack
  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(paystackPayload),
  });

  const result = await paystackRes.json();

  if (!paystackRes.ok || !result.status) {
    console.error("Paystack API Error:", result);
    return NextResponse.json({ 
      error: result.message || "Payment initialization failed" 
    }, { status: 400 });
  }

  console.log("✅ Paystack session created:", result.data.reference);

  return NextResponse.json({ 
    authorization_url: result.data.authorization_url,
    reference: result.data.reference
  });
}
