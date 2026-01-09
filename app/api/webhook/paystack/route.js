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

    // 2. Metadata Parsing
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
      organizer_id,
      guest_name, 
      name,
      reseller_code,
      base_price // Passed from your initialize route
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100;
    const reference = body.data.reference;
    const finalGuestName = guest_name || name || "Valued Guest";

    // --- CASE A: VOTING ---
    if (type === 'VOTE' || candidate_id) {
      const platformFee = amountPaid * 0.05;
      const netRevenue = amountPaid * 0.95;
      const votesToAdd = parseInt(vote_count) || 1;

      const { error: rpcError } = await supabase.rpc('increment_vote', { 
        candidate_id: candidate_id, 
        row_count: votesToAdd 
      });

      if (rpcError) throw new Error(`Vote RPC Error: ${rpcError.message}`);

      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: netRevenue,
        type: 'VOTE',
        reference: reference,
        candidate_id: candidate_id
      });
    } 
    
    // --- CASE B: TICKETING (Luxury Multi-tier & Reseller Support) ---
    else if (type === 'TICKET_PURCHASE' || type === 'TICKET' || tier_id) {
      // 1. Financial Reverse-Engineering
      // If a reseller was used, amountPaid includes a 10% markup on the base price.
      const actualBasePrice = base_price ? parseFloat(base_price) : (reseller_code && reseller_code !== "DIRECT" ? amountPaid / 1.10 : amountPaid);
      const platformFee = actualBasePrice * 0.05;
      const organizerAmount = actualBasePrice * 0.95;
      const resellerCommission = reseller_code && reseller_code !== "DIRECT" ? (amountPaid - actualBasePrice) : 0;

      const ticketHash = `OUST-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
      
      // A. QR Code Generation
      const qrDataUrl = await QRCode.toDataURL(ticketHash, {
        color: { dark: '#000000', light: '#ffffff' },
        width: 300
      });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // B. Storage Upload
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: qrUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(`qrs/${ticketHash}.png`);

      // C. Ticket Insertion
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id,
        tier_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        guest_name: finalGuestName,
        reference: reference,
        amount: amountPaid, // Full amount paid by customer
        status: 'valid',
        is_scanned: false,
        reseller_code: reseller_code || null
      });

      if (dbError) throw dbError;

      // D. Record Reseller Sale (Updates User Dashboard & Stats)
      if (reseller_code && reseller_code !== "DIRECT") {
        const { error: resellerRpcError } = await supabase.rpc('record_reseller_sale', {
          target_unique_code: reseller_code,
          t_ref: reference,
          t_amount: amountPaid,
          t_commission: resellerCommission
        });
        
        if (resellerRpcError) console.error("Reseller RPC Error:", resellerRpcError);
      }

      // E. Record Payout for Organizer
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerAmount,
        type: 'TICKET',
        reference: reference
      });

      // F. Fetch Event & Tier Details for Email
      const { data: eventDetails } = await supabase
        .from('events')
        .select('title, location_name, event_date, event_time')
        .eq('id', event_id)
        .single();

      const { data: tierDetails } = await supabase
        .from('ticket_tiers')
        .select('name')
        .eq('id', tier_id)
        .single();

      // G. Send Luxury Email
      await resend.emails.send({
        from: 'OUSTED <tickets@ousted.com>',
        to: email,
        subject: `Access Confirmed: ${eventDetails?.title || 'Exclusive Event'}`,
        html: generateLuxuryEmail(eventDetails, tierDetails, qrUrl, ticketHash, finalGuestName)
      });
    }

    return new Response('Webhook Handled Successfully', { status: 200 });

  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

function generateLuxuryEmail(event, tier, qrUrl, hash, guestName) {
  const displayDate = event?.event_date ? new Date(event.event_date).toLocaleDateString() : 'TBA';
  
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
          <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Guest Identity</p>
          <h2 style="color: #000; margin: 0 0 10px 0; font-size: 24px;">${guestName}</h2>
          <span style="background: #000; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 10px; font-weight: 800; text-transform: uppercase;">${tier?.name || 'Standard'} Access</span>

          <div style="margin-top: 30px; background: #f8f8f8; border: 1px solid #eee; border-radius: 20px; padding: 30px; display: inline-block;">
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
            <div style="display: flex; width: 100%;">
              <div style="flex: 1;">
                <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Date</p>
                <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${displayDate}</p>
              </div>
              <div style="flex: 1; text-align: right;">
                <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Time</p>
                <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${event?.event_time || 'TBA'}</p>
              </div>
            </div>
            <div style="margin-top: 15px; border-top: 1px solid #f0f0f0; padding-top: 15px;">
               <p style="color: #888; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 5px 0;">Location</p>
               <p style="color: #000; font-size: 14px; font-weight: 600; margin: 0;">${event?.location_name || 'Secret Location'}</p>
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
