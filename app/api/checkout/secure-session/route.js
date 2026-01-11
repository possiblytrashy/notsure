// app/api/paystack/initialize/route.js
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 

export async function POST(req) {
  try {
    const { event_id, tier_id, email, guest_name, reseller_code } = await req.json();

    // 1. Fetch Event & Organizer info matching your page.jsx query
    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select(`
        *, 
        ticket_tiers(*), 
        organizers:organizer_profile_id (paystack_subaccount_code)
      `)
      .eq('id', event_id)
      .single();

    if (eventErr || !event) throw new Error("Experience not found");

    const tier = event.ticket_tiers.find(t => t.id === tier_id);
    const organizerSubaccount = event.organizers?.paystack_subaccount_code;

    if (!organizerSubaccount) throw new Error("Organizer payout not configured");

    // 2. Luxury Math (Matches your getDisplayPrice logic)
    const basePrice = parseFloat(tier.price);
    const isReseller = reseller_code && reseller_code !== "DIRECT";
    const finalPrice = isReseller ? basePrice * 1.10 : basePrice;

    // Convert to Pesewas
    const totalAmount = Math.round(finalPrice * 100);
    const platformFee = Math.round(basePrice * 0.05 * 100); // Your 5%
    
    let resellerShare = 0;
    let resellerSubaccount = null;

    // 3. Handle Reseller Logic
    if (isReseller) {
      // Reseller gets the 10% markup (final - base)
      resellerShare = Math.round((finalPrice - basePrice) * 100);

      const { data: resData } = await supabaseAdmin
        .from('event_resellers')
        .select('resellers(paystack_subaccount_code)')
        .eq('unique_code', reseller_code)
        .single();
      
      resellerSubaccount = resData?.resellers?.paystack_subaccount_code;
    }

    // 4. Organizer Share = Total - (Your 5% + Reseller Cut)
    const organizerShare = totalAmount - platformFee - resellerShare;

    // 5. Initialize Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: totalAmount,
        metadata: { event_id, tier_id, reseller_code, guest_name },
        split: {
          type: "flat",
          currency: "GHS",
          bearer_type: "subaccount",
          bearer_subaccount: organizerSubaccount,
          subaccounts: [
            { subaccount: organizerSubaccount, share: organizerShare },
            ...(resellerSubaccount && resellerShare > 0 
                ? [{ subaccount: resellerSubaccount, share: resellerShare }] 
                : [])
          ]
        }
      })
    });

    const result = await paystackResponse.json();
    if (!result.status) throw new Error(result.message);

    return NextResponse.json({ access_code: result.data.access_code });

  } catch (err) {
    console.error("API Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
