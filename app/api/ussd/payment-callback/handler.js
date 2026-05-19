// USSD Payment Confirmed — called by the Paystack webhook when a USSD MoMo charge succeeds.
// Creates ticket records, writes to payout_ledger, sends SMS, logs result to sms_log.
//
// v2 changes:
//   - guest_phone saved on each ticket row (was missing before)
//   - SMS result logged to sms_log table

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateTicketNumber() {
  return `OT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function normalisePhoneForSMS(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/[\s\-()+]/g, '');
  if (/^233[2-9]\d{8}$/.test(p)) return '+' + p;
  if (/^0[2-9]\d{8}$/.test(p))  return '+233' + p.slice(1);
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  return null;
}

// ─── SMS ─────────────────────────────────────────────────────
async function sendArkeselSMS(to, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping');
    return { success: false, error: 'no_api_key' };
  }
  const phone = normalisePhoneForSMS(to);
  if (!phone) {
    console.warn('[SMS] Cannot normalise phone:', to);
    return { success: false, error: 'invalid_phone' };
  }
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:     process.env.ARKESEL_SENDER_ID || 'OUSTED',
        message,
        recipients: [phone],
      }),
    });
    const data = await res.json();
    if (data.status === 'success') return { success: true, phone };
    console.error('[SMS] Arkesel error:', JSON.stringify(data));
    return { success: false, error: data.message || 'send_failed', phone };
  } catch (err) {
    console.error('[SMS] Network error:', err.message);
    return { success: false, error: err.message };
  }
}

async function logSMS(db, { reference, phone, message, result, channel = 'ussd' }) {
  const e164 = normalisePhoneForSMS(phone) || phone || 'unknown';
  await db.from('sms_log').upsert({
    reference,
    phone:   e164,
    message,
    status:  result.success ? 'sent'  : 'failed',
    error:   result.success ? null     : (result.error || 'unknown'),
    channel,
  }, { onConflict: 'reference,phone' }).catch(err =>
    console.warn('[SMS] Failed to write sms_log:', err.message)
  );
}

// ─── MAIN HANDLER ────────────────────────────────────────────
export async function processUSSDPayment(reference, paystackData) {
  const db   = getDb();
  const meta = paystackData.metadata || {};

  // Idempotency
  const { data: existing } = await db.from('tickets').select('id').eq('reference', reference).limit(1);
  if (existing?.length) {
    console.warn('[USSD] Already processed:', reference);
    return { ok: true, already_processed: true };
  }

  const qty        = Math.max(1, parseInt(meta.quantity || 1));
  const guestPhone = meta.ussd_phone || '';
  const guestEmail = meta.guest_email || `ussd-${guestPhone}@ousted.live`;
  const e164Phone  = normalisePhoneForSMS(guestPhone) || guestPhone || null;

  const tickets = Array.from({ length: qty }, () => ({
    event_id:             meta.event_id,
    tier_id:              meta.tier_id,
    tier_name:            meta.tier_name || '',
    reference,
    ticket_number:        generateTicketNumber(),
    guest_email:          guestEmail,
    guest_name:           `USSD Buyer (${guestPhone})`,
    guest_phone:          e164Phone,                    // ← saved to DB
    amount:               meta.buyer_price || (paystackData.amount / 100 / qty),
    base_amount:          meta.base_price  || (paystackData.amount / 100 / qty),
    platform_fee:         meta.platform_fee || 0,
    is_reseller_purchase: false,
    reseller_code:        'DIRECT',
    status:               'valid',
    is_scanned:           false,
    channel:              'USSD',
  }));

  const { data: insertedTickets, error: ticketError } = await db.from('tickets').insert(tickets).select('ticket_number');
  if (ticketError) {
    console.error('[USSD] Ticket insert error:', ticketError.message);
    return { ok: false, error: ticketError.message };
  }

  // Payout ledger
  const orgOwes       = parseFloat((meta.base_price * qty).toFixed(2));
  const platformKeeps = parseFloat(((paystackData.amount / 100) - orgOwes).toFixed(2));
  await db.from('payout_ledger').insert({
    reference,
    event_id:         meta.event_id,
    organizer_id:     meta.organizer_id || null,
    transaction_type: 'TICKET',
    total_collected:  paystackData.amount / 100,
    organizer_owes:   orgOwes,
    reseller_owes:    0,
    platform_keeps:   platformKeeps,
    status:           'pending',
    notes:            `${qty}x ${meta.tier_name} via USSD (${guestPhone})`,
  }).catch(err => console.error('[USSD] Ledger error:', err.message));

  await db.rpc('increment_event_tickets_sold', { event_id_param: meta.event_id, amount: qty }).catch(() => {});

  await db.from('ussd_pending')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('reference', reference)
    .catch(() => {});

  // ── SMS ───────────────────────────────────────────────────
  const ticketUrl = `${BASE_URL}/tickets/find?ref=${encodeURIComponent(reference)}`;
  const smsMessage = [
    'OUSTED Ticket Confirmed!',
    `Event: ${meta.event_title || 'Event'}`,
    `Tier: ${meta.tier_name || 'General'} x${qty}`,
    `Ref: ${reference}`,
    `View: ${ticketUrl}`,
  ].join('\n');

  let smsSent = false;
  if (e164Phone) {
    const smsResult = await sendArkeselSMS(e164Phone, smsMessage);
    smsSent = smsResult.success;
    await logSMS(db, { reference, phone: e164Phone, message: smsMessage, result: smsResult, channel: 'ussd' });
  } else {
    console.warn('[USSD] No phone available — SMS skipped for ref:', reference);
    await logSMS(db, {
      reference,
      phone:   guestEmail,
      message: '(skipped — no USSD phone)',
      result:  { success: false, error: 'no_phone' },
      channel: 'ussd',
    });
  }

  // Fire automation trigger (best-effort)
  fetch(`${BASE_URL}/api/automations/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal',
    },
    body: JSON.stringify({
      event_type:   'ticket.purchased',
      event_id:     meta.event_id,
      organizer_id: meta.organizer_id || null,
      data: {
        reference,
        channel:    'USSD',
        tier_name:  meta.tier_name,
        guest_phone: guestPhone,
        amount_paid: paystackData.amount / 100,
        quantity:   qty,
      },
    }),
  }).catch(() => {});

  console.log(`[USSD] ✅ ${qty} ticket(s), SMS→${e164Phone || 'skipped'} | ref: ${reference}`);
  return { ok: true, tickets_created: qty, sms_sent: smsSent };
}
