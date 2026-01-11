import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // FIX: Joined with 'organizers' table based on your schema
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select(`
        price,
        events (
          id,
          title,
          organizers:organizer_profile_id (
            paystack_subaccount_code
          )
        )
      `)
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) {
      console.error("Lookup Error:", tierError);
      return NextResponse.json({ error: "Ticket Tier Not Found" }, { status: 404 });
    }

    // Accessing the subaccount from the organizers join
    const subaccount = tier.events?.organizers?.paystack_subaccount_code;
    const amountInKobo = Math.round(tier.price * 100);

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
        // 5% Split Logic: 'subaccount' bearer means organizer pays the Paystack fee
        bearer: subaccount ? "subaccount" : "account",
        metadata: {
          event_id,
          tier_id,
          guest_name,
          reseller_code: reseller_code || "DIRECT",
          tier_name: tier.name // Added for the webhook
        }
      }),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ access_code: result.data.access_code });

  } catch (err) {
    console.error("CRITICAL_ROUTE_ERROR:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
