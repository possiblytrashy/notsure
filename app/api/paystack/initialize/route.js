import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await req.json();
    const { type, email, guest_name, reseller_code } = body;

    let finalAmount = 0;
    let metadata = { type };
    let splitConfig = null;

    // --- CASE A: VOTING LOGIC ---
    if (type === 'VOTE') {
      const { candidate_id, vote_count } = body;

      const { data: candidate, error: cError } = await supabase
        .from('candidates')
        .select(`
          id, 
          name, 
          contests (
            id, 
            vote_price, 
            organizer_id, 
            is_active,
            competitions (paystack_subaccount)
          )
        `)
        .eq('id', candidate_id)
        .single();

      if (cError || !candidate) throw new Error('Candidate not found.');
      if (!candidate.contests.is_active) throw new Error('Voting is currently paused.');

      const basePrice = candidate.contests.vote_price * vote_count;
      const totalInKobo = Math.round(basePrice * 100);
      const organizerShare = Math.round(totalInKobo * 0.95);

      finalAmount = basePrice;
      
      // Split configuration for Voting (95% to Organizer)
      splitConfig = {
        type: "flat",
        bearer_type: "account",
        subaccounts: [
          {
            subaccount: candidate.contests.competitions.paystack_subaccount,
            share: organizerShare
          }
        ]
      };

      metadata = {
        ...metadata,
        candidate_id,
        vote_count,
        organizer_id: candidate.contests.organizer_id
      };
    } 

    // --- CASE B: TICKET PURCHASE LOGIC ---
    else if (type === 'TICKET_PURCHASE') {
      const { tier_id } = body;

      const { data: tier, error: tierError } = await supabase
        .from('ticket_tiers')
        .select(`
          id, name, price, max_quantity, event_id, 
          events (id, title, organizer_id, paystack_subaccount, allows_resellers)
        `)
        .eq('id', tier_id)
        .single();

      if (tierError || !tier) throw new Error('Ticket tier not found.');

      // Sold Out Check
      const { count: soldCount, error: countError } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('tier_id', tier_id)
        .eq('status', 'valid');

      if (countError) throw new Error('Error verifying availability.');
      if (tier.max_quantity && soldCount >= tier.max_quantity) {
        return NextResponse.json({ error: 'This tier is now SOLD OUT.' }, { status: 400 });
      }

      let priceToCharge = tier.price;
      let resellerId = null;
      let resellerSubaccount = null;

      // Reseller Logic
      if (reseller_code && tier.events.allows_resellers) {
        const { data: rData } = await supabase
          .from('event_resellers')
          .select('reseller_id, resellers(id, paystack_subaccount_code)')
          .eq('unique_code', reseller_code)
          .eq('event_id', tier.event_id)
          .single();

        if (rData) {
          priceToCharge = tier.price * 1.10; // 10% Markup
          resellerId = rData.reseller_id;
          resellerSubaccount = rData.resellers.paystack_subaccount_code;
        }
      }

      const totalInKobo = Math.round(priceToCharge * 100);
      const baseInKobo = Math.round(tier.price * 100);
      const organizerShare = Math.round(baseInKobo * 0.95);
      const resellerShare = totalInKobo - baseInKobo;

      finalAmount = priceToCharge;

      splitConfig = {
        type: "flat",
        bearer_type: "account",
        subaccounts: [
          {
            subaccount: tier.events.paystack_subaccount,
            share: organizerShare
          }
        ]
      };

      if (resellerSubaccount) {
        splitConfig.subaccounts.push({
          subaccount: resellerSubaccount,
          share: resellerShare
        });
      }

      metadata = {
        ...metadata,
        event_id: tier.event_id,
        tier_id,
        guest_name,
        reseller_id: resellerId,
        base_price: tier.price,
        organizer_id: tier.events.organizer_id
      };
    }

    // --- 3. PAYSTACK INITIALIZATION ---
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || "voter@ousted.com",
        amount: Math.round(finalAmount * 100),
        split: splitConfig,
        metadata
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
