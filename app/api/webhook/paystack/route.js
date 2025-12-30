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

    // 1. Event Validation
    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // 2. Robust Metadata Parsing (Fixes Paystack Stringification issues)
    let rawMetadata = body.data.metadata;
    let metadata = {};
    
    try {
      metadata = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : (rawMetadata || {});
    } catch (e) {
      console.error("Metadata parsing failed:", e);
      metadata = rawMetadata || {};
    }

    // Destructure with defaults to prevent crashes
    const { 
      type, 
      event_id, 
      tier_id, 
      candidate_id, 
      vote_count, 
      organizer_id,
      guest_name, // Capture guest name if passed from frontend
      name        // Fallback key often used in forms
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100;
    const reference = body.data.reference;
    const finalGuestName = guest_name || name || "Valued Guest";

    // 3. Financial Split Logic (95% Organizer / 5% Platform)
    const platformFee = amountPaid * 0.05;
    const organizerShare = amountPaid * 0.95;

    // --- CASE A: VOTING ---
    if (type === 'VOTE' || candidate_id) {
      const votesToAdd = parseInt(vote_count) || 1;

      // A. Atomic Database Update
      const { error: rpcError } = await supabase.rpc('increment_vote', { 
        candidate_id: candidate_id, 
        row_count: votesToAdd 
      });

      if (rpcError) {
        console.error("Supabase RPC Error:", rpcError.message);
        throw new Error(`Vote Update Failed: ${rpcError.message}`);
      }

      // B. Accounting Log
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
    
    // --- CASE B: TICKETING ---
    else if (type === 'TICKET' || tier_id) {
      const ticketHash = `OUS-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
      
      // A. QR Code Generation
      const qrDataUrl = await QRCode.toDataURL(ticketHash, {
        color: { dark: '#000000', light: '#ffffff' },
        width: 300
      });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // B. Storage Upload
      const { error: uploadError } = await supabase.storage
        .from('media') // Ensure this bucket exists and is public
        .upload(`qrs/${ticketHash}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: qrUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(`qrs/${ticketHash}.png`);

      // C. Insert Ticket (Updated to match Dashboard Schema)
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id,
        tier_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        guest_name: finalGuestName, // Critical for Dashboard display
        reference: reference,       // Critical for Dashboard search
        amount: amountPaid,         // Critical for Dashboard revenue calc
        status: 'active',
        is_scanned: false
      });

      if (dbError) throw dbError;

      // D. Accounting Log
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerShare,
        type: 'TICKET',
        reference: reference
      });

      // E. Fetch Event Details for Email
      const { data: eventDetails } = await supabase
        .from('events')
        .select('title, location, date, time')
        .eq('id', event_id)
        .single();

      // F. Send Luxury Email
      await resend.emails.send({
        from: 'OUSTED <tickets@ousted.com>', // Update this to your verified domain
        to: email,
        subject: `Access Confirmed: ${eventDetails?.title || 'Exclusive Event'}`,
        html: generateLuxuryEmail(eventDetails, qrUrl, ticketHash, finalGuestName)
      });
    }

    return new Response('Webhook Handled Successfully', { status: 200 });

  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error.message);
    // Return 500 to trigger Paystack retry
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

// --- UPDATED LUXURY EMAIL TEMPLATE (Black/Pink/White) ---
function generateLuxuryEmail(event, qrUrl, hash, guestName) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
        
        <div style="background-color: #000000; padding: 40px 20px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; letter-spacing: 4px; font-weight: 900;">OUSTED<span style="color: #e73c7e;">.</span></h1>
          <p style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 10px;">Exclusive Event Access</p>
        </div>

        <div style="padding: 40px 30px; text-align: center;">
          <p style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Guest Name</p>
          <h2 style="color: #000; margin: 0 0 30px 0; font-size: 24px;">${guestName}</h2>

          <div style="background: #f8f8f8; border: 1px solid #eee; border-radius: 20px; padding: 30px; display: inline-block;">
            <img src="${qrUrl}" width="220" height="220" style="display: block; border-radius: 12px;" alt="Ticket QR"/>
            <div style="margin-top: 20px; padding: 12px 20px; background: #fff; border: 1px solid #eee; border-radius: 50px; display: inline-block;">
              <p style="margin: 0; font-family: monospace; font-size: 16px; color: #e73c7e; font-weight: bold; letter-spacing: 1px;">${hash}</p>
            </div>
          </div>

          <div style="margin-top: 40px; text-align: left; padding: 0 20px;">
            <div style="border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; margin-bottom: 15px;">
              <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Event</p>
              <p style="color: #000; font-size: 18px; font-weight: 600; margin: 0;">${event?.title || 'Unknown Event'}</p>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div>
                <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Date</p>
                <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${event?.date || 'TBA'}</p>
              </div>
              <div style="text-align: right;">
                <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Time</p>
                <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${event?.time || 'TBA'}</p>
              </div>
            </div>
            <div style="margin-top: 15px; border-top: 1px solid #f0f0f0; padding-top: 15px;">
               <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Location</p>
               <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${event?.location || 'Secret Location'}</p>
            </div>
          </div>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #999; font-size: 11px;">Present this QR code at the entrance for scanning.</p>
          <p style="margin: 5px 0 0 0; color: #e73c7e; font-size: 11px; font-weight: bold;">OUSTED. Experience Luxury.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
