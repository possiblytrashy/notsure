import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This allows the browser to "ask permission" to send the POST request
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

export async function POST(req) {
  try {
    // 1. Verify Environment Variables inside the handler
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !paystackSecret) {
      console.error("Missing Environment Variables");
      return NextResponse.json({ error: "System Configuration Error" }, { status: 500 });
    }

    const body = await req.json();
    const { event_id, tier_id, email, guest_name } = body;

    // 2. Initialize Supabase Admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Fetch Tier & Event Data (Ensure the price is correct)
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select('*, events(organizer_id, profiles(paystack_subaccount_code))')
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) throw new Error("Ticket tier not found");

    const amountInKobo = tier.price * 100;
    const subaccount = tier.events?.profiles?.paystack_subaccount_code;

    // 4. Initialize Paystack Transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ousted.vercel.app'}/verify`,
        subaccount: subaccount || undefined,
        bearer: subaccount ? "subaccount" : "account", // 5% commission logic
        metadata: {
          event_id,
          tier_id,
          guest_name,
          custom_fields: [{ display_name: "Event", variable_name: "event", value: tier.events.name }]
        }
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return NextResponse.json({ error: paystackData.message }, { status: 400 });
    }

    return NextResponse.json({ access_code: paystackData.data.access_code });

  } catch (err) {
    console.error("Critical API Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
