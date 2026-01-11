import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --- Initialize Supabase clients ---
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Server-side key
);

export async function POST(req) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const { event_id, tier_id, guest_name, reseller_code } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // --- Fetch Tier + Event ---
    const { data: tier, error: tierError } = await supabaseAdmin
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

    if (tierError) {
      console.error("Tier fetch error:", tierError);
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    if (!tier || !tier.price) {
      return NextResponse.json({ error: "Invalid ticket price" }, { status: 400 });
    }

    // --- Price calculation ---
    let basePrice = parseFloat(tier.price);
    if (isNaN(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: "Invalid ticket price" }, { status: 400 });
    }

    let finalPrice = basePrice;
    let resellerMarkup = 0;

    // --- Fetch reseller if code provided ---
    let resellerData = null;
    if (reseller_code && reseller_code !== "DIRECT") {
      const { data: resData, error: resellerError } = await supabaseAdmin
        .from("resellers")
        .select("id, commission_rate, paystack_subaccount_code")
        .eq("code", reseller_code)
        .single();

      if (!resellerError && resData) {
        resellerData = resData;
        if (resellerData.paystack_subaccount_code) {
          resellerMarkup = basePrice * 0.10; // 10% markup
          finalPrice += resellerMarkup;
        }
      }
    }

    // --- Platform fee (5%) ---
    const platformFee = finalPrice * 0.05;

    // --- Convert to pesewas (smallest currency unit) ---
    const amountInPesewas = Math.round(finalPrice * 100);
    const transactionChargeInPesewas = Math.round(platformFee * 100);

    if (!amountInPesewas || amountInPesewas < 100) {
      return NextResponse.json({ error: "Transaction amount invalid" }, { status: 400 });
    }

    // --- Determine organizer subaccount ---
    const organizerSubaccount =
      tier.events.organizer_subaccount ||
      tier.events.organizers?.paystack_subaccount_code;

    if (!organizerSubaccount) {
      return NextResponse.json({ error: "Organizer payout not configured" }, { status: 400 });
    }

    // --- Paystack payload ---
    const payload = {
      email,
      amount: amountInPesewas,
      subaccount: organizerSubaccount,
      transaction_charge: transactionChargeInPesewas,
      bearer: "subaccount",
      metadata: {
        type: "TICKET",
        event_id,
        tier_id,
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        base_price: basePrice,
        reseller_markup: resellerMarkup,
        platform_fee: platformFee,
      },
    };

    // --- Initialize Paystack transaction ---
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!data.status) {
      console.error("Paystack init error:", data);
      return NextResponse.json({ error: data.message || "Paystack initialization failed" }, { status: 400 });
    }

    return NextResponse.json({
      access_code: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err) {
    console.error("Transaction initialization error:", err);
    return NextResponse.json({ error: "Initialization failed" }, { status: 500 });
  }
}
