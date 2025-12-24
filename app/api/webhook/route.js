import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import axios from 'axios';

// Admin client to bypass RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const secret = process.env.FLW_SECRET_HASH;
  const signature = req.headers.get('verif-hash');
  
  if (!signature || signature !== secret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = await req.json();

  if (payload.status === 'successful') {
    const { eventId, userId } = payload.meta;
    const { email, phone_number } = payload.customer;

    // 1. Generate Unique Ticket ID
    const ticketNum = `TIX-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // 2. Generate QR Code Image
    const qrBuffer = await QRCode.toBuffer(ticketNum);
    const { data: uploadData } = await supabaseAdmin.storage
      .from('tickets')
      .upload(`${ticketNum}.png`, qrBuffer, { contentType: 'image/png' });

    const qrUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tickets/${ticketNum}.png`;

    // 3. Save to DB
    await supabaseAdmin.from('tickets').insert({
      event_id: eventId,
      user_email: email,
      user_phone: phone_number,
      ticket_number: ticketNum,
      qr_code_url: qrUrl
    });

    // 4. Send WhatsApp via Meta
    await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.META_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "template",
        template: {
          name: "ticket_confirmation", // Must match Meta template
          language: { code: "en" },
          components: [
            { type: "header", parameters: [{ type: "image", image: { link: qrUrl } }] },
            { type: "body", parameters: [
                { type: "text", text: "Event Guest" }, 
                { type: "text", text: "Lumina Event" }, 
                { type: "text", text: ticketNum }
            ]}
          ]
        }
      },
      { headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` } }
    );
  }

  return NextResponse.json({ received: true });
}
