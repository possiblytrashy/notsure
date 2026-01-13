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
      console.error("Database Error:", tierError);
      return NextResponse.json({ error: "Ticket luxury tier not found." }, { status: 404 });
    }

    const subaccount = tier.events?.organizers?.paystack_subaccount_code;
    const amountInPesewas = Math.round(tier.price * 100);
    
    // 3. Calculate 5% Commission (Transaction Fee)
    // If ticket is 100 GHS, commission is 5 GHS (500 Pesewas)
    const commissionInPesewas = Math.round(amountInPesewas * 0.05);

    // 4. Initialize Paystack with Logic for Splitting
    const paystackPayload = {
      email: email.trim(),
      amount: amountInPesewas,
      currency: "GHS",
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/verify-payment`, // Redirect after popup closes
      // In app/api/checkout/secure-session/route.js
metadata: {
        type: 'TICKET_PURCHASE', 
        event_id,
        tier_id,
        tier_name: tier.name,
        guest_email: email,       
        guest_name,
        reseller_code: reseller_code || "DIRECT",
        // This metadata is CRITICAL for your webhook later
        custom_fields: [
      {
        display_name: "Tier ID",
        variable_name: "tier_id",
        value: tier_id
      },
      {
        display_name: "Ticket Type",
        variable_name: "type",
        value: "TICKET_PURCHASE"
      }
    ]
      }
    };

    // If a subaccount exists, we apply the split
    if (subaccount) {
      paystackPayload.subaccount = subaccount;
      paystackPayload.transaction_charge = commissionInPesewas; 
      paystackPayload.bearer = "subaccount"; // Organizer pays the Paystack fee from their share
    }

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await paystackRes.json();

    if (!paystackRes.ok || !result.status) {
      console.error("Paystack Error:", result.message);
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Return everything needed for the frontend "setup" object
    return NextResponse.json({ 
      access_code: result.data.access_code,
      amount: amountInPesewas,
      email: email.trim()
    });

  } catch (err) {
    console.error("Server Crash:", err);
    return NextResponse.json({ error: "Internal Concierge Error" }, { status: 500 });
  }
}
