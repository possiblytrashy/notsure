import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    // 1. Strict Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: "A valid email is required for ticket delivery." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. Fetch Tier details and Organizer's Paystack Subaccount
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select(`
        id,
        name,
        price,
        events (
          id,
          title,
          organizer_profile_id,
          organizers:organizer_profile_id (
            paystack_subaccount_code
          )
        )
      `)
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: "Ticket tier not found." }, { status: 404 });
    }

    // 3. CALCULATE CORRECT PRICE (Base vs Reseller Markup)
    // Match the frontend: 10% markup if a reseller code exists and isn't "DIRECT"
    let finalPrice = Number(tier.price);
    const isResellerPurchase = reseller_code && reseller_code !== "DIRECT";
    
    if (isResellerPurchase) {
      finalPrice = finalPrice * 1.10;
    }

    const amountInPesewas = Math.round(finalPrice * 100);
    
    // 4. Calculate 5% Commission (Based on original tier price or final price? 
    // Usually based on final price to cover processing)
    const commissionInPesewas = Math.round(amountInPesewas * 0.05);

    // 5. Initialize Paystack Payload
    const subaccount = tier.events?.organizers?.paystack_subaccount_code;

    const paystackPayload = {
      email: email.trim(),
      amount: amountInPesewas,
      currency: "GHS",
      // Important: Ensure the access_code locks these details
      metadata: {
        type: 'TICKET_PURCHASE', 
        event_id: event_id,
        tier_id: tier_id,
        reseller_code: reseller_code || "DIRECT",
        guest_name: guest_name || "Valued Guest",
        custom_fields: [
          { display_name: "Event", variable_name: "event_title", value: tier.events?.title },
          { display_name: "Tier", variable_name: "tier_name", value: tier.name },
          { display_name: "Guest", variable_name: "guest_name", value: guest_name }
        ]
      }
    };

    // 6. Apply Split Logic
    if (subaccount) {
      paystackPayload.subaccount = subaccount;
      paystackPayload.transaction_charge = commissionInPesewas; 
      paystackPayload.bearer = "subaccount"; 
    }

    // 7. Initialize Transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status) {
      console.error("Paystack API Error:", result.message);
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 8. RETURN ONLY THE ACCESS_CODE
    // By returning only this, you force the frontend to rely on the server-side 
    // configuration we just created, preventing "Amount/Email missing" errors.
    return NextResponse.json({ 
      access_code: result.data.access_code
    });

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
