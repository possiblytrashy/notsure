import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; 

export async function POST(req) {
  try {
    const { event_id, tier_id, email, guest_name, reseller_code } = await req.json();

    // 1. DATA VERIFICATION (The "Truth" comes from DB, not user input)
    const { data: event, error: eventErr } = await supabaseAdmin
      .from('events')
      .select('*, ticket_tiers(*), organizers(paystack_subaccount_code)')
      .eq('id', event_id)
      .single();

    const tier = event.ticket_tiers.find(t => t.id === tier_id);
    if (!tier) throw new Error("Invalid Tier");

    // 2. LUXURY PRICING LOGIC
    // Base price from DB (e.g. 1000 GHS)
    let basePrice = parseFloat(tier.price);
    // If reseller is present, we apply the 10% Luxury Markup we worked on
    let finalPrice = reseller_code !== "DIRECT" ? basePrice * 1.10 : basePrice;

    // 3. SPLIT CALCULATIONS (Converted to Pesewas for Paystack)
    const totalAmountInPesewas = Math.round(finalPrice * 100);
    const platformFeeInPesewas = Math.round(basePrice * 0.05 * 100); // Your 5%

    // 4. INITIALIZE PAYSTACK (Using Secret Key - hidden from console)
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount: totalAmountInPesewas,
        subaccount: event.organizers.paystack_subaccount_code,
        bearer: "subaccount", // Organizer bears the transaction fee from their 95%
        metadata: {
          event_id,
          tier_id,
          reseller_code,
          guest_name,
          platform_fee: platformFeeInPesewas
        },
        split: {
          type: "flat",
          subaccounts: [
            { 
              subaccount: process.env.PLATFORM_SUBACCOUNT_CODE, 
              share: platformFeeInPesewas 
            }
          ]
        }
      })
    });

    const result = await paystackResponse.json();
    
    if (!result.status) throw new Error(result.message);

    // We only return the access_code. The browser never sees the split math.
    return NextResponse.json({ access_code: result.data.access_code });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
