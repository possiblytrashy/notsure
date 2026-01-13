import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * LUXURY WEBHOOK CONCIERGE (ROBUST + CORRECT)
 */
export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const bodyText = await req.text();

    // --- 1. VERIFY PAYSTACK SIGNATURE ---
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(bodyText)
      .digest('hex');

    if (hash !== req.headers.get('x-paystack-signature')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(bodyText);

    if (body.event !== 'charge.success') {
      return new Response('Ignored', { status: 200 });
    }

    // --- 2. METADATA ---
    const metadata = body.data.metadata || {};
    const {
      type,
      tier_id,
      candidate_id,
      vote_count,
      organizer_id,
      guest_name,
      guest_email,
      reseller_code,
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100;
    const reference = body.data.reference;
    const finalGuestName = guest_name || 'Valued Guest';

    /* ======================================================
       CASE A: VOTING
    ====================================================== */
    if (type === 'VOTE' || candidate_id) {
      try {
        const votesToAdd = parseInt(vote_count) || 1;

        await supabase.rpc('increment_vote', {
          candidate_id,
          row_count: votesToAdd,
        });

        await supabase.from('payouts').insert({
          organizer_id,
          amount_total: amountPaid,
          platform_fee: amountPaid * 0.05,
          organizer_amount: amountPaid * 0.95,
          type: 'VOTE',
          reference,
          candidate_id,
        });

        return new Response('Vote processed', { status: 200 });
      } catch (err) {
        console.error('Vote failed:', err);
        return new Response('Vote error logged', { status: 200 });
      }
    }

    /* ======================================================
       CASE B: TICKET PURCHASE
    ====================================================== */
    if (type === 'TICKET_PURCHASE' || tier_id) {
      // --- IDEMPOTENCY ---
      const { data: existing } = await supabase
        .from('tickets')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (existing) {
        return new Response('Already processed', { status: 200 });
      }

      // --- FETCH REAL FK SOURCE ---
      const { data: tierData, error: tierError } = await supabase
        .from('ticket_tiers')
        .select(`
          id,
          name,
          price,
          event_id,
          events (
            id,
            title,
            location_name,
            event_date,
            event_time,
            organizer_profile_id
          )
        `)
        .eq('id', tier_id)
        .single();

      if (tierError || !tierData) {
        throw new Error('Tier verification failed');
      }

      const realTierId = tierData.id;
      const realEventId = tierData.event_id;

      // --- FINANCIALS ---
      const basePrice = Number(tierData.price);
      const platformFee = basePrice * 0.05;
      const organizerAmount = basePrice * 0.95;
      const resellerCommission =
        amountPaid > basePrice ? amountPaid - basePrice : 0;

      // --- TICKET NUMBER ---
      const ticketNumber = `OUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // --- QR ---
      let qrUrl = null;
      try {
        const qrDataUrl = await QRCode.toDataURL(
          `TICKET:${ticketNumber}|REF:${reference}`
        );
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        await supabase.storage
          .from('media')
          .upload(`qrs/${ticketNumber}.png`, qrBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        qrUrl = supabase.storage
          .from('media')
          .getPublicUrl(`qrs/${ticketNumber}.png`).data.publicUrl;
      } catch (qrErr) {
        console.error('QR failed (non-fatal):', qrErr.message);
      }

      // --- ✅ CRITICAL FIX: USE DB-DERIVED FKs ---
      const { error: insertError } = await supabase.from('tickets').insert({
        event_id: realEventId,
        tier_id: realTierId,
        tier_name: tierData.name,
        ticket_number: ticketNumber,
        qr_code_url: qrUrl,
        user_email: email,
        guest_email: guest_email || email,
        guest_name: finalGuestName,
        reference,
        amount: amountPaid,
        status: 'valid',
        is_scanned: false,
      });

      if (insertError) {
        console.error('Ticket insert failed:', insertError);
        throw insertError;
      }

      // --- RESELLER ---
      if (reseller_code && reseller_code !== 'DIRECT') {
        try {
          await supabase.rpc('record_reseller_sale', {
            target_unique_code: reseller_code,
            t_ref: reference,
            t_amount: amountPaid,
            t_commission: resellerCommission,
          });

          await attemptAutoResellerPayout(supabase, reseller_code);
        } catch (err) {
          console.error('Reseller failed:', err.message);
        }
      }

      // --- PAYOUT LOG ---
      try {
        await supabase.from('payouts').insert({
          organizer_id: tierData.events.organizer_profile_id,
          amount_total: amountPaid,
          platform_fee: platformFee,
          organizer_amount: organizerAmount,
          type: 'TICKET',
          reference,
        });
      } catch (err) {
        console.error('Payout log failed:', err.message);
      }

      // --- EMAIL ---
      try {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: process.env.RESEND_ADMIN_EMAIL,
          subject: `[TEST] Access Confirmed: ${tierData.events.title}`,
          html: generateLuxuryEmail(
            tierData,
            qrUrl,
            ticketNumber,
            finalGuestName
          ),
        });
      } catch (err) {
        console.error('Email failed:', err.message);
      }

      return new Response('Ticket processed', { status: 200 });
    }

    return new Response('Unhandled', { status: 200 });
  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error);
    return new Response('Webhook failure', { status: 500 });
  }
}

/* ================= HELPERS ================= */

function generateLuxuryEmail(tierData, qrUrl, ticketNumber, name) {
  const event = tierData.events;
  return `
    <h1>Access Confirmed</h1>
    <p>Hello ${name}</p>
    <p>${event.title}</p>
    <img src="${qrUrl || ''}" width="260"/>
    <p>${ticketNumber}</p>
  `;
}

async function attemptAutoResellerPayout(supabase, resellerCode) {
  const { data } = await supabase
    .from('event_resellers')
    .select('id, resellers (id, payout_recipient_code, total_earned, payout_threshold)')
    .eq('unique_code', resellerCode)
    .maybeSingle();

  if (!data?.resellers) return;
  if (data.resellers.total_earned < data.resellers.payout_threshold) return;

  const { data: sales } = await supabase
    .from('reseller_sales')
    .select('*')
    .eq('event_reseller_id', data.id)
    .eq('paid', false);

  if (!sales?.length) return;

  const payoutAmount = sales.reduce(
    (s, r) => s + Number(r.commission_earned || 0),
    0
  );

  const res = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(payoutAmount * 100),
      recipient: data.resellers.payout_recipient_code,
      reason: 'Automatic reseller payout',
    }),
  });

  const json = await res.json();
  if (!json.status) return;

  await supabase
    .from('reseller_sales')
    .update({ paid: true, payout_reference: json.data.reference })
    .eq('event_reseller_id', data.id)
    .eq('paid', false);

  await supabase
    .from('resellers')
    .update({ total_earned: 0, last_payout_at: new Date() })
    .eq('id', data.resellers.id);
}
