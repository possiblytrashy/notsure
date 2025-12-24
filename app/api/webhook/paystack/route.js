import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import axios from 'axios';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  const body = await req.json();
  
  // 1. Verify the Paystack Signature (Security)
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(body)).digest('hex');
  if (hash !== req.headers.get('x-paystack-signature')) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (body.event === 'charge.success') {
    const { event_id } = body.data.metadata;
    const phone = body.data.metadata.custom_fields[0].value;
    const ticketId = `LMN-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // 2. Generate QR Code
    const qrBuffer = await QRCode.toBuffer(ticketId);
    
    // 3. Upload to Supabase
    const fileName = `qrs/${ticketId}.png`;
    await supabase.storage.from('media').upload(fileName, qrBuffer);
    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);

    // 4. Save to DB
    await supabase.from('tickets').insert({
      event_id: event_id,
      ticket_number: ticketId,
      customer_phone: phone,
      qr_url: publicUrl
    });

    // 5. Send WhatsApp via Meta
    await axios.post(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_ID}/messages`, {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "ticket_delivery_bright", // Your approved Meta template
        language: { code: "en" },
        components: [
          { type: "header", parameters: [{ type: "image", image: { link: publicUrl } }] },
          { type: "body", parameters: [
            { type: "text", text: body.data.customer.first_name || "Guest" },
            { type: "text", text: ticketId }
          ]}
        ]
      }
    }, {
      headers: { Authorization: `Bearer ${process.env.META_TOKEN}` }
    });
  }

  return new Response('OK', { status: 200 });
}
