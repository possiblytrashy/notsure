import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Admin Client (Bypasses RLS for Guest Payments)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { event_id, tier_id, tier_index, email, guest_name, reseller_code } = await req.json();

    if (!event_id || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch Event & Organizer Details
    // We select ticket_tiers (JSONB) and organizer info
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select(`
        *,
        organizers:organizer_profile_id (
          paystack_subaccount_code
        )
      `)
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 2. Find the selected tier in the JSONB array
    let tier = null;
    if (event.ticket_tiers && Array.isArray(event.ticket_tiers)) {
      // Try finding by ID first
      tier = event.ticket_tiers.find(t => t.id === tier_id);
      
      // Fallback: Use index if provided and valid
      if (!tier && typeof tier_index === 'number' && event.ticket_tiers[tier_index]) {
        tier = event.ticket_tiers[tier_index];
      }
    }

    if (!tier) {
      return NextResponse.json({ error: 'Invalid ticket tier selected' }, { status: 400 });
    }

    // 3. Determine Price (Handle Reseller Markup)
    let amount = parseFloat(tier.price);
    
    // If reseller code exists, we verify it (Optional: You can add DB check here)
    // For now, we apply the 10% markup if code is present
    if (reseller_code) {
      amount = amount * 1.10; 
    }

    // Paystack expects amount in kobo (multiply by 100)
    const amountInKobo = Math.round(amount * 100);

    // 4. Determine Subaccount for Split
    // Prioritize direct column, fallback to joined organizer profile
    const subaccount = event.organizer_subaccount || event.organizers?.paystack_subaccount_code;

    if (!subaccount) {
      return NextResponse.json({ error: 'Organizer payout not configured' }, { status: 400 });
    }

    // 5. Initialize Paystack Transaction
    const paystackPayload = {
      email,
      amount: amountInKobo,
      metadata: {
        custom_fields: [
          { display_name: "Guest Name", variable_name: "guest_name", value: guest_name },
          { display_name: "Event", variable_name: "event_title", value: event.title },
          { display_name: "Tier", variable_name: "tier_name", value: tier.name },
          { display_name: "Reseller Ref", variable_name: "reseller_ref", value: reseller_code || "NONE" }
        ],
        event_id: event.id,
        tier_id: tier.id || `tier_idx_${tier_index}`, // Save ID or fallback to index marker
        tier_name: tier.name
      },
      subaccount,
      transaction_charge: Math.round(amountInKobo * 0.05), // 5% Platform Fee
      bearer: "subaccount" // Organizer pays the fee from their share
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

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Paystack initialization failed');
    }

    return NextResponse.json({ access_code: paystackData.data.access_code });

  } catch (err) {
    console.error('Paystack API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
