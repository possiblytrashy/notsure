import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { event_id, tier_id, email, guest_name, reseller_code } = await req.json();

    // 1. Fetch the Specific Tier from the new table
    const { data: tier, error: tierError } = await supabaseAdmin
      .from('ticket_tiers')
      .select(`
        *,
        events (
          title,
          organizer_subaccount,
          organizers:organizer_profile_id (paystack_subaccount_code)
        )
      `)
      .eq('id', tier_id)
      .eq('event_id', event_id) // Security: ensure tier belongs to event
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
    }

    // 2. Validate Capacity (Server-side check)
    const { count: soldCount } = await supabaseAdmin
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tier_id', tier_id)
      .eq('status', 'valid');

    if (tier.max_quantity > 0 && soldCount >= tier.max_quantity) {
      return NextResponse.json({ error: 'This tier is sold out' }, { status: 400 });
    }

    // 3. Calculate Pricing (95/5 Split logic)
    let basePrice = parseFloat(tier.price);
    if (reseller_code) basePrice = basePrice * 1.10; // 10% Luxury markup for resellers
    
    const amountInKobo = Math.round(basePrice * 100);

    // 4. Resolve Subaccount
    const subaccount = tier.events.organizer_subaccount || 
                      tier.events.organizers?.paystack_subaccount_code;

    if (!subaccount) {
      return NextResponse.json({ error: 'Organizer payout not configured' }, { status: 400 });
    }

    // 5. Paystack Payload
    const paystackPayload = {
      email,
      amount: amountInKobo,
      metadata: {
        event_id,
        tier_id: tier.id,
        tier_name: tier.name,
        guest_name,
        reseller_code: reseller_code || "DIRECT"
      },
      subaccount,
      transaction_charge: Math.round(amountInKobo * 0.05), // Your 5% commission
      bearer: "subaccount" 
    };

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();

    return NextResponse.json({ 
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference 
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
