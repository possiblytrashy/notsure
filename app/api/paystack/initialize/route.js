import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { tier_id, email, guest_name, reseller_code } = await req.json();

    // 1. SECURE FETCH: Get Tier, Event, and Organizer details directly from DB
    const { data: tier, error: tierError } = await supabase
      .from('ticket_tiers')
      .select(`
        id, 
        name, 
        price, 
        max_quantity, 
        event_id, 
        events (
          id,
          title, 
          organizer_id, 
          paystack_subaccount,
          allows_resellers
        )
      `)
      .eq('id', tier_id)
      .single();

    if (tierError || !tier) throw new Error('Ticket tier not found.');

    // 2. SOLD OUT CHECK: Count valid tickets already issued for this tier
    const { count: soldCount, error: countError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tier_id', tier_id)
      .eq('status', 'valid');

    if (countError) throw new Error('Error verifying availability.');
    
    // Check if limit is reached
    if (tier.max_quantity && soldCount >= tier.max_quantity) {
      return NextResponse.json({ error: 'This tier is now SOLD OUT.' }, { status: 400 });
    }

    // 3. RESELLER VALIDATION & PRICING
    let finalAmount = tier.price;
    let resellerId = null;
    let resellerSubaccount = null;

    if (reseller_code && tier.events.allows_resellers) {
      const { data: rData } = await supabase
        .from('event_resellers')
        .select('reseller_id, resellers(id, paystack_subaccount_code)')
        .eq('unique_code', reseller_code)
        .eq('event_id', tier.event_id)
        .single();

      if (rData) {
        // Apply the 110% Luxury Markup
        finalAmount = tier.price * 1.10;
        resellerId = rData.reseller_id;
        resellerSubaccount = rData.resellers.paystack_subaccount_code;
      }
    }

    // 4. CALCULATE THE 3-WAY SPLIT (In Kobo/Pesewas)
    const totalInKobo = Math.round(finalAmount * 100);
    const baseInKobo = Math.round(tier.price * 100);
    
    // Organizer gets 95% of the Base Price
    const organizerShare = Math.round(baseInKobo * 0.95);
    
    // Reseller gets the 10% Markup (Total - Base)
    const resellerShare = totalInKobo - baseInKobo;

    // 5. CONSTRUCT PAYSTACK SPLIT
    const splitConfig = {
      type: "flat",
      bearer_type: "account", // You (Main account) bear the transaction fees from your 5%
      subaccounts: [
        {
          subaccount: tier.events.paystack_subaccount,
          share: organizerShare
        }
      ]
    };

    // Add Reseller to split if applicable
    if (resellerSubaccount) {
      splitConfig.subaccounts.push({
        subaccount: resellerSubaccount,
        share: resellerShare
      });
    }

    // 6. INITIALIZE PAYSTACK
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: totalAmount,
        split: splitConfig, // Handles the automated payouts
        metadata: {
          type: 'TICKET_PURCHASE',
          event_id: tier.event_id,
          tier_id: tier_id,
          guest_name,
          reseller_id: resellerId,
          base_price: tier.price
        },
      }),
    });

    const data = await response.json();

    if (!data.status) throw new Error(data.message);

    return NextResponse.json({ 
      access_code: data.data.access_code,
      reference: data.data.reference 
    });

  } catch (error) {
    console.error('INITIALIZE_ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
