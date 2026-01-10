import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const { event_id, tier_id, guest_name, reseller_code } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    /* 1. Fetch Tier + Event */
    const { data: tier } = await supabaseAdmin
      .from("ticket_tiers")
      .select(`
        *,
        events (
          title,
          organizer_subaccount,
          organizers:organizer_profile_id (paystack_subaccount_code)
        )
      `)
      .eq("id", tier_id)
      .single();

    if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });

   // --- 3. PRICE CALCULATION (BULLETPROOF) ---
const basePrice = Number(tier.price);

if (!basePrice || basePrice <= 0) {
  return NextResponse.json({ error: 'Invalid ticket price' }, { status: 400 });
}

let totalAmount = basePrice;
let resellerMarkup = 0;

if (resellerData && resellerData.resellers?.paystack_subaccount_code) {
  resellerMarkup = basePrice * 0.10;
  totalAmount = basePrice + resellerMarkup;
}

// Paystack expects amount in pesewas (GHS × 100)
const amountInPesewas = Math.round(totalAmount * 100);

if (!amountInPesewas || amountInPesewas < 100) {
  return NextResponse.json({ error: 'Transaction amount invalid' }, { status: 400 });
}

    const organizerSubaccount =
      tier.events.organizer_subaccount ||
      tier.events.organizers?.paystack_subaccount_code;

    if (!organizerSubaccount) {
      return NextResponse.json({ error: "Organizer payout not configured" }, { status: 400 });
    }

    /* 5. Valid Paystack payload */
    const payload = {
      email,
      amount: Math.round(finalPrice * 100),
      subaccount: organizerSubaccount,
      transaction_charge: Math.round(platformFee * 100),
      bearer: "subaccount",
      metadata: {
        type: "TICKET",
        event_id,
        tier_id,
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        base_price: basePrice
      }
    };

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.status) {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({
      access_code: data.data.access_code,
      reference: data.data.reference
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Initialization failed" }, { status: 500 });
  }
}
