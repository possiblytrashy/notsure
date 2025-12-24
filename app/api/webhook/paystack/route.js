import { createClient } from '@supabase/supabase-js';
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
