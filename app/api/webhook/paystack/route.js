// FILE: app/api/webhooks/paystack/route.js
// REPLACE your webhook with this version that tracks reseller sales

import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  console.log('--- WEBHOOK RECEIVED ---');

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
      console.error('❌ WEBHOOK: Invalid signature');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(bodyText);
    
    if (body.event !== 'charge.success') {
      console.log('Ignoring event:', body.event);
      return new Response('OK', { status: 200 });
    }

    const { reference, metadata, customer, amount } = body.data;
    console.log(`Processing payment: ${reference} for ${customer?.email}`);

    // 2. IDEMPOTENCY CHECK
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      console.log('✅ Ticket already exists, skipping');
      return new Response('Already Processed', { status: 200 });
    }

    // 3. EXTRACT tier_id
    let tier_id = metadata?.tier_id;
    
    if (!tier_id && metadata?.custom_fields) {
      const foundField = metadata.custom_fields.find(f => f.variable_name === 'tier_id');
      if (foundField) tier_id = foundField.value;
    }

    if (!tier_id) {
      console.error('❌ WEBHOOK: No tier_id in metadata');
      return new Response('Missing tier_id', { status: 400 });
    }

    // 4. FETCH TIER DATA
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('*, events(*)')
      .eq('id', tier_id)
      .single();

    if (tierErr || !tier) {
      console.error('❌ WEBHOOK: Tier not found:', tier_id);
      return new Response('Tier Not Found', { status: 400 });
    }

    // 5. GENERATE QR CODE
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
      console.error('QR generation failed:', e.message);
    }

    // 6. CREATE TICKET
    console.log('Creating ticket...');
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
      console.error('❌ Database insert failed:', insertErr);
      return new Response('Database Error', { status: 500 });
    }

    console.log('✅ Ticket created:', inserted.id);

    // 7. PROCESS RESELLER SALE (if applicable)
    const isResellerPurchase = metadata?.is_reseller_purchase;
    const eventResellerId = metadata?.event_reseller_id;
    const resellerCommission = metadata?.reseller_commission;

    if (isResellerPurchase && eventResellerId && resellerCommission) {
      console.log('💰 Processing reseller sale...');

      // Record the sale
      await supabase.from('reseller_sales').insert({
        event_reseller_id: eventResellerId,
        ticket_ref: reference,
        amount: amount / 100,
        commission_earned: Number(resellerCommission),
        paid: false // Will be paid out later
      });

      // Update reseller stats
      await supabase.rpc('increment_reseller_sale', {
        link_id: eventResellerId,
        commission_amt: Number(resellerCommission)
      });

      console.log('✅ Reseller sale recorded:', resellerCommission);
    }

    // 8. ORGANIZER PAYOUT TRACKING
    const amountGHS = amount / 100;
    const basePrice = metadata?.base_price || amountGHS;
    const platformFee = basePrice * 0.05;
    
    // Organizer gets: base price - platform fee (if reseller purchase)
    // or total - platform fee (if direct purchase)
    const organizerAmount = isResellerPurchase 
      ? basePrice - platformFee 
      : amountGHS - platformFee;

    await supabase.from('payouts').insert({
      organizer_id: tier.events?.organizer_profile_id,
      amount_total: amountGHS,
      platform_fee: platformFee,
      organizer_amount: organizerAmount,
      type: 'TICKET',
      reference: reference
    });

    // 9. SEND EMAIL
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
            ${isResellerPurchase ? '<p style="font-size: 11px; color: #999;">Purchased via affiliate partner</p>' : ''}
          </div>
        `
      }).catch(e => console.error('Email error:', e.message));
    }

    return new Response('Success', { status: 200 });

  } catch (err) {
    console.error('❌ WEBHOOK ERROR:', err.message);
    return new Response('Internal Error', { status: 500 });
  }
}
