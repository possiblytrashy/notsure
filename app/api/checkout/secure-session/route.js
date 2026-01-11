import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force Node.js runtime to avoid Edge fetch issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // 1. Get the body safely once
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    // 2. Initialize Supabase INSIDE the handler to prevent top-level crashes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Database Lookup
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select('price, events(name, profiles(paystack_subaccount_code))')
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: "Ticket Tier Not Found" }, { status: 404 });
    }

    const subaccount = tier.events?.profiles?.paystack_subaccount_code;
    const amountInKobo = Math.round(tier.price * 100);

    // 4. Paystack Initialization
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        subaccount: subaccount || undefined,
        bearer: subaccount ? "subaccount" : "account",
        metadata: {
          event_id,
          tier_id,
          guest_name,
          reseller_code: reseller_code || "DIRECT"
        }
      }),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 5. Success response
    return NextResponse.json({ access_code: result.data.access_code });

  } catch (err) {
    // This catch-all ensures we return a JSON error instead of a raw crash
    console.error("CRITICAL_ROUTE_ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// OPTIONS handler to satisfy any potential CORS preflight from the browser
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
