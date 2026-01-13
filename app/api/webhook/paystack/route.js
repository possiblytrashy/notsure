import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function safeLog(...args) {
  // small helper to keep logs unified
  console.log('[WEBHOOK]', ...args);
}

function formatSupabaseError(err) {
  if (!err) return null;
  return {
    message: err.message,
    details: err.details,
    hint: err.hint,
    code: err.code,
    status: err.status
  };
}

export async function POST(req) {
  // Validate ENV early (fail fast).
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL || null;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    safeLog('Missing Supabase server env vars (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).');
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing Supabase env vars' }), { status: 500 });
  }
  if (!PAYSTACK_SECRET_KEY) {
    safeLog('Missing PAYSTACK_SECRET_KEY');
    return new Response(JSON.stringify({ error: 'Server misconfiguration: missing PAYSTACK_SECRET_KEY' }), { status: 500 });
  }

  // create supabase with server key (service role)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  try {
    const bodyText = await req.text();
    safeLog('Incoming webhook body len:', bodyText?.length ?? 0);

    // verify signature
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyText).digest('hex');
    const signature = req.headers.get('x-paystack-signature') || req.headers.get('X-Paystack-Signature');
    safeLog('Computed sig:', hash, 'Incoming sig:', signature);

    if (!signature || hash !== signature) {
      safeLog('Signature mismatch — rejecting');
      return new Response(JSON.stringify({ error: 'Unauthorized: signature mismatch' }), { status: 401 });
    }

    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (err) {
      safeLog('Invalid JSON body:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    safeLog('Event type:', body.event);

    // only process charge.success
    if (body.event !== 'charge.success') {
      safeLog('Ignored event:', body.event);
      return new Response(JSON.stringify({ ok: true, message: 'Ignored event' }), { status: 200 });
    }

    // read core fields
    const reference = body.data?.reference;
    const amountPaid = (typeof body.data?.amount === 'number') ? body.data.amount / 100 : null;
    const email = body.data?.customer?.email;
    const metadata = body.data?.metadata || {};

    safeLog('reference:', reference, 'amountPaid:', amountPaid, 'email:', email, 'metadata:', metadata);

    // minimal validation
    if (!reference) {
      safeLog('Missing reference in payload');
      return new Response(JSON.stringify({ error: 'Missing reference' }), { status: 400 });
    }

    // parse metadata (we'll NOT trust FKs from metadata)
    const {
      type,
      tier_id: meta_tier_id,
      event_id: meta_event_id,
      guest_name,
      guest_email,
      reseller_code,
      organizer_id,
      vote_count,
      candidate_id
    } = metadata;

    // CASE A: VOTING
    if (type === 'VOTE' || candidate_id) {
      safeLog('Processing VOTE type');
      try {
        const votesToAdd = parseInt(vote_count) || 1;
        const { error: rpcError } = await supabase.rpc('increment_vote', {
          candidate_id,
          row_count: votesToAdd
        });
        if (rpcError) {
          safeLog('RPC increment_vote error:', formatSupabaseError(rpcError));
          // return 200 so Paystack doesn't retry endlessly — we logged error
          return new Response(JSON.stringify({ ok: true, message: 'Vote RPC error logged' }), { status: 200 });
        }

        const { error: payoutErr } = await supabase.from('payouts').insert({
          organizer_id,
          amount_total: amountPaid,
          platform_fee: amountPaid * 0.05,
          organizer_amount: amountPaid * 0.95,
          type: 'VOTE',
          reference,
          candidate_id
        });
        if (payoutErr) {
          safeLog('Payout insert error (vote):', formatSupabaseError(payoutErr));
        }

        return new Response(JSON.stringify({ ok: true, message: 'Vote processed' }), { status: 200 });
      } catch (err) {
        safeLog('Unexpected vote handler error:', err);
        return new Response(JSON.stringify({ ok: false, error: 'Vote processing failed' }), { status: 500 });
      }
    }

    // CASE B: TICKET PURCHASE
    if (type === 'TICKET_PURCHASE' || meta_tier_id) {
      safeLog('Processing TICKET_PURCHASE');

      // idempotency: check existing by reference
      const { data: existingTicket, error: existingErr } = await supabase
        .from('tickets')
        .select('id, reference')
        .eq('reference', reference)
        .maybeSingle();

      if (existingErr) {
        safeLog('Error checking existing ticket:', formatSupabaseError(existingErr));
        return new Response(JSON.stringify({ error: 'DB error on idempotency check', details: formatSupabaseError(existingErr) }), { status: 500 });
      }
      if (existingTicket) {
        safeLog('Ticket already exists for reference:', reference);
        return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), { status: 200 });
      }

      // Must have a tier_id in metadata (from your frontend init). If missing, fail.
      if (!meta_tier_id) {
        safeLog('No tier_id in metadata — cannot continue');
        return new Response(JSON.stringify({ error: 'Missing tier_id in metadata' }), { status: 400 });
      }

      // Fetch authoritative tier info (derive event_id from DB)
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
        .eq('id', meta_tier_id)
        .maybeSingle();

      if (tierError) {
        safeLog('Supabase error fetching tierData:', formatSupabaseError(tierError));
        return new Response(JSON.stringify({ error: 'DB error fetching tier', details: formatSupabaseError(tierError) }), { status: 500 });
      }
      if (!tierData) {
        safeLog('Tier not found for id:', meta_tier_id);
        return new Response(JSON.stringify({ error: 'Tier not found' }), { status: 400 });
      }

      safeLog('tierData found:', { id: tierData.id, event_id: tierData.event_id, price: tierData.price });

      const realTierId = tierData.id;
      const realEventId = tierData.event_id;
      if (!realEventId) {
        safeLog('tierData has no event_id — cannot insert ticket');
        return new Response(JSON.stringify({ error: 'Tier has no event_id' }), { status: 500 });
      }

      // Financial calculations
      const basePrice = Number(tierData.price || 0);
      const platformFee = basePrice * 0.05;
      const organizerAmount = basePrice * 0.95;
      const resellerCommission = amountPaid > basePrice ? amountPaid - basePrice : 0;

      // Generate ticket number and QR (QR errors are non-fatal)
      const ticketNumber = `OUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      let qrUrl = null;
      try {
        const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketNumber}|REF:${reference}`, { width: 400, margin: 2 });
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        const { error: uploadError } = await supabase.storage.from('media').upload(`qrs/${ticketNumber}.png`, qrBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

        if (uploadError) {
          safeLog('QR upload error (non-fatal):', formatSupabaseError(uploadError));
        } else {
          const { data: publicData } = supabase.storage.from('media').getPublicUrl(`qrs/${ticketNumber}.png`);
          qrUrl = publicData?.publicUrl || null;
        }
      } catch (err) {
        safeLog('QR generation/upload failed (non-fatal):', err.message || err);
      }

      // Insert ticket — return the inserted row so we can log it
      const insertPayload = {
        event_id: realEventId,
        tier_id: realTierId,
        tier_name: tierData.name,
        ticket_number: ticketNumber,
        qr_code_url: qrUrl,
        user_email: email,
        guest_email: guest_email || email,
        guest_name: guest_name || email || 'Valued Guest',
        reference,
        amount: amountPaid,
        status: 'valid',
        is_scanned: false,
      };

      safeLog('Attempting ticket insert with payload:', insertPayload);

      const { data: inserted, error: insertErr } = await supabase
        .from('tickets')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (insertErr) {
        safeLog('Ticket insert error:', formatSupabaseError(insertErr));
        // If a foreign key or unique violation occurs, this will surface here.
        return new Response(JSON.stringify({ error: 'Ticket insert failed', details: formatSupabaseError(insertErr) }), { status: 500 });
      }

      safeLog('Ticket inserted:', inserted?.id || inserted);

      // Reseller: record sale (non-fatal)
      if (reseller_code && reseller_code !== 'DIRECT') {
        try {
          const { error: rpcErr } = await supabase.rpc('record_reseller_sale', {
            target_unique_code: reseller_code,
            t_ref: reference,
            t_amount: amountPaid,
            t_commission: resellerCommission,
          });
          if (rpcErr) safeLog('record_reseller_sale rpc error (non-fatal):', formatSupabaseError(rpcErr));
        } catch (err) {
          safeLog('record_reseller_sale threw (non-fatal):', err);
        }

        // attempt immediate payout (safe)
        try {
          await attemptAutoResellerPayout(supabase, reseller_code);
        } catch (err) {
          safeLog('attemptAutoResellerPayout error (non-fatal):', err);
        }
      }

      // Log payout entry (non-fatal)
      try {
        const { error: payoutsErr } = await supabase.from('payouts').insert({
          organizer_id: tierData.events?.organizer_profile_id,
          amount_total: amountPaid,
          platform_fee: platformFee,
          organizer_amount: organizerAmount,
          type: 'TICKET',
          reference,
        });
        if (payoutsErr) safeLog('payouts insert error (non-fatal):', formatSupabaseError(payoutsErr));
      } catch (err) {
        safeLog('payouts insert threw (non-fatal):', err);
      }

      // Send email (non-fatal)
      if (resend && RESEND_ADMIN_EMAIL) {
        try {
          await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: RESEND_ADMIN_EMAIL,
            subject: `[TEST] Access Confirmed: ${tierData.events?.title}`,
            html: generateLuxuryEmail(tierData, qrUrl, ticketNumber, guest_name || email),
          });
        } catch (err) {
          safeLog('resend email error (non-fatal):', err);
        }
      } else {
        safeLog('Skipping send email - resend not configured or admin email missing.');
      }

      // success
      return new Response(JSON.stringify({ ok: true, inserted_id: inserted?.id || null }), { status: 200 });
    }

    // unhandled
    return new Response(JSON.stringify({ ok: false, message: 'Unhandled event type' }), { status: 400 });
  } catch (err) {
    safeLog('CRITICAL WEBHOOK ERROR (catch-all):', err);
    // include stack in logs only — avoid returning stack to external services
    return new Response(JSON.stringify({ error: 'Webhook server error', details: err?.message || String(err) }), { status: 500 });
  }
}

