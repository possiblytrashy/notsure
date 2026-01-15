// FILE: app/api/checkout/secure-session/route.js
// FIXED - Proper 2-way and 3-way splits using Paystack Split Payments
// Ensure Supabase joins use explicit relationship names
// UPDATED - Adds VOTING purchases (no changes to ticket flow)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      type = "TICKET", // 👈 NEW (defaults to ticket)
      event_id,
      tier_id,
      email,
      guest_name,
      reseller_code,

      // 👇 VOTING
      candidate_id,
      vote_count
    } = body;

    // ==============================
    // COMMON VALIDATION
    // ==============================
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ======================================================
    // 🗳️ VOTING PURCHASE FLOW (ADDED)
    // ======================================================
    if (type === "VOTE") {
      if (!candidate_id || !vote_count || vote_count < 1) {
        return NextResponse.json(
          { error: "Invalid voting request." },
          { status: 400 }
        );
      }

      // Fetch candidate → contest → organizer
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select(`
          id,
          name,
          contests!inner (
            id,
            title,
            vote_price,
            organizers:organizer_id (
              paystack_subaccount_code
            )
          )
        `)
        .eq('id', candidate_id)
        .single();

      if (candidateError || !candidate) {
        console.error("Candidate fetch error:", candidateError);
        return NextResponse.json(
          { error: "Candidate not found." },
          { status: 404 }
        );
      }

      const organizerSubaccount =
        candidate.contests?.organizers?.paystack_subaccount_code;

      if (!organizerSubaccount) {
        console.error("Organizer missing Paystack subaccount for voting");
        return NextResponse.json(
          { error: "Organizer payment setup incomplete." },
          { status: 400 }
        );
      }

      // Amounts
      const votePrice = Number(candidate.contests.vote_price || 1);
      const totalAmount = votePrice * vote_count;

      const amountInPesewas = Math.round(totalAmount * 100);
      const platformFeeInPesewas = Math.round(amountInPesewas * 0.05);
      const organizerAmountInPesewas =
        amountInPesewas - platformFeeInPesewas;

      const normalizedEmail = email.trim().toLowerCase();

      const paystackPayload = {
        email: normalizedEmail,
        amount: amountInPesewas,
        currency: "GHS",
        callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}?vote=success`,
        metadata: {
          type: "VOTE",
          candidate_id,
          candidate_name: candidate.name,
          contest_id: candidate.contests.id,
          vote_count,
          vote_price
        },
        subaccount: organizerSubaccount,
        transaction_charge: platformFeeInPesewas,
        bearer: "account"
      };

      const paystackRes = await fetch(
        'https://api.paystack.co/transaction/initialize',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paystackPayload),
        }
      );

      const result = await paystackRes.json();

      if (!paystackRes.ok || !result.status) {
        console.error("Paystack Vote Init Error:", result);
        return NextResponse.json(
          { error: result.message || "Payment initialization failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference
      });
    }

    // ======================================================
    // 🎟️ TICKET PURCHASE FLOW (UNCHANGED)
    // ======================================================

    if (!tier_id || !event_id) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // ---- EVERYTHING BELOW IS YOUR ORIGINAL CODE ----

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
      return NextResponse.json(
        { error: "Ticket tier not found." },
        { status: 404 }
      );
    }

    const organizerSubaccount =
      tier.events?.organizers?.paystack_subaccount_code ||
      tier.events?.organizer_subaccount;

    if (!organizerSubaccount) {
      return NextResponse.json(
        { error: "Event organizer payment setup incomplete." },
        { status: 400 }
      );
    }

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
      }
    }

    let basePrice = Number(tier.price);
    let finalPrice = basePrice;
    let resellerCommission = 0;

    if (isResellerPurchase) {
      finalPrice = basePrice * 1.10;
      resellerCommission = basePrice * 0.10;
    }

    const amountInPesewas = Math.round(finalPrice * 100);
    const basePriceInPesewas = Math.round(basePrice * 100);
    const platformFeeInPesewas = Math.round(basePriceInPesewas * 0.05);
    const resellerCommissionInPesewas = Math.round(resellerCommission * 100);
    const organizerAmountInPesewas = basePriceInPesewas - platformFeeInPesewas;

    const normalizedEmail = email.trim().toLowerCase();

    const paystackPayload = {
      email: normalizedEmail,
      amount: amountInPesewas,
      currency: "GHS",
      callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?payment=success`,
      metadata: {
        event_id,
        tier_id,
        guest_email: normalizedEmail,
        guest_name: guest_name || 'Guest',
        reseller_code: reseller_code || "DIRECT",
        event_reseller_id: resellerData?.id || null,
        is_reseller_purchase: isResellerPurchase,
        base_price: basePrice,
        reseller_commission: resellerCommission
      }
    };

    const resellerSubaccount =
      resellerData?.resellers?.paystack_subaccount_code;

    if (isResellerPurchase && resellerSubaccount) {
      paystackPayload.split = {
        type: "flat",
        bearer_type: "account",
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
    } else {
      paystackPayload.subaccount = organizerSubaccount;
      paystackPayload.transaction_charge = platformFeeInPesewas;
      paystackPayload.bearer = "account";
    }

    const paystackRes = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackPayload),
      }
    );

    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status) {
      return NextResponse.json(
        { error: result.message || "Payment initialization failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference
    });

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}
