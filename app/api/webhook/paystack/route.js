import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req) {
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
    
    // 1. SIGNATURE VERIFICATION
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyText).digest('hex');
    const signature = req.headers.get('x-paystack-signature');

    if (hash !== signature) {
      console.error('WEBHOOK ERROR: Signature Mismatch.');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(bodyText);
    if (body.event !== 'charge.success') {
      return new Response('OK', { status: 200 });
    }

    const { reference, metadata, customer, amount } = body.data;
    console.log(`WEBHOOK: Processing Ref ${reference} for ${customer?.email}`);

    // 2. IDEMPOTENCY CHECK
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      console.log('WEBHOOK: Ticket already exists. Skipping.');
      return new Response('Already Processed', { status: 200 });
    }

    // 3. SMART METADATA EXTRACTION
    // We check root, then custom_fields to ensure we get the tier_id
    let tier_id = metadata?.tier_id;
    
    if (!tier_id && metadata?.custom_fields) {
      const foundField = metadata.custom_fields.find(f => f.variable_name === 'tier_id');
      if (foundField) tier_id = foundField.value;
    }

    if (!tier_id) {
      console.error('WEBHOOK ERROR: No tier_id found in metadata. Body:', JSON.stringify(metadata));
      return new Response('Missing Metadata', { status: 400 });
    }

    // 4. FETCH AUTHORITATIVE DATA
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('*, events(*)')
      .eq('id', tier_id)
      .single();

    if (tierErr || !tier) {
      console.error('WEBHOOK ERROR: Tier ID not in DB:', tier_id);
      return new Response('Tier Not Found', { status: 400 });
    }

    // 5. QR GENERATION & STORAGE
    const ticketNumber = `OUST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    let qrUrl = null;

    try {
      const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketNumber}`);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      
      const { error: uploadErr } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketNumber}.png`, qrBuffer, { 
          contentType: 'image/png', 
          upsert: true 
        });

      if (!uploadErr) {
        const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(`qrs/${ticketNumber}.png`);
        qrUrl = publicUrl.publicUrl;
      }
    } catch (e) {
      console.error('WEBHOOK: QR Process failed:', e.message);
    }

    // 6. DATABASE INSERT
    console.log('WEBHOOK: Inserting ticket...');
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
      console.error('WEBHOOK INSERT FAILED:', insertErr);
      return new Response('Database Error', { status: 500 });
    }

    // 7. PAYOUT TRACKING (Calculates your 5% commission)
    const amountGHS = amount / 100;
    const platformFee = amountGHS * 0.05;
    const organizerAmount = amountGHS - platformFee;

    await supabase.from('payouts').insert({
      organizer_id: tier.events?.organizer_profile_id,
      amount_total: amountGHS,
      platform_fee: platformFee,
      organizer_amount: organizerAmount,
      type: 'TICKET',
      reference: reference
    });

    console.log('WEBHOOK SUCCESS: Ticket Created', inserted.id);

    // 8. EMAIL DELIVERY
    if (RESEND_API_KEY) {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        from: 'Ousted <onboarding@resend.dev>',
        to: metadata.guest_email || customer.email,
        subject: `Your Ticket: ${tier.events?.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #000;">Access Confirmed!</h2>
            <p>Hi ${metadata.guest_name || 'Guest'},</p>
            <p>Your ticket for <strong>${tier.events?.title}</strong> is ready.</p>
            <div style="text-align: center; margin: 30px 0;">
              <img src="${qrUrl}" width="200" style="border: 10px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />
              <p style="font-weight: bold; font-size: 18px; margin-top: 10px;">${ticketNumber}</p>
            </div>
            <p style="font-size: 12px; color: #666;">Tier: ${tier.name}</p>
          </div>
        `
      }).catch(e => console.error('Email Error:', e.message));
    }

    return new Response('Success', { status: 200 });

  } catch (err) {
    console.error('WEBHOOK CRITICAL SYSTEM ERROR:', err.message);
    return new Response('Internal Error', { status: 500 });
  }
}
