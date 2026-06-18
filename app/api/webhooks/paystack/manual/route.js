// Manual webhook fallback — triggered by payment/status polling when webhook was delayed/missed.
// Mirrors the main webhook exactly: saves guest_phone on ticket rows, sends SMS, logs to sms_log.
//
// v3.3 BUGFIX: Replaced all chained .catch() on Supabase query builders with try/catch around await.
// In @supabase/supabase-js v2, the query builder is a PromiseLike, NOT a real Promise.
// .catch() is not defined on it and throws "is not a function" at runtime.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

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

function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))   return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  return null;
}

async function sendSMS(phone, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) return { success: false, error: 'no_api_key' };
  const e164 = normalisePhone(phone);
  if (!e164) return { success: false, error: 'invalid_phone' };
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: process.env.ARKESEL_SENDER_ID || 'OUSTED', message, recipients: [e164] }),
    });
    const data = await res.json();
    return data.status === 'success'
      ? { success: true, phone: e164 }
      : { success: false, error: data.message || 'send_failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function logSMS(db, { reference, phone, message, result, channel = 'manual' }) {
  const e164 = normalisePhone(phone) || phone || 'unknown';
  // FIX: was .upsert(...).catch(() => {})
  try {
    await db.from('sms_log').upsert({
      reference, phone: e164, message,
      status:  result.success ? 'sent'  : 'failed',
      error:   result.success ? null     : (result.error || 'unknown'),
      channel,
    }, { onConflict: 'reference,phone' });
  } catch { /* non-fatal */ }
}

export async function POST(req) {
  const internalKey = req.headers.get('x-internal-key');
  if (internalKey !== (process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let reqBody;
  try {
    reqBody = await req.json();
  } catch {
    reqBody = {};
  }
  const { reference, data: txData } = reqBody;
  if (!reference || !txData) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const db   = getDb();
  const meta = txData.metadata || {};

  // ── IDEMPOTENCY CHECK ────────────────────────────────────────
  // FIX: was .single().catch(() => ({ data: null }))
  let existing = null;
  try {
    const { data } = await db
      .from('webhook_log')
      .select('status')
      .eq('reference', reference)
      .single();
    existing = data;
  } catch { /* no row — not yet processed */ }

  if (existing?.status === 'processed') {
    return NextResponse.json({ ok: true, message: 'Already processed' });
  }

  try {
    if (meta.type === 'TICKET') {
      // Idempotency on tickets table too
      const { data: existingTickets } = await db
        .from('tickets')
        .select('id')
        .eq('reference', reference)
        .limit(1);

      if (existingTickets?.length) {
        // FIX: was .upsert(...).catch(() => {})
        try {
          await db.from('webhook_log').upsert({
            reference,
            status: 'processed',
            raw_payload: { source: 'manual_fallback', data: txData },
          }, { onConflict: 'reference' });
        } catch { /* non-fatal */ }
        return NextResponse.json({ ok: true, message: 'Already processed' });
      }

      const qty = Math.max(1, parseInt(meta.quantity || 1));

      // Resolve phone before insert (same priority order as main webhook)
      const customFields          = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
      const phoneFromCustomFields = customFields.find(f => f.variable_name === 'guest_phone')?.value || null;
      const phoneFromCustomer     = txData.customer?.phone ? String(txData.customer.phone).trim() : null;
      const smsPhone =
        (meta.guest_phone       && String(meta.guest_phone).trim())      ||
        (phoneFromCustomFields   && String(phoneFromCustomFields).trim()) ||
        phoneFromCustomer                                                 ||
        null;

      const tickets = Array.from({ length: qty }, () => ({
        event_id:             meta.event_id,
        tier_id:              meta.tier_id,
        tier_name:            meta.tier_name || '',
        reference,
        ticket_number:        generateTicketNumber(),
        guest_email:          (meta.guest_email || '').trim().toLowerCase(),
        guest_name:           meta.guest_name || 'Guest',
        guest_phone:          normalisePhone(smsPhone) || smsPhone || null,
        amount:               meta.base_price || (txData.amount / 100 / qty),
        base_amount:          meta.base_price || (txData.amount / 100 / qty),
        platform_fee:         meta.platform_fee || 0,
        is_reseller_purchase: meta.is_reseller_purchase || false,
        reseller_code:        meta.reseller_code || 'DIRECT',
        event_reseller_id:    meta.event_reseller_id || null,
        status:               'valid',
        is_scanned:           false,
      }));

      const { error: insertError } = await db.from('tickets').insert(tickets);
      if (insertError) throw insertError;

      // SMS
      if (smsPhone) {
        const ticketNumbers = tickets.map(t => t.ticket_number).join(', ');
        const message = [
          'OUSTED: Payment confirmed!',
          `Event: ${meta.event_title || 'Your event'}`,
          `${meta.tier_name || 'Ticket'} x${qty}`,
          `Ticket(s): ${ticketNumbers}`,
          `Ref: ${reference}`,
          `${BASE_URL}/tickets/find?ref=${encodeURIComponent(reference)}`,
        ].join('\n');
        const smsResult = await sendSMS(smsPhone, message);
        await logSMS(db, { reference, phone: smsPhone, message, result: smsResult, channel: 'manual' });
        console.log(`[MANUAL] SMS result: ${JSON.stringify(smsResult)}`);
      } else {
        console.warn(`[MANUAL] No phone for ${meta.guest_email} — SMS skipped`);
        await logSMS(db, {
          reference,
          phone:   meta.guest_email || 'unknown',
          message: '(skipped — no phone)',
          result:  { success: false, error: 'no_phone_provided' },
          channel: 'manual',
        });
      }

    } else if (meta.type === 'VOTE') {
      const votes = parseInt(meta.vote_count || 1);
      // FIX: was .upsert(...) with no error handling
      try {
        await db.from('vote_transactions').upsert({
          reference,
          candidate_id:   meta.candidate_id,
          contest_id:     meta.contest_id,
          competition_id: meta.competition_id,
          voter_email:    (meta.voter_email || '').toLowerCase(),
          voter_name:     meta.voter_name || 'Anonymous',
          vote_count:     votes,
          vote_price:     meta.vote_price || 0,
          platform_fee:   meta.platform_fee || 0,
          amount_paid:    txData.amount / 100,
          status:         'confirmed',
        }, { onConflict: 'reference' });
      } catch (err) {
        console.warn('[MANUAL] vote_transactions upsert failed:', err.message);
      }

      // FIX: was .single().catch(() => ({ data: null }))
      let cand = null;
      try {
        const { data } = await db
          .from('candidates')
          .select('vote_count')
          .eq('id', meta.candidate_id)
          .single();
        cand = data;
      } catch { /* default to 0 */ }

      try {
        await db
          .from('candidates')
          .update({ vote_count: (cand?.vote_count || 0) + votes })
          .eq('id', meta.candidate_id);
      } catch (err) {
        console.warn('[MANUAL] candidate vote_count update failed:', err.message);
      }
    }

    // FIX: was .upsert(...).catch(() => {})
    try {
      await db.from('webhook_log').upsert({
        reference,
        status:      'processed',
        raw_payload: { source: 'manual_fallback', data: txData },
      }, { onConflict: 'reference' });
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MANUAL] Error:', err.message);
    // FIX: was .upsert(...).catch(() => {})
    try {
      await db.from('webhook_log').upsert({
        reference,
        status:      'failed',
        raw_payload: { source: 'manual_fallback', error: err.message },
      }, { onConflict: 'reference' });
    } catch { /* non-fatal */ }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
