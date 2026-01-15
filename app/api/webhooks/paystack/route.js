// FILE: app/api/webhooks/paystack/route.js
// Handles Paystack payment confirmations and updates vote counts + ticket records

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    // 1. Verify Paystack Signature
    const body = await req.text();
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    const signature = req.headers.get('x-paystack-signature');

    if (hash !== signature) {
      console.error('❌ Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('📥 Webhook received:', event.event);

    // 2. Only process successful charges
    if (event.event !== 'charge.success') {
      return NextResponse.json({ message: 'Event ignored' });
    }

    const { data } = event;
    const metadata = data.metadata;

    console.log('✅ Payment successful:', {
      reference: data.reference,
      amount: data.amount / 100,
      type: metadata.type
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 3. Route to appropriate handler based on purchase type
    if (metadata.type === 'VOTE') {
      await handleVotePayment(supabase, data, metadata);
    } else if (metadata.type === 'TICKET') {
      await handleTicketPayment(supabase, data, metadata);
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: err.message 
    }, { status: 500 });
  }
}

// ============================================================================
// VOTE PAYMENT HANDLER
// ============================================================================
async function handleVotePayment(supabase, data, metadata) {
  const {
    candidate_id,
    vote_count,
    voter_email,
    contest_id,
    competition_id
  } = metadata;

  console.log('🗳️ Processing vote payment:', {
    candidate_id,
    vote_count,
    reference: data.reference
  });

  // 1. Update candidate vote count using atomic increment
  const { data: candidate, error: updateError } = await supabase
    .from('candidates')
    .update({ 
      vote_count: supabase.raw(`vote_count + ${vote_count}`)
    })
    .eq('id', candidate_id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Failed to update vote count:', updateError);
    throw new Error('Failed to update vote count');
  }

  console.log('✅ Vote count updated:', {
    candidate_id,
    new_count: candidate.vote_count
  });

  // 2. Optional: Create vote transaction record for audit trail
  const { error: voteRecordError } = await supabase
    .from('vote_transactions')
    .insert({
      candidate_id: candidate_id,
      contest_id: contest_id,
      competition_id: competition_id,
      vote_count: vote_count,
      amount_paid: data.amount / 100, // Convert from pesewas
      voter_email: voter_email,
      payment_reference: data.reference,
      payment_status: 'successful',
      paid_at: new Date().toISOString()
    });

  if (voteRecordError) {
    // Don't throw - vote count already updated, this is just audit
    console.warn('⚠️ Failed to create vote record (non-critical):', voteRecordError);
  }
}

// ============================================================================
// TICKET PAYMENT HANDLER
// ============================================================================
async function handleTicketPayment(supabase, data, metadata) {
  const {
    event_id,
    tier_id,
    guest_email,
    guest_name,
    reseller_code,
    event_reseller_id,
    is_reseller_purchase
  } = metadata;

  console.log('🎫 Processing ticket payment:', {
    event_id,
    tier_id,
    reference: data.reference
  });

  // 1. Create ticket record
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      event_id: event_id,
      tier_id: tier_id,
      guest_email: guest_email,
      guest_name: guest_name || 'Guest',
      payment_reference: data.reference,
      payment_status: 'paid',
      reseller_code: reseller_code === 'DIRECT' ? null : reseller_code,
      event_reseller_id: event_reseller_id,
      purchased_at: new Date().toISOString()
    })
    .select()
    .single();

  if (ticketError) {
    console.error('❌ Failed to create ticket:', ticketError);
    throw new Error('Failed to create ticket');
  }

  console.log('✅ Ticket created:', ticket.id);

  // 2. If reseller purchase, update reseller stats
  if (is_reseller_purchase && event_reseller_id) {
    const { error: resellerUpdateError } = await supabase
      .from('event_resellers')
      .update({
        tickets_sold: supabase.raw('tickets_sold + 1'),
        total_revenue: supabase.raw(`total_revenue + ${metadata.reseller_commission}`)
      })
      .eq('id', event_reseller_id);

    if (resellerUpdateError) {
      console.warn('⚠️ Failed to update reseller stats:', resellerUpdateError);
    }
  }

  // 3. Update tier ticket count
  const { error: tierUpdateError } = await supabase
    .from('ticket_tiers')
    .update({
      tickets_sold: supabase.raw('tickets_sold + 1')
    })
    .eq('id', tier_id);

  if (tierUpdateError) {
    console.warn('⚠️ Failed to update tier stats:', tierUpdateError);
  }
}
