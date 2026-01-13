import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  // 1. IMMEDIATE LOGGING (Proof of life)
  console.log('--- WEBHOOK ATTEMPT START ---');

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const bodyText = await req.text();
    
    // 2. SIGNATURE VERIFICATION
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyText).digest('hex');
    const signature = req.headers.get('x-paystack-signature');

    if (hash !== signature) {
      console.error('WEBHOOK ERROR: Signature Mismatch. Check PAYSTACK_SECRET_KEY.');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(bodyText);
    if (body.event !== 'charge.success') {
      console.log('WEBHOOK: Event is not charge.success, ignoring.');
      return new Response('OK', { status: 200 });
    }

    const { reference, metadata, customer, amount } = body.data;
    console.log(`WEBHOOK: Processing Ref ${reference} for ${customer?.email}`);
    console.log('WEBHOOK: Metadata Received:', JSON.stringify(metadata));

    // 3. IDEMPOTENCY CHECK
    const { data: existing } = await supabase.from('tickets').select('id').eq('reference', reference).maybeSingle();
    if (existing) {
      console.log('WEBHOOK: Ticket already exists for this reference. Exiting.');
      return new Response('Already Processed', { status: 200 });
    }

    // 4. DATA PREP (Using tier_id from your secure-session route)
    const tier_id = metadata?.tier_id;
    if (!tier_id) {
      console.error('WEBHOOK ERROR: No tier_id found in metadata. Check your checkout route.');
      return new Response('Missing Metadata', { status: 400 });
    }

    // 5. FETCH DATA FROM DB
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('*, events(*)')
      .eq('id', tier_id)
      .single();

    if (tierErr || !tier) {
      console.error('WEBHOOK ERROR: Tier ID does not exist in Database:', tier_id);
      return new Response('Tier Not Found', { status: 400 });
    }

    // 6. QR & STORAGE
    const ticketNumber = `OUST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    let qrUrl = null;

    try {
      const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketNumber}`);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketNumber}.png`, qrBuffer, { contentType: 'image/png', upsert: true });

      if (uploadErr) {
        console.error('WEBHOOK: Storage upload failed, but continuing...', uploadErr.message);
      } else {
        qrUrl = `${SUPABASE_URL}/storage/v1/object/public/media/qrs/${ticketNumber}.png`;
      }
    } catch (e) {
      console.error('WEBHOOK: QR Logic failed:', e.message);
    }

    // 7. THE INSERT (The moment of truth)
    console.log('WEBHOOK: Attempting Database Insert...');
    const { data: inserted, error: insertErr } = await supabase
      .from('tickets')
      .insert({
        event_id: tier.event_id,
        tier_id: tier.id,
        tier_name: tier.name,
        ticket_number: ticketNumber,
        qr_code_url: qrUrl,
        user_email: customer.email,
        guest_email: metadata.guest_email || customer.email,
        guest_name: metadata.guest_name || 'Guest',
        reference: reference,
        amount: amount / 100,
        status: 'valid'
      })
      .select()
      .single();

    if (insertErr) {
      console.error('WEBHOOK INSERT FAILED:', JSON.stringify(insertErr, null, 2));
      return new Response('Database Error', { status: 500 });
    }

    console.log('WEBHOOK SUCCESS: Ticket ID', inserted.id);

    // 8. EMAIL (Non-blocking)
    if (RESEND_API_KEY) {
        const resend = new Resend(RESEND_API_KEY);
        await resend.emails.send({
            from: 'Ousted <onboarding@resend.dev>',
            to: metadata.guest_email || customer.email,
            subject: `Confirmed: ${tier.events.title}`,
            html: `<h1>Your Ticket: ${ticketNumber}</h1><img src="${qrUrl}" />`
        }).catch(e => console.error('Email failed:', e.message));
    }

    return new Response('Success', { status: 200 });

  } catch (err) {
    console.error('WEBHOOK CRITICAL SYSTEM ERROR:', err.message);
    return new Response('Internal Error', { status: 500 });
  }
}
