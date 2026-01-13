import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- HELPERS ---
function safeLog(...args) {
  console.log('[LUXURY-WEBHOOK]', ...args);
}

function formatSupabaseError(err) {
  if (!err) return null;
  return { message: err.message, code: err.code, details: err.details };
}

export async function POST(req) {
  // 1. Validate Environment Variables
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_ADMIN_EMAIL = process.env.RESEND_ADMIN_EMAIL;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PAYSTACK_SECRET_KEY) {
    safeLog('CRITICAL: Missing core environment variables.');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  try {
    const bodyText = await req.text();
    
    // 2. Security: Verify Signature
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(bodyText).digest('hex');
    const signature = req.headers.get('x-paystack-signature');

    if (!signature || hash !== signature) {
      safeLog('Security: Signature mismatch. Check PAYSTACK_SECRET_KEY.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = JSON.parse(bodyText);

    // 3. Filter Event
    if (body.event !== 'charge.success') {
      safeLog('Event ignored:', body.event);
      return new Response(JSON.stringify({ ok: true, message: 'Ignored' }), { status: 200 });
    }

    const { reference, amount, customer, metadata } = body.data;
    const amountPaidGHS = amount / 100;
    const userEmail = customer?.email;

    safeLog(`Processing Reference: ${reference} | Metadata:`, JSON.stringify(metadata));

    // 4. Extract Synchronized Metadata
    // Note: We use 'tier_id' because your secure-session route sends 'tier_id'
    const {
      type,
      event_id,
      tier_id,
      guest_name,
      guest_email,
      reseller_code
    } = metadata || {};

    // 5. Check Idempotency (Prevent Duplicate Saves)
    const { data: existingTicket } = await supabase
      .from('tickets')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (existingTicket) {
      safeLog('Ticket already exists. Skipping save.');
      return new Response(JSON.stringify({ ok: true, message: 'Already processed' }), { status: 200 });
    }

    // 6. Handle Ticket Purchase
    if (type === 'TICKET_PURCHASE' || tier_id) {
      safeLog('Entering Ticket Purchase Logic...');

      // A. Fetch Authoritative Tier & Event Data
      const { data: tierData, error: tierError } = await supabase
        .from('ticket_tiers')
        .select(`
          id, name, price, event_id,
          events (
            id, title, location_name, event_date, organizer_profile_id
          )
        `)
        .eq('id', tier_id)
        .single();

      if (tierError || !tierData) {
        safeLog('Tier Lookup Error:', formatSupabaseError(tierError));
        return new Response(JSON.stringify({ error: 'Tier not found' }), { status: 400 });
      }

      // B. Financials
      const basePrice = Number(tierData.price || 0);
      const platformFee = basePrice * 0.05;
      const organizerAmount = basePrice * 0.95;

      // C. QR Code Generation & Storage
      const ticketNumber = `OUST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      let qrUrl = null;

      try {
        const qrDataUrl = await QRCode.toDataURL(`TICKET:${ticketNumber}|REF:${reference}`);
        const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

        // Ensure you have a 'media' bucket in Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(`qrs/${ticketNumber}.png`, qrBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(`qrs/${ticketNumber}.png`);
          qrUrl = publicUrlData.publicUrl;
        } else {
          safeLog('Storage Upload Error:', uploadError.message);
        }
      } catch (qrErr) {
        safeLog('QR Process Failed (Non-fatal):', qrErr.message);
      }

      // D. Final Database Insert
      const { data: insertedTicket, error: insertErr } = await supabase
        .from('tickets')
        .insert({
          event_id: tierData.event_id,
          tier_id: tierData.id,
          tier_name: tierData.name,
          ticket_number: ticketNumber,
          qr_code_url: qrUrl,
          user_email: userEmail,
          guest_email: guest_email || userEmail,
          guest_name: guest_name || 'Valued Guest',
          reference: reference,
          amount: amountPaidGHS,
          status: 'valid',
          is_scanned: false
        })
        .select()
        .single();

      if (insertErr) {
        safeLog('CRITICAL: Database Insert Failed:', formatSupabaseError(insertErr));
        return new Response(JSON.stringify({ error: 'DB Insert Failed' }), { status: 500 });
      }

      safeLog('Ticket saved successfully:', insertedTicket.id);

      // E. Payout Records (Non-fatal)
      await supabase.from('payouts').insert({
        organizer_id: tierData.events?.organizer_profile_id,
        amount_total: amountPaidGHS,
        platform_fee: platformFee,
        organizer_amount: organizerAmount,
        type: 'TICKET',
        reference: reference
      });

      // F. Send Email via Resend (Non-fatal)
      if (resend && (guest_email || userEmail)) {
        try {
          await resend.emails.send({
            from: 'Access <onboarding@resend.dev>',
            to: guest_email || userEmail,
            subject: `Your Access Confirmed: ${tierData.events?.title}`,
            html: `<h1>Access Confirmed</h1><p>Hi ${guest_name}, your ticket is attached.</p><img src="${qrUrl}" width="250"/><p>No: ${ticketNumber}</p>`
          });
          safeLog('Email sent successfully.');
        } catch (emailErr) {
          safeLog('Email Failed:', emailErr.message);
        }
      }

      return new Response(JSON.stringify({ ok: true, ticket_id: insertedTicket.id }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Unhandled metadata type' }), { status: 400 });

  } catch (err) {
    safeLog('GLOBAL WEBHOOK CRASH:', err.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
