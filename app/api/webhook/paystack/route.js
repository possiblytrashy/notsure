import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);

    const bodyText = await req.text();
    const body = JSON.parse(bodyText);

    /* ----------------------------------
       1. EVENT VALIDATION
    ---------------------------------- */
    if (body.event !== 'charge.success') {
      return new Response('Event ignored', { status: 200 });
    }

    /* ----------------------------------
       2. METADATA PARSING
    ---------------------------------- */
    let rawMetadata = body.data.metadata;
    let metadata = {};
    try {
      metadata =
        typeof rawMetadata === 'string'
          ? JSON.parse(rawMetadata)
          : rawMetadata || {};
    } catch (e) {
      console.error('Metadata parsing failed:', e);
      metadata = rawMetadata || {};
    }

    const {
      type,
      event_id,
      tier_id,
      candidate_id,
      vote_count,
      organizer_id,
      guest_name,
      name,
      reseller_code,
      base_price
    } = metadata;

    const email = body.data.customer.email;
    const amountPaid = body.data.amount / 100;
    const reference = body.data.reference;
    const finalGuestName = guest_name || name || 'Valued Guest';

    /* ======================================================
       CASE A: VOTING (UNCHANGED)
    ====================================================== */
    if (type === 'VOTE' || candidate_id) {
      const platformFee = amountPaid * 0.05;
      const netRevenue = amountPaid * 0.95;
      const votesToAdd = parseInt(vote_count) || 1;

      const { error: rpcError } = await supabase.rpc(
        'increment_vote',
        {
          candidate_id: candidate_id,
          row_count: votesToAdd
        }
      );

      if (rpcError) {
        throw new Error(`Vote RPC Error: ${rpcError.message}`);
      }

      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: netRevenue,
        type: 'VOTE',
        reference: reference,
        candidate_id: candidate_id
      });
    }

    /* ======================================================
       CASE B: TICKETING (FULL LOGIC PRESERVED)
    ====================================================== */
    else if (
      type === 'TICKET_PURCHASE' ||
      type === 'TICKET' ||
      tier_id
    ) {
      /* ----------------------------------
         1. FINANCIAL REVERSE ENGINEERING
      ---------------------------------- */
      const actualBasePrice = base_price
        ? parseFloat(base_price)
        : reseller_code && reseller_code !== 'DIRECT'
        ? amountPaid / 1.1
        : amountPaid;

      const platformFee = actualBasePrice * 0.05;
      const organizerAmount = actualBasePrice * 0.95;
      const resellerCommission =
        reseller_code && reseller_code !== 'DIRECT'
          ? amountPaid - actualBasePrice
          : 0;

      /* ----------------------------------
         2. TICKET GENERATION
      ---------------------------------- */
      const ticketHash = `OUST-${Math.random()
        .toString(36)
        .toUpperCase()
        .substring(2, 10)}`;

      const qrDataUrl = await QRCode.toDataURL(ticketHash, {
        width: 300
      });
      const qrBuffer = Buffer.from(
        qrDataUrl.split(',')[1],
        'base64'
      );

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(`qrs/${ticketHash}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl: qrUrl }
      } = supabase.storage
        .from('media')
        .getPublicUrl(`qrs/${ticketHash}.png`);

      /* ----------------------------------
         3. SAVE TICKET
      ---------------------------------- */
      const { error: dbError } = await supabase
        .from('tickets')
        .insert({
          event_id,
          tier_id,
          ticket_hash: ticketHash,
          qr_url: qrUrl,
          customer_email: email,
          guest_name: finalGuestName,
          reference: reference,
          amount: amountPaid,
          status: 'valid',
          is_scanned: false,
          reseller_code: reseller_code || null
        });

      if (dbError) throw dbError;

      /* ----------------------------------
         4. RECORD RESELLER SALE (UNCHANGED)
      ---------------------------------- */
      if (reseller_code && reseller_code !== 'DIRECT') {
        const { error: resellerRpcError } =
          await supabase.rpc('record_reseller_sale', {
            target_unique_code: reseller_code,
            t_ref: reference,
            t_amount: amountPaid,
            t_commission: resellerCommission
          });

        if (resellerRpcError) {
          console.error(
            'Reseller RPC Error:',
            resellerRpcError
          );
        }

        /* 🔥 NEW: AUTOMATIC PAYOUT ATTEMPT */
        await attemptAutoResellerPayout(
          supabase,
          reseller_code
        );
      }

      /* ----------------------------------
         5. RECORD ORGANIZER PAYOUT
      ---------------------------------- */
      await supabase.from('payouts').insert({
        organizer_id,
        amount_total: amountPaid,
        platform_fee: platformFee,
        organizer_amount: organizerAmount,
        type: 'TICKET',
        reference: reference
      });

      /* ----------------------------------
         6. FETCH DETAILS FOR EMAIL
      ---------------------------------- */
      const { data: eventDetails } = await supabase
        .from('events')
        .select(
          'title, location_name, event_date, event_time'
        )
        .eq('id', event_id)
        .single();

      const { data: tierDetails } = await supabase
        .from('ticket_tiers')
        .select('name')
        .eq('id', tier_id)
        .single();

      /* ----------------------------------
         7. SEND EMAIL (UNCHANGED)
      ---------------------------------- */
      await resend.emails.send({
        from: 'OUSTED <tickets@ousted.com>',
        to: email,
        subject: `Access Confirmed: ${
          eventDetails?.title || 'Exclusive Event'
        }`,
        html: generateLuxuryEmail(
          eventDetails,
          tierDetails,
          qrUrl,
          ticketHash,
          finalGuestName
        )
      });
    }

    return new Response(
      'Webhook Handled Successfully',
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'CRITICAL WEBHOOK ERROR:',
      error.message
    );
    return new Response(
      `Webhook Error: ${error.message}`,
      { status: 500 }
    );
  }
}

/* ======================================================
   🔁 NEW: AUTOMATIC RESELLER PAYOUT (ADDITIVE ONLY)
====================================================== */
async function
