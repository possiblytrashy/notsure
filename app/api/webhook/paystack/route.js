import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

// This is key for Vercel build success
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // 1. Initialize inside the POST function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Paystack sends a signature to verify the request is authentic
    const signature = req.headers.get('x-paystack-signature');
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // Log the event for debugging
    console.log("Paystack Webhook Received:", body.event);

    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // --- UPDATED METADATA DESTRUCTURING ---
    // We now expect tier_id and event_id from the metadata passed during payment initialization
    const { type, event_id, tier_id, candidate_id } = body.data.metadata || {};
    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100; // Convert from pesewas/kobo to GHS

    if (type === 'VOTE') {
      await supabase.rpc('increment_vote', { candidate_id: candidate_id });
    } 
    
    else if (type === 'TICKET') {
      // 1. Generate Unique Ticket Hash
      const ticketHash = `LUM-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
      
      // 2. Generate QR Code
      const qrDataUrl = await QRCode.toDataURL(ticketHash);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // 3. Upload QR to Supabase Storage (Bucket name: 'media')
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, { 
            contentType: 'image/png',
            upsert: true 
        });

      if (uploadError) throw uploadError;

      const qrUrl = supabase.storage.from('media').getPublicUrl(`qrs/${ticketHash}.png`).data.publicUrl;

      // 4. Save Ticket to Database with Tier Information
      // This ensures we know exactly which ticket type was purchased
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id: event_id,
        tier_id: tier_id, // Added to track VIP vs Regular
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        amount_paid: amountPaid,
        status: 'active'
      });

      if (dbError) throw dbError;

      // 5. Fetch Event Details for the Email
      const { data: eventDetails } = await supabase
        .from('events')
        .select('title, location, date, time')
        .eq('id', event_id)
        .single();

      // 6. Send Premium Email via Resend
      await resend.emails.send({
        from: 'Lumina <onboarding@resend.dev>',
        to: email,
        subject: `Your Ticket for ${eventDetails?.title || 'the Experience'}`,
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 500px; margin: auto; text-align: center; border: 1px solid #f1f5f9; padding: 40px; border-radius: 40px; background-color: #ffffff;">
            <h1 style="color: #000; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin-bottom: 5px;">LUMINA</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 0;">Order Confirmed</p>
            
            <div style="margin: 30px 0; padding: 30px; background: #f8fafc; border-radius: 30px; border: 1px dashed #e2e8f0;">
                <img src="${qrUrl}" width="200" height="200" style="display: block; margin: auto; border-radius: 10px;" />
                <h2 style="margin: 20px 0 5px 0; font-size: 20px; font-weight: 800;">${eventDetails?.title}</h2>
                <p style="margin: 0; color: #64748b; font-size: 14px;">${eventDetails?.date} at ${eventDetails?.time}</p>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${eventDetails?.location}</p>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                  <p style="font-family: monospace; font-weight: bold; color: #6366f1; font-size: 18px; margin: 0;">${ticketHash}</p>
                </div>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">
              Please have this QR code ready at the entrance.<br/>
              This ticket is valid for one-time entry only.
            </p>
          </div>
        `
      });
    }

    return new Response('Webhook Handled', { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error.message);
    // Returning 200 even on error prevents Paystack from retrying 
    // infinitely if the error is permanent (like a DB constraint)
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

// This is key for Vercel build success
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    // 1. Initialize inside the POST function to protect the build process
    const supabase = createClient(
      process.env.SUPABASE_URL, 
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const body = await req.json();

    // Log the event for debugging in Vercel logs
    console.log("Paystack Webhook Received:", body.event);

    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // Ensure metadata exists to avoid crashes
    const { type, target_id } = body.data.metadata || {};
    const email = body.data.customer.email;

    if (type === 'VOTE') {
      await supabase.rpc('increment_vote', { candidate_id: target_id });
    } 
    
    else if (type === 'TICKET') {
      const ticketHash = `TIX-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
      
      // Generate QR Code as a Data URL or Buffer
      const qrDataUrl = await QRCode.toDataURL(ticketHash);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // 2. Upload QR to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, { 
            contentType: 'image/png',
            upsert: true 
        });

      if (uploadError) throw uploadError;

      const qrUrl = supabase.storage.from('media').getPublicUrl(`qrs/${ticketHash}.png`).data.publicUrl;

      // 3. Save Ticket to Database
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id: target_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        status: 'active'
      });

      if (dbError) throw dbError;

      // 4. Send Email via Resend
      await resend.emails.send({
        from: 'Lumina <onboarding@resend.dev>', // Change to your verified domain later
        to: email,
        subject: 'Your Digital Ticket is Ready!',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: auto; text-align: center; border: 1px solid #eee; padding: 40px; border-radius: 30px;">
            <h1 style="color: #6366f1; font-size: 32px; letter-spacing: -1px;">LUMINA</h1>
            <p style="color: #4b5563; font-size: 16px;">Your payment was successful. Here is your entry pass:</p>
            <div style="margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 20px;">
                <img src="${qrUrl}" width="200" height="200" style="display: block; margin: auto;" />
                <p style="font-family: monospace; font-weight: bold; color: #6366f1; margin-top: 15px;">${ticketHash}</p>
            </div>
            <p style="color: #9ca3af; font-size: 12px;">Show this QR code at the gate for scanning.</p>
          </div>
        `
      });
    }

    return new Response('Webhook Handled', { status: 200 });

  } catch (error) {
    console.error('Webhook Error:', error.message);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
