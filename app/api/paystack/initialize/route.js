import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    
    // Explicitly trim and lowercase the email
    const email = body.email?.trim().toLowerCase();
    const { event_id, tier_id, guest_name, reseller_code } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    

    // 1. Fetch Tier + Event + Organizer + Reseller Subaccount
    // We fetch the reseller's subaccount linked to their profile if a code is present
    let resellerData = null;
    if (reseller_code && reseller_code !== "DIRECT") {
      const { data, error } = await supabaseAdmin
        .from('event_resellers')
        .select(`
          id,
          resellers:reseller_id (
            paystack_subaccount_code
          )
        `)
        .eq('unique_code', reseller_code)
        .eq('event_id', event_id)
        .single();
      
      if (!error) resellerData = data;
    }

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
      .eq('event_id', event_id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 });
    }

    // 2. Validate Capacity
    const { count: soldCount } = await supabaseAdmin
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tier_id', tier_id)
      .eq('status', 'valid');

    if (tier.max_quantity > 0 && soldCount >= tier.max_quantity) {
      return NextResponse.json({ error: 'This tier is sold out' }, { status: 400 });
    }

    // 3. Calculation Logic (The 3-Way Split)
    const originalPrice = parseFloat(tier.price);
    const systemCommission = originalPrice * 0.05; // Your 5%
    const organizerShare = originalPrice * 0.95;   // Organizer's 95%
    
    let totalAmount = originalPrice;
    let resellerShare = 0;

    // Apply the "Luxury" 10% markup if a valid reseller is found
    if (resellerData && resellerData.resellers?.paystack_subaccount_code) {
      resellerShare = originalPrice * 0.10; 
      totalAmount = originalPrice + resellerShare;
    }

    const amountInKobo = Math.round(totalAmount * 100);
    const organizerSubaccount = tier.events.organizer_subaccount || 
                                tier.events.organizers?.paystack_subaccount_code;

    if (!organizerSubaccount) {
      return NextResponse.json({ error: 'Organizer payout not configured' }, { status: 400 });
    }

    // 4. Construct Paystack Payload
    const paystackPayload = {
      email,
      amount: amountInKobo,
      metadata: {
        event_id,
        tier_id: tier.id,
        tier_name: tier.name,
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        base_price: originalPrice
      }
    };

    // 5. Multi-Split vs Single Subaccount logic
    if (resellerData && resellerData.resellers?.paystack_subaccount_code) {
      // Use Multi-Split: Routes money to two different subaccounts
      paystackPayload.subaccounts = [
        {
          subaccount: organizerSubaccount,
          share: Math.round(organizerShare * 100)
        },
        {
          subaccount: resellerData.resellers.paystack_subaccount_code,
          share: Math.round(resellerShare * 100)
        }
      ];
      // Note: Paystack keeps the remainder (the 5% systemCommission) in your main account.
    } else {
      // Direct Purchase: Standard 95/5 Split
      paystackPayload.subaccount = organizerSubaccount;
      paystackPayload.transaction_charge = Math.round(systemCommission * 100);
      paystackPayload.bearer = "subaccount";
    }

    // 6. Initialize Transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return NextResponse.json({ error: paystackData.message }, { status: 400 });
    }

    return NextResponse.json({ 
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference 
    });

  } catch (err) {
    console.error("Backend Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
