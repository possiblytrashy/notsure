// FILE: app/api/checkout/secure-session/route.js
// FIXED - Proper Paystack split configuration

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
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
        events (
          id,
          title,
          allows_resellers,
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

    // 3. Check if this is a Reseller Purchase
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

      if (eventReseller && !resellerError) {
        resellerData = eventReseller;
        isResellerPurchase = true;
        console.log("✅ Valid reseller link detected:", reseller_code);
      } else {
        console.log("⚠️ Invalid reseller code, processing as direct purchase");
      }
    }

    // 4. Calculate Price (with 10% markup if reseller purchase)
    let basePrice = Number(tier.price);
    let finalPrice = basePrice;
    let resellerCommission = 0;

    if (isResellerPurchase) {
      finalPrice = basePrice * 1.10; // 10% markup
      resellerCommission = basePrice * 0.10; // Reseller gets the markup
    }

    const amountInPesewas = Math.round(finalPrice * 100);
    const platformCommission = Math.round(basePrice * 100 * 0.05); // 5% platform fee on base price
    const resellerCommissionPesewas = Math.round(resellerCommission * 100);

    // 5. Normalize Email
    const normalizedEmail = email.trim().toLowerCase();

    // 6. Build Paystack Payload
    const paystackPayload = {
      email: normalizedEmail,
      amount: amountInPesewas,
      currency: "GHS",
      callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?payment=success`,
      metadata: {
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

    // 7. Configure Payment Split
    const organizerSubaccount = tier.events?.organizers?.paystack_subaccount_code;
    const resellerSubaccount = resellerData?.resellers?.paystack_subaccount_code;

    // IMPORTANT: Check if organizer has a subaccount
    if (!organizerSubaccount) {
      console.error("❌ Organizer has no Paystack subaccount!");
      return NextResponse.json({ 
        error: "Event organizer payment setup incomplete. Please contact support." 
      }, { status: 400 });
    }

    // Case 1: Reseller Purchase (3-way split)
    if (isResellerPurchase && resellerSubaccount) {
      // Calculate what organizer gets
      const organizerAmount = amountInPesewas - platformCommission - resellerCommissionPesewas;

      paystackPayload.subaccount = organizerSubaccount;
      paystackPayload.transaction_charge = platformCommission; // Platform gets this
      paystackPayload.bearer = "account"; // Platform bears Paystack fees
      
      // Add split for reseller
      paystackPayload.split = {
        type: "flat",
        bearer_type: "account",
        subaccounts: [
          {
            subaccount: resellerSubaccount,
            share: resellerCommissionPesewas
          }
        ]
      };

      console.log("💰 3-way split configured:", {
        total: amountInPesewas,
        platform: platformCommission,
        reseller: resellerCommissionPesewas,
        organizer: organizerAmount
      });
    } 
    // Case 2: Direct Purchase (2-way split)
    else {
      paystackPayload.subaccount = organizerSubaccount;
      paystackPayload.transaction_charge = platformCommission;
      paystackPayload.bearer = "account"; // Platform bears Paystack fees
      
      console.log("💰 2-way split configured:", {
        total: amountInPesewas,
        platform: platformCommission,
        organizer: amountInPesewas - platformCommission
      });
    }

    console.log("Initializing Paystack Transaction:", {
      email: normalizedEmail,
      amount: amountInPesewas,
      tier: tier.name,
      isResellerPurchase,
      resellerCode: reseller_code,
      hasOrganizerSubaccount: !!organizerSubaccount,
      hasResellerSubaccount: !!resellerSubaccount
    });

    // 8. Initialize Transaction with Paystack
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

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: err.message 
    }, { status: 500 });
  }
}
