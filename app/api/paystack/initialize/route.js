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
            is_active,
            competitions (
              organizers (
                paystack_subaccount_code,
                business_name
              )
            )
          )
        `)
        .eq('id', candidate_id)
        .single();

      if (cError || !candidate) throw new Error('Candidate not found.');
      if (!candidate.contests.is_active) throw new Error('Voting is currently paused.');

      const organizerProfile = candidate.contests.competitions.organizers;
      
      // Safety Check: Validate Organizer Subaccount
      if (!organizerProfile?.paystack_subaccount_code || !organizerProfile.paystack_subaccount_code.startsWith('ACCT_')) {
        throw new Error('Competition organizer payout details are missing or invalid.');
      }

      const basePrice = candidate.contests.vote_price * vote_count;
      const totalInKobo = Math.round(basePrice * 100);
      const organizerShare = Math.round(totalInKobo * 0.95); // 5% platform commission

      finalAmount = basePrice;
      
      splitConfig = {
        type: "flat",
        bearer_type: "account",
        subaccounts: [
          {
            subaccount: organizerProfile.paystack_subaccount_code,
            share: organizerShare
          }
        ]
      };

      metadata = {
        ...metadata,
        candidate_id,
        vote_count,
        brand_name: organizerProfile.business_name,
        type: 'VOTE'
      };
    } 

    // --- CASE B: TICKET PURCHASE LOGIC ---
    else if (type === 'TICKET_PURCHASE') {
      const { tier_id } = body;

      const { data: tier, error: tierError } = await supabase
        .from('ticket_tiers')
        .select(`
          id, name, price, max_quantity, event_id, 
          events (
            id, 
            title, 
            organizer_id, 
            allows_resellers,
            organizers!events_organizer_profile_id_fkey ( 
              business_name,
              paystack_subaccount_code
            )
          )
        `)
        .eq('id', tier_id)
        .single();

      if (tierError || !tier) throw new Error('Ticket tier not found.');

      const organizerProfile = ticket_tiers.events?.organizers;

      // Safety Check: Validate Organizer Subaccount
      if (!organizerProfile?.paystack_subaccount_code || !organizerProfile.paystack_subaccount_code.startsWith('ACCT_')) {
        console.error("DEBUG: Organizer check failed. Profile data:", organizerProfile);
        throw new Error('This organizer is not set up for payouts yet.');
      }

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

      // Reseller Logic: Only execute if a code is provided and the event allows it
      if (reseller_code && tier.events.allows_resellers) {
        const { data: rData } = await supabase
          .from('event_resellers')
          .select('reseller_id, resellers(id, paystack_subaccount_code)')
          .eq('unique_code', reseller_code)
          .eq('event_id', tier.event_id)
          .single();

        // Only apply markup and reseller subaccount if the reseller is fully onboarded
        if (rData?.resellers?.paystack_subaccount_code?.startsWith('ACCT_')) {
          priceToCharge = tier.price * 1.10; // 10% Luxury Markup
          resellerId = rData.reseller_id;
          resellerSubaccount = rData.resellers.paystack_subaccount_code;
        } else {
          console.warn("Reseller code provided but reseller subaccount is missing or invalid.");
        }
      }

      const totalInKobo = Math.round(priceToCharge * 100);
      const baseInKobo = Math.round(tier.price * 100);
      
      // Organizer gets 95% of the BASE price
      const organizerShare = Math.round(baseInKobo * 0.95);

      finalAmount = priceToCharge;

      // Initialize split with the organizer
      splitConfig = {
        type: "flat",
        bearer_type: "account",
        subaccounts: [
          {
            subaccount: organizerProfile.paystack_subaccount_code,
            share: organizerShare
          }
        ]
      };

      // Add reseller to split ONLY if a valid subaccount was found
      if (resellerSubaccount) {
        const resellerShare = totalInKobo - baseInKobo;
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
        brand_name: organizerProfile.business_name,
        reseller_id: resellerId,
        organizer_id: tier.events.organizer_id
      };
    }

    // --- 3. PAYSTACK INITIALIZATION ---
    if (finalAmount <= 0) throw new Error('Invalid transaction amount.');

    const paystackPayload = {
      email: email || "customer@luxury.com",
      amount: Math.round(finalAmount * 100),
      metadata,
    };

    // Only include the split property if we actually have subaccounts
    if (splitConfig && splitConfig.subaccounts.length > 0) {
      paystackPayload.split = splitConfig;
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const data = await response.json();
    
    if (!data.status) {
      console.error("Paystack API Error Details:", data);
      throw new Error(data.message || "Paystack initialization failed");
    }

    return NextResponse.json({ 
      access_code: data.data.access_code,
      reference: data.data.reference 
    });

  } catch (error) {
    console.error('INITIALIZE_ERROR:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
