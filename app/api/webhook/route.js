import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  const data = await req.json();
  if (data.status !== 'successful') return new Response('Failed', { status: 400 });

  const { type, target_id } = data.meta;
  const phone = data.customer.phonenumber;

  if (type === 'TICKET') {
    const ticketHash = Buffer.from(`${target_id}-${Date.now()}`).toString('base64');
    
    // 1. Generate QR Code
    const qrBuffer = await QRCode.toBuffer(ticketHash);
    
    // 2. Upload to Supabase Storage
    await supabase.storage.from('media').upload(`qrs/${ticketHash}.png`, qrBuffer);
    const qrUrl = supabase.storage.from('media').getPublicUrl(`qrs/${ticketHash}.png`).data.publicUrl;

    // 3. Save Ticket
    await supabase.from('tickets').insert({ event_id: target_id, ticket_hash: ticketHash, customer_phone: phone });

    // 4. Send WhatsApp via Meta Cloud API
    await axios.post(`https://graph.facebook.com/v18.0/${process.env.META_PHONE_ID}/messages`, {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "ticket_delivery",
        language: { code: "en" },
        components: [
          { type: "header", parameters: [{ type: "image", image: { link: qrUrl } }] },
          { type: "body", parameters: [{ type: "text", text: ticketHash }] }
        ]
      }
    }, { headers: { Authorization: `Bearer ${process.env.META_TOKEN}` } });

  } else if (type === 'VOTE') {
    // Increment Vote Count in Database
    await supabase.rpc('increment_vote', { candidate_id: target_id });
  }

  return new Response('OK', { status: 200 });
}