/* ---------- Helpers ---------- */

function generateLuxuryEmail(tierData, qrUrl, ticketNumber, name) {
  const event = tierData.events || {};
  const qrDisplay = qrUrl ? `<img src="${qrUrl}" width="280"/>` : `<div style="width:280px;height:280px;background:#f0f0f0">QR pending</div>`;
  return `
    <div>
      <h1>Access Confirmed</h1>
      <p>Hello ${name}</p>
      <p>${event.title || 'Event'}</p>
      ${qrDisplay}
      <p>${ticketNumber}</p>
    </div>
  `;
}

async function attemptAutoResellerPayout(supabase, resellerCode) {
  try {
    const { data: eventReseller, error: erError } = await supabase
      .from('event_resellers')
      .select('id, reseller_id, commission_rate, resellers (id, payout_recipient_code, total_earned, payout_threshold)')
      .eq('unique_code', resellerCode)
      .maybeSingle();

    if (erError || !eventReseller) {
      safeLog('attemptAutoResellerPayout: no eventReseller or error:', formatSupabaseError(erError));
      return;
    }

    const reseller = eventReseller.resellers;
    if (!reseller || !reseller.payout_recipient_code) return;
    if (reseller.total_earned < reseller.payout_threshold) return;

    const { data: unpaidSales } = await supabase
      .from('reseller_sales')
      .select('*')
      .eq('event_reseller_id', eventReseller.id)
      .eq('paid', false);

    if (!unpaidSales?.length) return;

    const payoutAmount = unpaidSales.reduce((sum, s) => sum + Number(s.commission_earned || 0), 0);
    if (payoutAmount <= 0) return;

    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(payoutAmount * 100),
        recipient: reseller.payout_recipient_code,
        reason: 'Automatic reseller payout',
      }),
    });

    const transferJson = await transferRes.json();
    if (!transferJson.status) {
      safeLog('Paystack transfer failed (attemptAutoResellerPayout):', transferJson);
      return;
    }

    await supabase
      .from('reseller_sales')
      .update({ paid: true, payout_reference: transferJson.data.reference })
      .eq('event_reseller_id', eventReseller.id)
      .eq('paid', false);

    await supabase
      .from('resellers')
      .update({ total_earned: 0, last_payout_at: new Date().toISOString() })
      .eq('id', reseller.id);

    safeLog('attemptAutoResellerPayout: success', transferJson.data.reference);
  } catch (err) {
    safeLog('attemptAutoResellerPayout: error', err);
  }
}
