// USSD Payment Confirmed — called by the Paystack webhook when a USSD MoMo charge succeeds
// Creates ticket records, writes to payout_ledger, sends SMS with ticket link via Arkesel
// This is called internally from the main Paystack webhook handler

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendSMS } from '../../../lib/sms.js';

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

// ─── MAIN HANDLER ────────────────────────────────────────────
export async function processUSSDPayment(reference, paystackData) {
  const db = getDb();
  const meta = paystackData.metadata || {};

  // Idempotency check — already processed?
  const { data: existing } = await new Promise(function(resolve, reject) {
    db.from('tickets').select('id,ticket_number').eq('reference', reference).limit(1).then(resolve, reject);
  });

  if (existing?.length) {
    console.log(`[USSD] Already processed ${reference}`);
    return { ok: true, already_processed: true };
  }

  const qty = Math.max(1, parseInt(meta.quantity || 1));
  const guestEmail = meta.guest_email || `ussd-${meta.ussd_phone}@ousted.live`;
  const guestPhone = meta.ussd_phone || '';

  const tickets = Array.from({ length: qty }, () => ({
    event_id:             meta.event_id,
    tier_id:              meta.tier_id,
    tier_name:            meta.tier_name || '',
    reference,
    ticket_number:        generateTicketNumber(),
    guest_email:          guestEmail,
    guest_name:           `USSD Buyer (${guestPhone})`,
    amount:               meta.buyer_price || (paystackData.amount / 100 / qty),
    base_amount:          meta.base_price  || (paystackData.amount / 100 / qty),
    platform_fee:         meta.platform_fee || 0,
    is_reseller_purchase: false,
    reseller_code:        'DIRECT',
    status:               'valid',
    is_scanned:           false,
    channel:              'USSD',
  }));

  const { data: insertedTickets, error: ticketError } = await new Promise(function(resolve, reject) {
    db.from('tickets').insert(tickets).select('ticket_number').then(resolve, reject);
  });

  if (ticketError) {
    console.error('[USSD] Ticket insert error:', ticketError.message);
    return { ok: false, error: ticketError.message };
  }

  const orgOwes = parseFloat((meta.base_price * qty).toFixed(2));
  const platformKeeps = parseFloat(((paystackData.amount / 100) - orgOwes).toFixed(2));

  try {
    await new Promise(function(resolve, reject) {
      db.from('payout_ledger').insert({
        reference,
        event_id:          meta.event_id,
        organizer_id:      meta.organizer_id || null,
        transaction_type:  'TICKET',
        total_collected:   paystackData.amount / 100,
        organizer_owes:    orgOwes,
        reseller_owes:     0,
        platform_keeps:    platformKeeps,
        status:            'pending',
        notes:             `${qty}x ${meta.tier_name} via USSD (${guestPhone})`,
      }).then(resolve, reject);
    });
  } catch (err) {
    console.error('[USSD] Ledger insert error:', err.message);
  }

  try {
    await new Promise(function(resolve, reject) {
      db.rpc('increment_event_tickets_sold', { event_id_param: meta.event_id, amount: qty }).then(resolve, reject);
    });
  } catch (e) {}

  try {
    await new Promise(function(resolve, reject) {
      db.from('ussd_pending')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('reference', reference)
        .then(resolve, reject);
    });
  } catch (e) {}

  const ticketNumbers = (insertedTickets || []).map(t => t.ticket_number).join(', ');
  const smsTarget = normalisePhoneForSMS(guestPhone);
  const ticketUrl = `${BASE_URL}/tickets/find?ref=${encodeURIComponent(reference)}`;

  const smsMessage = [
    `OUSTED Ticket Confirmed!`,
    `Event: ${meta.event_title || 'Event'}`,
    `Tier: ${meta.tier_name || 'General'} x${qty}`,
    `Ref: ${reference}`,
    `View: ${ticketUrl}`,
  ].join('\n');

  if (smsTarget) {
    const smsResult = await sendSMS(smsTarget, smsMessage);
    if (!smsResult.success) {
      console.warn(`[USSD SMS] Failed for ${smsTarget}:`, smsResult.error);
    }
  }

  fetch(`${BASE_URL}/api/automations/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal' },
    body: JSON.stringify({
      event_type: 'ticket.purchased',
      event_id: meta.event_id,
      organizer_id: meta.organizer_id || null,
      data: {
        reference,
        channel: 'USSD',
        tier_name: meta.tier_name,
        guest_phone: guestPhone,
        amount_paid: paystackData.amount / 100,
        quantity: qty,
      },
    }),
  }).then(function() {}).catch(function() {});

  console.log(`[USSD] ✅ ${qty} ticket(s) created, SMS sent to ${smsTarget} | ref: ${reference}`);
  return { ok: true, tickets_created: qty, sms_sent: !!smsTarget };
}

function normalisePhoneForSMS(phone) {
  if (!phone) return null;
  const p = phone.replace(/[\s\-()]/g, '');
  if (/^233[2-9]\d{8}$/.test(p)) return '+' + p;
  if (/^0[2-9]\d{8}$/.test(p)) return '+233' + p.slice(1);
  return null;
}
