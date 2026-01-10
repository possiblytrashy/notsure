import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PAYSTACK_SECRET_KEY // Use Service Role Key for Admin access
);

export async function POST(req) {
  try {
    const body = await req.json();
    
    // 1. Precise Email Sanitization
    const email = body.email?.trim().toLowerCase();
    const { event_id, tier_id, guest_name, reseller_code } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email provided" }, { status: 400 });
    }

    // 2. Fetch Tier & Event Data
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

    if (tierError || !tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });

    // 3. Pricing & Commission Logic
    const basePrice = parseFloat(tier.price);
    const systemCommission = basePrice * 0.05; // Your 5% cut
    const amountInKobo = Math.round(basePrice * 100);

    const organizerSubaccount = tier.events.organizer_subaccount || tier.events.organizers?.paystack_subaccount_code;

    if (!organizerSubaccount) {
      return NextResponse.json({ error: "Organizer payout not configured" }, { status: 400 });
    }

    // 4. Valid Paystack Payload (Single Split)
    // Note: If you want 3-way splits, see Part 2 below.
    const paystackPayload = {
      email,
      amount: amountInKobo,
      subaccount: organizerSubaccount,
      transaction_charge: Math.round(systemCommission * 100),
      bearer: "subaccount", // Organizer pays the processing fee
      metadata: {
        event_id,
        tier_id,
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        custom_fields: [
          { display_name: "Event", variable_name: "event_name", value: tier.events.title },
          { display_name: "Tier", variable_name: "tier_name", value: tier.name }
        ]
      }
    };

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(paystackPayload)
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) throw new Error(paystackData.message);

    return NextResponse.json({
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference
    });

  } catch (err) {
    console.error("Initialization Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
