import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  const body = await req.json();
  if (body.event !== 'charge.success') return new Response('OK');

  const { type, target_id } = body.data.metadata;
  const email = body.data.customer.email;

  if (type === 'VOTE') {
    await supabase.rpc('increment_vote', { candidate_id: target_id });
  } 
  
  else if (type === 'TICKET') {
    const ticketHash = `TIX-${Math.random().toString(36).toUpperCase().substring(2, 10)}`;
    const qrBuffer = await QRCode.toBuffer(ticketHash);

    // 1. Upload QR to Supabase Storage
    const { data } = await supabase.storage.from('media').upload(`qrs/${ticketHash}.png`, qrBuffer, { contentType: 'image/png' });
    const qrUrl = supabase.storage.from('media').getPublicUrl(`qrs/${ticketHash}.png`).data.publicUrl;

    // 2. Save Ticket to Database
    await supabase.from('tickets').insert({
      event_id: target_id,
      ticket_hash: ticketHash,
      qr_url: qrUrl,
      customer_email: email,
      status: 'active'
    });

    // 3. Send High-End Email (Resend)
    await resend.emails.send({
      from: 'Lumina <tickets@yourdomain.com>',
      to: email,
      subject: 'Your Digital Ticket is Ready!',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; text-align: center; border: 1px solid #eee; padding: 20px; border-radius: 20px;">
          <h1 style="color: #6366f1;">LUMINA</h1>
          <p>Your ticket for the event is confirmed.</p>
          <img src="${qrUrl}" width="250" style="margin: 20px 0;" />
          <p style="font-weight: bold; font-size: 18px;">ID: ${ticketHash}</p>
          <p style="color: #666; font-size: 12px;">Present this QR code at the entrance.</p>
        </div>
      `
    });
  }

  return new Response('OK');
}
