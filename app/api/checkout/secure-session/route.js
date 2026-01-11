import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    // 1. Validation: If email is missing here, the access_code will be broken
    if (!email || email === "") {
      return NextResponse.json({ error: "Email is required for GHS transactions" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. Fetch Tier & Subaccount
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select(`
        price,
        events (
          organizers:organizer_profile_id (
            paystack_subaccount_code
          )
        )
      `)
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    const subaccount = tier.events?.organizers?.paystack_subaccount_code;
    const amountInKobo = Math.round(tier.price * 100);

    // 3. Initialize Paystack FORCE GHS
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        amount: amountInKobo,
        currency: "GHS", // <--- CRITICAL: Forces Ghana Cedis
        subaccount: subaccount || undefined,
        bearer: subaccount ? "subaccount" : "account",
        metadata: {
          event_id,
          tier_id,
          guest_name,
          reseller_code: reseller_code || "DIRECT",
          custom_fields: [
            { display_name: "Guest Name", variable_name: "guest_name", value: guest_name },
            { display_name: "Event ID", variable_name: "event_id", value: event_id }
          ]
        }
      }),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      console.error("Paystack Init Error:", result.message);
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 4. Return the valid access_code
    return NextResponse.json({ access_code: result.data.access_code });

  } catch (err) {
    console.error("Server Crash:", err.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
