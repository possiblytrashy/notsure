import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id, tier_id, email, guest_name, reseller_code } = body;

    // 1. Strict Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json({ 
        error: "A valid email is required for ticket delivery." 
      }, { status: 400 });
    }

    if (!tier_id || !event_id) {
      return NextResponse.json({ 
        error: "Missing required fields: tier_id or event_id" 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. Fetch Tier details with Organizer's Paystack Subaccount
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
      console.error("Tier fetch error:", tierError);
      return NextResponse.json({ 
        error: "Ticket tier not found." 
      }, { status: 404 });
    }

    // 3. Calculate Price (with 10% reseller markup if applicable)
    let finalPrice = Number(tier.price);
    const isResellerPurchase = reseller_code && reseller_code !== "DIRECT";
    
    if (isResellerPurchase) {
      finalPrice = finalPrice * 1.10;
    }

    const amountInPesewas = Math.round(finalPrice * 100);
    const commissionInPesewas = Math.round(amountInPesewas * 0.05);

    // 4. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 5. Build Paystack Payload
    // CRITICAL: Include tier_id in BOTH metadata root AND custom_fields
    const paystackPayload = {
      email: normalizedEmail,
      amount: amountInPesewas,
      currency: "GHS",
      metadata: {
        // These fields are needed by your webhook
        event_id: event_id,
        tier_id: tier_id,  // CRITICAL: Must be here for webhook
        guest_email: normalizedEmail,
        guest_name: guest_name || 'Guest',
        reseller_code: reseller_code || "DIRECT",
        // Also include in custom_fields for display purposes
        custom_fields: [
          {
            display_name: "Event",
            variable_name: "event_title",
            value: tier.events.title
          },
          {
            display_name: "Guest Name",
            variable_name: "guest_name",
            value: guest_name || 'Guest'
          },
          {
            display_name: "Tier ID",
            variable_name: "tier_id",
            value: tier_id
          }
        ]
      }
    };

    // 6. Add Subaccount Split if organizer has one
    const subaccount = tier.events?.organizers?.paystack_subaccount_code;
    
    if (subaccount) {
      paystackPayload.subaccount = subaccount;
      paystackPayload.transaction_charge = commissionInPesewas;
      paystackPayload.bearer = "subaccount";
    }

    console.log("Initializing Paystack with:", {
      email: normalizedEmail,
      amount: amountInPesewas,
      tier_id: tier_id,
      hasSubaccount: !!subaccount
    });

    // 7. Initialize Transaction with Paystack
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
      console.error("Paystack API Error:", result);
      return NextResponse.json({ 
        error: result.message || "Payment initialization failed" 
      }, { status: 400 });
    }

    // 8. Return ONLY access_code
    // The frontend should ONLY use this - no need to pass email/amount again
    return NextResponse.json({ 
      access_code: result.data.access_code,
      reference: result.data.reference // Useful for debugging
    });

  } catch (err) {
    console.error("Server Error in secure-session:", err);
    return NextResponse.json({ 
      error: "Internal Server Error",
      details: err.message 
    }, { status: 500 });
  }
}
