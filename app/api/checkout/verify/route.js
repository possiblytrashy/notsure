// FILE PATH: app/api/checkout/verify/route.js
// This is a NEW file - create this endpoint

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { reference } = await req.json();

    if (!reference) {
      return NextResponse.json({ 
        error: 'Payment reference required' 
      }, { status: 400 });
    }

    console.log("Verifying payment:", reference);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Check if ticket already exists (webhook already processed)
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*, ticket_tiers(name)')
      .eq('reference', reference)
      .maybeSingle();

    if (ticket) {
      console.log("✅ Ticket found in database:", ticket.ticket_number);
      return NextResponse.json({
        success: true,
        guest_name: ticket.guest_name,
        tier_name: ticket.ticket_tiers?.name || ticket.tier_name,
        ticket_ready: true
      });
    }

    // 2. If webhook hasn't processed yet, verify payment with Paystack
    console.log("Ticket not found, verifying with Paystack...");
    
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const result = await paystackRes.json();

    if (!result.status) {
      console.error("Paystack verification failed:", result.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Payment verification failed' 
      }, { status: 400 });
    }

    if (result.data.status === 'success') {
      console.log("✅ Payment confirmed by Paystack, waiting for webhook...");
      
      // Payment is confirmed, webhook will create ticket
      return NextResponse.json({
        success: true,
        guest_name: result.data.metadata?.guest_name || 'Guest',
        tier_name: 'Ticket',
        ticket_pending: true, // Indicates webhook is processing
        amount: result.data.amount / 100
      });
    }

    // Payment failed or pending
    console.log("❌ Payment not successful:", result.data.status);
    return NextResponse.json({ 
      success: false, 
      error: `Payment status: ${result.data.status}` 
    }, { status: 400 });

  } catch (err) {
    console.error('Verification error:', err);
    return NextResponse.json({ 
      error: 'Verification failed',
      details: err.message 
    }, { status: 500 });
  }
}
