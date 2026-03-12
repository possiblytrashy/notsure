import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    let body;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

    const { reference } = body;
    if (!reference || typeof reference !== 'string' || reference.length > 200) {
      return NextResponse.json({ error: 'Valid payment reference required' }, { status: 400 });
    }

    // Sanitize reference — only alphanumeric and hyphens
    const safeRef = reference.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeRef) return NextResponse.json({ error: 'Invalid reference format' }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if ticket already exists (webhook processed)
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*, ticket_tiers(name)')
      .eq('reference', safeRef)
      .maybeSingle();

    if (ticket) {
      return NextResponse.json({
        success: true, guest_name: ticket.guest_name,
        tier_name: ticket.ticket_tiers?.name || ticket.tier_name,
        ticket_ready: true
      });
    }

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(safeRef)}`, {
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
    });
    const result = await paystackRes.json();

    if (!result.status || result.data?.status !== 'success') {
      return NextResponse.json({ success: false, error: `Payment status: ${result.data?.status || 'unknown'}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      guest_name: result.data.metadata?.guest_name || 'Guest',
      tier_name: result.data.metadata?.tier_name || 'Ticket',
      ticket_pending: true,
      amount: result.data.amount / 100
    });

  } catch (err) {
    console.error('Verification error:', err.message);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
