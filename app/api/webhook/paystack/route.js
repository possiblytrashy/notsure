import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // Filter for successful charges only
    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // --- CRITICAL FIX: METADATA PARSING ---
    // Paystack often stringifies metadata. We must parse it if it's a string.
    let rawMetadata = body.data.metadata;
    let metadata = {};
    
    try {
      metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : (rawMetadata || {});
    } catch (e) {
      console.error("Metadata parsing failed:", e);
      metadata = rawMetadata || {};
    }

    const { 
      type, 
      event_id, 
      tier_id, 
      candidate_id, 
      vote_count, 
      organizer_id 
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100;
    const reference = body.data.reference;

    // Financial Split Logic (5% / 95%)
    const platformFee = amountPaid * 0.05;
    const organizerShare = amountPaid * 0.95;

    // --- CASE A: VOTE HANDLING ---
    // We check for 'VOTE' type OR the presence of a candidate_id
    if (type === 'VOTE' || candidate_id) {
      const votesToAdd = parseInt(vote_count) || 1;

      // 1. Trigger the SQL Function
      const { error: rpcError } = await supabase.rpc('increment_vote', { 
        candidate_id: candidate_id, 
        row_count: votesToAdd 
      });

      if (rpcError) {
        console.error("Supabase RPC Error:", rpcError.message);
        throw new Error(`Database Update Failed: ${rpcError.message}`);
      }

      // 2. Record Payout for Accounting
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerShare,
        type: 'VOTE',
        reference: reference,
        candidate_id: candidate_id
      });
    } 
    
    // --- CASE B: TICKET HANDLING ---
    else if (type === 'TICKET' || tier_id) {
      const ticketHash = `LUM-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
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

      // Save Ticket Entry
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id,
        tier_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        amount_paid: amountPaid,
        status: 'active'
      });

      if (dbError) throw dbError;

      // Save Payout Entry
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerShare,
        type: 'TICKET',
        reference: reference
      });

      // Fetch Details and Email
      const { data: eventDetails } = await supabase
        .from('events')
        .select('title, location, date, time')
        .eq('id', event_id)
        .single();

      await resend.emails.send({
        from: 'Lumina <onboarding@resend.dev>',
        to: email,
        subject: `Your Ticket for ${eventDetails?.title || 'the Experience'}`,
        html: generateLuxuryEmail(eventDetails, qrUrl, ticketHash)
      });
    }

    return new Response('Webhook Handled Successfully', { status: 200 });

  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error.message);
    // Return 500 so Paystack knows to retry later
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

function generateLuxuryEmail(event, qrUrl, hash) {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: auto; padding: 40px; background-color: #fff; border: 1px solid #eee; border-radius: 40px;">
      <h1 style="text-align:center; letter-spacing:-2px; font-weight:900; color: #000;">LUMINA</h1>
      <div style="margin: 30px 0; padding: 30px; background: #f9f9f9; border-radius: 30px; text-align:center;">
        <img src="${qrUrl}" width="200" style="margin-bottom:20px; border-radius:15px; border: 1px solid #eee;" />
        <h2 style="margin:0; font-size: 22px;">${event?.title || 'Event Access'}</h2>
        <p style="color:#64748b; font-size: 14px;">${event?.date || ''} • ${event?.time || ''}</p>
        <div style="margin-top: 20px; padding: 10px; background: #fff; border-radius: 12px; display: inline-block;">
            <p style="font-family:monospace; color:#0ea5e9; font-weight:bold; margin:0; font-size: 18px;">${hash}</p>
        </div>
      </div>
      <p style="text-align:center; color: #94a3b8; font-size: 12px;">This is a premium digital asset. Do not share your QR code.</p>
    </div>
  `;
}
