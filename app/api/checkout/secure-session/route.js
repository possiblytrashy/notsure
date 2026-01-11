import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Explicitly define the runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1. OPTIONS Handler for CORS Preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// 2. Main POST Handler
export async function POST(req) {
  console.log("--- Luxury Session Initialization Started ---");
  
  try {
    // Check Env Variables immediately
    const {
      NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      PAYSTACK_SECRET_KEY,
      NEXT_PUBLIC_SITE_URL
    } = process.env;

    if (!SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
      console.error("CRITICAL ERROR: API Keys are missing in Vercel Dashboard");
      return NextResponse.json({ error: "System Configuration Error" }, { status: 500 });
    }

    // Parse Body
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    if (!event_id || !tier_id || !email) {
      return NextResponse.json({ error: "Incomplete details provided" }, { status: 400 });
    }

    // Initialize Supabase
    const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch Tier and Event Details (with Join for Subaccount)
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select(`
        price,
        events (
          name,
          profiles (
            paystack_subaccount_code
          )
        )
      `)
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) {
      console.error("Database Error:", tierError);
      return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
    }

    const amountInKobo = Math.round(tier.price * 100);
    const subaccount = tier.events?.profiles?.paystack_subaccount_code;

    // Initialize Paystack Transaction
    // Note: We use the 5% split logic by setting the 'bearer'
    const paystackPayload = {
      email,
      amount: amountInKobo,
      callback_url: `${NEXT_PUBLIC_SITE_URL || 'https://ousted.vercel.app'}/verify`,
      metadata: {
        event_id,
        tier_id,
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        custom_fields: [
          { display_name: "Event", variable_name: "event", value: tier.events.name },
          { display_name: "Guest", variable_name: "guest", value: guest_name }
        ]
      }
    };

    // Add subaccount split if it exists
    if (subaccount) {
      paystackPayload.subaccount = subaccount;
      paystackPayload.bearer = "subaccount"; // Organizer pays the fee (5% logic)
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      console.error("Paystack Error:", result.message);
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    console.log("--- Session Successfully Created ---");
    return NextResponse.json({ 
      access_code: result.data.access_code,
      reference: result.data.reference 
    });

  } catch (err) {
    console.error("Unhandled API Crash:", err.message);
    return NextResponse.json({ error: "Concierge error: " + err.message }, { status: 500 });
  }
}
