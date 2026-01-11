import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'; 

export async function POST(req) {
  try {
    const { event_id, tier_id, email, guest_name, reseller_code } = await req.json();

    // 1. DATA VERIFICATION
    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select(`
        *, 
        ticket_tiers(*), 
        organizers:organizer_profile_id (business_name, paystack_subaccount_code)
      `)
      .eq('id', event_id)
      .single();

    if (eventErr || !event) throw new Error("Event not found");

    const tier = event.ticket_tiers.find(t => t.id === tier_id);
    if (!tier) throw new Error("Invalid Tier");

    const organizerSubaccount = event.organizers?.paystack_subaccount_code;
    if (!organizerSubaccount) throw new Error("Organizer payout not configured");

    // 2. LUXURY PRICING & COMMISSION LOGIC
    const basePrice = parseFloat(tier.price);
    const isReseller = reseller_code && reseller_code !== "DIRECT";
    
    // Apply the 10% Luxury Markup if bought via Reseller
    const finalPrice = isReseller ? basePrice * 1.10 : basePrice;
    
    // Convert all to Pesewas (integers) for Paystack accuracy
    const totalAmount = Math.round(finalPrice * 100);
    const platformFee = Math.round(basePrice * 0.05 * 100); // Your 5% on base price
    
    let resellerShare = 0;
    let resellerSubaccount = null;

    // 3. FETCH RESELLER DETAILS IF APPLICABLE
    if (isReseller) {
      const { data: resellerData } = await supabaseAdmin
        .from('event_resellers')
        .select(`
          *,
          resellers!reseller_id (paystack_subaccount_code)
        `)
        .eq('unique_code', reseller_code)
        .single();

      if (resellerData) {
        // Example: Reseller gets the 10% markup amount as their commission
        resellerShare = Math.round((finalPrice - basePrice) * 100);
        resellerSubaccount = resellerData.resellers?.paystack_subaccount_code;
      }
    }

    // 4. CALCULATE ORGANIZER'S FINAL SHARE
    // Organizer gets: Total - Platform Fee - Reseller Share
    const organizerShare = totalAmount - platformFee - resellerShare;

    // 5. INITIALIZE PAYSTACK WITH DYNAMIC SPLIT
    // By not defining a top-level subaccount, the "leftover" stays in your account.
    const splitBody = {
      email,
      amount: totalAmount,
      metadata: {
        event_id,
        tier_id,
        reseller_code,
        guest_name,
        platform_fee: platformFee
      },
      split: {
        type: "flat",
        currency: "GHS",
        bearer_type: "subaccount",
        bearer_subaccount: organizerSubaccount, // Organizer covers Paystack's processing fees
        subaccounts: [
          {
            subaccount: organizerSubaccount,
            share: organizerShare
          }
        ]
      }
    };

    // Add reseller to the split if they exist and have a subaccount
    if (resellerShare > 0 && resellerSubaccount) {
      splitBody.split.subaccounts.push({
        subaccount: resellerSubaccount,
        share: resellerShare
      });
    }

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(splitBody)
    });

    const result = await paystackResponse.json();
    if (!result.status) throw new Error(result.message);

    return NextResponse.json({ access_code: result.data.access_code });

  } catch (error) {
    console.error("Split Logic Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
