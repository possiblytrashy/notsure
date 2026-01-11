import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * LUXURY WEBHOOK CONCIERGE
 * Handles: Signature Security, Tiered Ticketing, 5% Splits, 10% Markups,
 * QR Storage, and Automated Reseller Payouts.
 */
export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const bodyText = await req.text();

    // --- 1. SECURITY: VERIFY PAYSTACK SIGNATURE ---
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(bodyText)
      .digest('hex');

    if (hash !== req.headers.get('x-paystack-signature')) {
      return new Response('Unauthorized: Signature mismatch', { status: 401 });
    }

    const body = JSON.parse(bodyText);

    // Filter for successful charges only
    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    // --- 2. METADATA & DATA PARSING ---
    const metadata = body.data.metadata || {};
    const {
      type,
      event_id,
      tier_id,
      candidate_id,
      vote_count,
      organizer_id,
      guest_name,
      reseller_code
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100; // Total GHS including potential markups
    const reference = body.data.reference;
    const finalGuestName = guest_name || 'Valued Guest';

    /* ======================================================
       CASE A: VOTING LOGIC
    ====================================================== */
    if (type === 'VOTE' || candidate_id) {
      const platformFee = amountPaid * 0.05;
      const netRevenue = amountPaid * 0.95;
      const votesToAdd = parseInt(vote_count) || 1;

      const { error: rpcError } = await supabase.rpc('increment_vote', {
        candidate_id: candidate_id,
        row_count: votesToAdd,
      });

      if (rpcError) throw new Error(`Vote RPC Error: ${rpcError.message}`);

      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: netRevenue,
        type: 'VOTE',
        reference: reference,
        candidate_id: candidate_id,
      });
    }

    /* ======================================================
       CASE B: MULTI-TIER LUXURY TICKETING
    ====================================================== */
    else if (type === 'TICKET_PURCHASE' || tier_id) {
      
      // 1. Fetch Source of Truth from DB (Prevents price tampering)
      const { data: tierData, error: tierError } = await supabase
        .from('ticket_tiers')
        .select('*, events(title, location_name, event_date, event_time, organizer_profile_id)')
        .eq('id', tier_id)
        .single();

      if (tierError || !tierData) throw new Error("Tier verification failed.");

      // 2. Financial Engineering
      // actualBasePrice = The original tier price (e.g. 100)
      // reseller_code triggers a 10% markup (e.g. 110)
      const actualBasePrice = parseFloat(tierData.price);
      const platformFee = actualBasePrice * 0.05;
      const organizerAmount = actualBasePrice * 0.95;
      
      // Calculate reseller commission (anything above the base price)
      const resellerCommission = (amountPaid > actualBasePrice) 
        ? (amountPaid - actualBasePrice) 
        : 0;

      // 3. QR Generation & Storage
      const ticketHash = `OUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketHash}|REF:${reference}`, {
        width: 400,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: qrUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(`qrs/${ticketHash}.png`);

      // 4. Atomic Ticket Creation
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id,
        tier_id,
        ticket_hash: ticketHash,
        qr_url: qrUrl,
        customer_email: email,
        guest_name: finalGuestName,
        reference: reference,
        amount: amountPaid,
        status: 'valid',
        reseller_code: reseller_code !== 'DIRECT' ? reseller_code : null,
      });

      if (dbError) throw dbError;

      // 5. Handle Reseller Commissions
      if (reseller_code && reseller_code !== 'DIRECT') {
        await supabase.rpc('record_reseller_sale', {
          target_unique_code: reseller_code,
          t_ref: reference,
          t_amount: amountPaid,
          t_commission: resellerCommission,
        });

        await attemptAutoResellerPayout(supabase, reseller_code);
      }

      // 6. Record Platform/Organizer Payout Split
      await supabase.from('payouts').insert({
        organizer_id: tierData.events.organizer_profile_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerAmount,
        type: 'TICKET',
        reference: reference,
      });

      // 7. Send Luxury Confirmation Email
      await resend.emails.send({
        from: 'OUSTED Concierge <tickets@ousted.com>',
        to: email,
        subject: `Access Confirmed: ${tierData.events.title}`,
        html: generateLuxuryEmail(tierData, qrUrl, ticketHash, finalGuestName)
      });
    }

    return new Response('Webhook Handled Successfully', { status: 200 });

  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

/* --- HELPER: LUXURY EMAIL GENERATOR --- */
function generateLuxuryEmail(tierData, qrUrl, hash, name) {
  const event = tierData.events;
  return `
    <div style="font-family: 'Helvetica', sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 30px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">Access Granted</h1>
      <p style="color: #666;">Hello ${name}, your reservation is confirmed.</p>
      
      <div style="background: #000; color: #fff; padding: 30px; border-radius: 20px; margin: 30px 0;">
        <p style="margin: 0; font-size: 10px; font-weight: 800; opacity: 0.6; text-transform: uppercase;">Experience</p>
        <h2 style="margin: 0 0 15px 0; font-size: 20px;">${event.title}</h2>
        
        <div style="display: flex; gap: 20px;">
          <div>
            <p style="margin: 0; font-size: 10px; opacity: 0.6;">TIER</p>
            <p style="margin: 0; font-weight: 700;">${tierData.name}</p>
          </div>
          <div style="margin-left: 30px;">
            <p style="margin: 0; font-size: 10px; opacity: 0.6;">DATE</p>
            <p style="margin: 0; font-weight: 700;">${event.event_date}</p>
          </div>
        </div>
      </div>

      <div style="text-align: center; padding: 20px;">
        <img src="${qrUrl}" width="280" style="border-radius: 15px; border: 1px solid #eee;" />
        <p style="font-family: monospace; font-size: 12px; color: #999; margin-top: 15px;">SECURE HASH: ${hash}</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
        <p>Location: ${event.location_name}</p>
        <p>Please present this digital ticket at the entrance for concierge verification.</p>
      </div>
    </div>
  `;
}

/* --- HELPER: AUTOMATIC RESELLER PAYOUT --- */
async function attemptAutoResellerPayout(supabase, resellerCode) {
  const { data: reseller } = await supabase
    .from('resellers')
    .select('*')
    .eq('unique_code', resellerCode)
    .single();

  if (!reseller || !reseller.payout_recipient_code || reseller.total_earned < reseller.payout_threshold) {
    return;
  }

  const { data: unpaidSales } = await supabase
    .from('reseller_sales')
    .select('*')
    .eq('reseller_id', reseller.id)
    .eq('paid', false);

  if (!unpaidSales?.length) return;

  const payoutAmount = unpaidSales.reduce((sum, s) => sum + parseFloat(s.commission_amount), 0);

  const res = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(payoutAmount * 100),
      recipient: reseller.payout_recipient_code,
      reason: 'Automatic OUSTED reseller payout',
    }),
  });

  const data = await res.json();
  if (!data.status) return;

  await supabase
    .from('reseller_sales')
    .update({ paid: true, payout_reference: data.data.reference })
    .eq('reseller_id', reseller.id)
    .eq('paid', false);

  await supabase
    .from('resellers')
    .update({ total_earned: 0, last_payout_at: new Date() })
    .eq('id', reseller.id);
}
