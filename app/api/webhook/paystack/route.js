import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use Service Role for DB bypass
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // 1. Extract Data
    const { type, event_id, tier_id, candidate_id, organizer_id } = body.data.metadata || {};
    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100; // Total in GHS

    // 2. CALCULATE 5% COMMISSION SPLIT
    const platformFee = amountPaid * 0.05;
    const organizerShare = amountPaid * 0.95;

    // --- CASE A: VOTE HANDLING ---
    if (type === 'VOTE' || candidate_id) {
      // Increment the vote count
      await supabase.rpc('increment_vote', { candidate_id: candidate_id });
      
      // Record the financial split for your luxury dashboard
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerShare,
        type: 'VOTE',
        reference: body.data.reference
      });
    } 
    
    // --- CASE B: TICKET HANDLING ---
    else if (type === 'TICKET' || tier_id) {
      const ticketHash = `LUM-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
      
      // Generate QR
      const qrDataUrl = await QRCode.toDataURL(ticketHash);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // Upload QR
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const qrUrl = supabase.storage.from('media').getPublicUrl(`qrs/${ticketHash}.png`).data.publicUrl;

      // Save Ticket & Payout
      await supabase.from('tickets').insert({
        event_id,
        tier_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        amount_paid: amountPaid,
        status: 'active'
      });

      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerShare,
        type: 'TICKET',
        reference: body.data.reference
      });

      // Fetch Event Details
      const { data: eventDetails } = await supabase
        .from('events')
        .select('title, location, date, time')
        .eq('id', event_id)
        .single();

      // Send Luxury Email
      await resend.emails.send({
        from: 'Lumina <onboarding@resend.dev>',
        to: email,
        subject: `Your Ticket for ${eventDetails?.title || 'the Experience'}`,
        html: generateLuxuryEmail(eventDetails, qrUrl, ticketHash)
      });
    }

    return new Response('Webhook Handled', { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Helper for Luxury Email
function generateLuxuryEmail(event, qrUrl, hash) {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: auto; padding: 40px; background-color: #fff; border: 1px solid #eee; border-radius: 40px;">
      <h1 style="text-align:center; letter-spacing:-2px; font-weight:900;">LUMINA</h1>
      <div style="margin: 30px 0; padding: 30px; background: #f9f9f9; border-radius: 30px; text-align:center;">
        <img src="${qrUrl}" width="200" style="margin-bottom:20px; border-radius:15px;" />
        <h2 style="margin:0;">${event?.title}</h2>
        <p style="color:#666;">${event?.date} • ${event?.time}</p>
        <p style="font-family:monospace; color:#0ea5e9; font-weight:bold; margin-top:15px;">${hash}</p>
      </div>
    </div>
  `;
}
