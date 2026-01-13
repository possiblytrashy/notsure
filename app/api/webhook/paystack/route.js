import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * LUXURY WEBHOOK CONCIERGE (ROBUST VERSION)
 * Handles: Signature Security, Tiered Ticketing, 5% Splits, 10% Markups,
 * QR Storage, Voting, and Automated Reseller Payouts.
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
      guest_email,
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

      // Wrap Voting in Try/Catch to log errors but attempt to succeed
      try {
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
      } catch (voteErr) {
        console.error("Voting Logic Failed:", voteErr);
        // Even if local DB fails, return 200 to Paystack so they don't retry forever
        return new Response('Vote Error Logged', { status: 200 });
      }
      
      return new Response('Vote Processed', { status: 200 });
    }

    /* ======================================================
       CASE B: MULTI-TIER LUXURY TICKETING
    ====================================================== */
    else if (type === 'TICKET_PURCHASE' || tier_id) {
      
      // 0. IDEMPOTENCY CHECK (Prevent "Loop of Death")
      // If we already saved this ticket, stop here.
      const { data: existingTicket } = await supabase
        .from('tickets')
        .select('id')
        .eq('reference', reference)
        .maybeSingle();

      if (existingTicket) {
        return new Response('Ticket already processed', { status: 200 });
      }

      // 1. Fetch Source of Truth from DB (Prevents price tampering)
      const { data: tierData, error: tierError } = await supabase
        .from('ticket_tiers')
        .select('*, events(title, location_name, event_date, event_time, organizer_profile_id)')
        .eq('id', tier_id)
        .single();

      if (tierError || !tierData) {
        console.error("Tier Verification Failed:", tierError);
        // We throw here because we literally cannot create a ticket without tier data
        throw new Error("Tier verification failed.");
      }

      // 2. Financial Engineering
      const actualBasePrice = parseFloat(tierData.price);
      const platformFee = actualBasePrice * 0.05;
      const organizerAmount = actualBasePrice * 0.95;
      
      // Calculate reseller commission (anything above the base price)
      const resellerCommission = (amountPaid > actualBasePrice) 
        ? (amountPaid - actualBasePrice) 
        : 0;

      // 3. Generate Ticket Number
      const ticketNumber = `OUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      
      // 4. QR Generation & Storage (SAFE BLOCK)
      // If this fails, qrUrl will be null, but the ticket WILL still be created.
      let qrUrl = null;
      try {
        const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketNumber}|REF:${reference}`, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });

        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(`qrs/${ticketNumber}.png`, qrBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from('media')
            .getPublicUrl(`qrs/${ticketNumber}.png`);
          qrUrl = publicData.publicUrl;
        } else {
          console.error("QR Upload Error (Non-Fatal):", uploadError.message);
        }
      } catch (qrErr) {
        console.error("QR Generation Error (Non-Fatal):", qrErr.message);
      }

      // 5. Atomic Ticket Creation (CRITICAL BLOCK)
      // This is the most important step. If this fails, we throw to let Paystack retry.
      const { error: dbError } = await supabase.from('tickets').insert({
        event_id: event_id,
        tier_id: tier_id,
        tier_name: tierData.name,    
        ticket_number: ticketNumber, 
        qr_code_url: qrUrl,          
        user_email: email,           
        guest_email: guest_email || email,
        guest_name: finalGuestName,
        reference: reference,
        amount: amountPaid,
        status: 'valid',
        is_scanned: false,
      });

      if (dbError) {
        console.error("DB INSERT ERROR:", dbError);
        throw dbError; // Retry trigger
      }

      // 6. Handle Reseller Commissions & Auto-Payouts (SAFE BLOCK)
      if (reseller_code && reseller_code !== 'DIRECT') {
        try {
          // Check if RPC exists before calling, or just call inside try/catch
          await supabase.rpc('record_reseller_sale', {
            target_unique_code: reseller_code,
            t_ref: reference,
            t_amount: amountPaid,
            t_commission: resellerCommission,
          });

          await attemptAutoResellerPayout(supabase, reseller_code);
        } catch (resellerErr) {
          console.error("Reseller Logic Failed (Ticket Saved):", resellerErr.message);
        }
      }

      // 7. Record Platform/Organizer Payout Split (SAFE BLOCK)
      try {
        await supabase.from('payouts').insert({
          organizer_id: tierData.events.organizer_profile_id,
          amount_total: amountPaid,
          platform_fee: platformFee,
          organizer_amount: organizerAmount,
          type: 'TICKET',
          reference: reference,
        });
      } catch (payoutErr) {
        console.error("Payout Log Failed (Ticket Saved):", payoutErr.message);
      }

      // 8. Send Luxury Confirmation Email (SAFE BLOCK)
      try {
        await resend.emails.send({
          from: 'OUSTED Concierge <tickets@ousted.com>',
          to: email,
          subject: `Access Confirmed: ${tierData.events.title}`,
          html: generateLuxuryEmail(tierData, qrUrl, ticketNumber, finalGuestName)
        });
      } catch (emailErr) {
        console.error("Email Failed (Ticket Saved):", emailErr.message);
      }
    }

    return new Response('Webhook Handled Successfully', { status: 200 });

  } catch (error) {
    console.error('CRITICAL WEBHOOK ERROR:', error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
}

/* --- HELPER: LUXURY EMAIL GENERATOR --- */
function generateLuxuryEmail(tierData, qrUrl, ticketNumber, name) {
  const event = tierData.events;
  const qrDisplay = qrUrl 
    ? `<img src="${qrUrl}" width="280" style="border-radius: 15px; border: 1px solid #eee;" />`
    : `<div style="width:280px; height:280px; background:#f0f0f0; display:flex; align-items:center; justify-content:center;">QR Loading...</div>`;

  return `
    <div style="font-family: 'Helvetica', sans-serif; max-width: 600px; margin: auto; padding: 40px; border: 1px solid #f0f0f0; border-radius: 30px;">
      <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">Access Granted</h1>
      <p style="color: #666;">Hello ${name}, your reservation is confirmed.</p>
      
      <div style="background: #000; color: #fff; padding: 30px; border-radius: 20px; margin: 30px 0;">
        <p style="margin: 0; font-size: 10px; font-weight: 800; opacity: 0.6; text-transform: uppercase;">Experience</p>
        <h2 style="margin: 0 0 15px 0; font-size: 20px;">${event.title}</h2>
        
        <div style="display: flex;">
          <div style="margin-right: 40px;">
            <p style="margin: 0; font-size: 10px; opacity: 0.6;">TIER</p>
            <p style="margin: 0; font-weight: 700;">${tierData.name}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 10px; opacity: 0.6;">DATE</p>
            <p style="margin: 0; font-weight: 700;">${event.event_date}</p>
          </div>
        </div>
      </div>

      <div style="text-align: center; padding: 20px;">
        ${qrDisplay}
        <p style="font-family: monospace; font-size: 12px; color: #999; margin-top: 15px;">SECURE ID: ${ticketNumber}</p>
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
  const { data: eventReseller, error: erError } = await supabase
    .from('event_resellers')
    .select('id, reseller_id, commission_rate, resellers (id, payout_recipient_code, total_earned, payout_threshold)')
    .eq('unique_code', resellerCode)
    .maybeSingle();

  if (erError || !eventReseller) return;

  const reseller = eventReseller.resellers || null;
  if (!reseller || !reseller.payout_recipient_code || reseller.total_earned < reseller.payout_threshold) {
    return;
  }

  const { data: unpaidSales } = await supabase
    .from('reseller_sales')
    .select('*')
    .eq('event_reseller_id', eventReseller.id)
    .eq('paid', false);

  if (!unpaidSales?.length) return;

  const payoutAmount = unpaidSales.reduce((sum, s) => sum + parseFloat(s.commission_earned || 0), 0);

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
    .eq('event_reseller_id', eventReseller.id)
    .eq('paid', false);

  await supabase
    .from('resellers')
    .update({ total_earned: 0, last_payout_at: new Date() })
    .eq('id', reseller.id);
}
