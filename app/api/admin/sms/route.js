// app/api/admin/sms/route.js
// Admin endpoint for viewing tickets and resending SMS confirmations.
//
// GET  — returns all valid tickets grouped by reference, with phone + SMS history
// POST — (re)sends SMS to selected references; logs every attempt to sms_log
//
// Phone resolution: reads tickets.guest_phone directly (set at purchase time).
// Falls back to ussd_pending.msisdn for USSD tickets that predate this change.
// No longer digs through webhook_log.raw_payload.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAdminUser(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token      = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p))     return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p))   return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  return null;
}

async function safeQuery(fn) {
  try {
    const { data, error } = await fn();
    if (error) console.warn('[SMS] Query warning:', error.message);
    return data || [];
  } catch (e) {
    console.warn('[SMS] Query exception:', e.message);
    return [];
  }
}

async function sendSMS(phone, message) {
  const apiKey   = process.env.ARKESEL_API_KEY;
  const senderId = process.env.ARKESEL_SENDER_ID || 'OUSTED';
  if (!apiKey) return { success: false, error: 'SMS not configured' };
  const e164 = normalisePhone(phone);
  if (!e164) return { success: false, error: 'Invalid phone number' };
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: senderId, message, recipients: [e164] }),
    });
    const data = await res.json();
    return data.status === 'success'
      ? { success: true, phone: e164 }
      : { success: false, error: data.message || 'Send failed' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function logSMS(db, { reference, phone, message, result, channel = 'resend' }) {
  const e164 = normalisePhone(phone) || phone || 'unknown';
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

// ─── GET ──────────────────────────────────────────────────────
export async function GET(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Fetch tickets — guest_phone is now a real column so we select it directly
  let tickets = await safeQuery(() =>
    db.from('tickets')
      .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,guest_phone,status,created_at,amount,base_amount,channel')
      .eq('status', 'valid')
      .order('created_at', { ascending: false })
      .limit(1000)
  );

  // Graceful fallback for schemas that don't have guest_phone yet
  if (tickets.length === 0) {
    tickets = await safeQuery(() =>
      db.from('tickets')
        .select('id,reference,event_id,status,created_at,amount,base_amount')
        .eq('status', 'valid')
        .order('created_at', { ascending: false })
        .limit(1000)
    );
  }

  if (tickets.length === 0) return NextResponse.json({ tickets: [] });

  const refs = [...new Set(tickets.map(t => t.reference).filter(Boolean))];

  // For any ticket where guest_phone is still null (pre-migration data),
  // fall back to ussd_pending.msisdn — no more webhook_log parsing needed.
  const missingPhoneRefs = refs.filter(ref => {
    const t = tickets.find(tk => tk.reference === ref);
    return !t?.guest_phone;
  });

  const fallbackPhoneByRef = {};
  if (missingPhoneRefs.length > 0) {
    const ussdRows = await safeQuery(() =>
      db.from('ussd_pending')
        .select('reference,msisdn')
        .in('reference', missingPhoneRefs)
    );
    ussdRows.forEach(u => {
      if (u.msisdn) fallbackPhoneByRef[u.reference] = u.msisdn;
    });

    // Last resort: dig through webhook_log for very old tickets
    if (Object.keys(fallbackPhoneByRef).length < missingPhoneRefs.length) {
      const stillMissing = missingPhoneRefs.filter(r => !fallbackPhoneByRef[r]);
      const logs = await safeQuery(() =>
        db.from('webhook_log')
          .select('reference,raw_payload')
          .in('reference', stillMissing)
      );
      logs.forEach(log => {
        try {
          const meta = log.raw_payload?.data?.metadata || {};
          const customFields = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
          const phone =
            (meta.guest_phone && String(meta.guest_phone).trim()) ||
            customFields.find(f => f.variable_name === 'guest_phone')?.value ||
            log.raw_payload?.data?.customer?.phone ||
            null;
          if (phone && !fallbackPhoneByRef[log.reference]) {
            fallbackPhoneByRef[log.reference] = String(phone).trim();
          }
        } catch { /* ignore */ }
      });
    }
  }

  // SMS history — which references have already been sent?
  const smsLogs = refs.length
    ? await safeQuery(() => db.from('sms_log').select('reference,status,sent_at,channel').in('reference', refs))
    : [];
  const smsStatusByRef = {};
  smsLogs.forEach(s => {
    if (!smsStatusByRef[s.reference]) smsStatusByRef[s.reference] = s;
    // prefer most recent
    else if (new Date(s.sent_at) > new Date(smsStatusByRef[s.reference].sent_at)) {
      smsStatusByRef[s.reference] = s;
    }
  });

  // Event titles
  const eventIds = [...new Set(tickets.map(t => t.event_id).filter(Boolean))];
  const events   = eventIds.length
    ? await safeQuery(() => db.from('events').select('id,title').in('id', eventIds))
    : [];
  const eventMap = {};
  events.forEach(e => { eventMap[e.id] = e.title; });

  // Group by reference
  const grouped = {};
  tickets.forEach(t => {
    const ref   = t.reference;
    if (!ref) return;
    // Use ticket's own guest_phone first; fall back for pre-migration rows
    const phone = t.guest_phone || fallbackPhoneByRef[ref] || null;

    if (!grouped[ref]) {
      grouped[ref] = {
        reference:      ref,
        event_id:       t.event_id,
        event_title:    eventMap[t.event_id] || 'Unknown Event',
        guest_name:     t.guest_name  || 'Guest',
        guest_email:    t.guest_email || '',
        guest_phone:    phone,
        tier_name:      t.tier_name   || 'Ticket',
        channel:        t.channel     || 'web',
        quantity:       0,
        ticket_numbers: [],
        amount:         Number(t.amount || t.base_amount || 0),
        created_at:     t.created_at,
        has_phone:      !!phone,
        sms_status:     smsStatusByRef[ref]?.status   || null,
        sms_sent_at:    smsStatusByRef[ref]?.sent_at  || null,
        sms_channel:    smsStatusByRef[ref]?.channel  || null,
      };
    }
    grouped[ref].quantity += 1;
    if (t.ticket_number) grouped[ref].ticket_numbers.push(t.ticket_number);
    // Update phone if we find one in a later row (shouldn't happen, but safe)
    if (!grouped[ref].guest_phone && phone) {
      grouped[ref].guest_phone = phone;
      grouped[ref].has_phone   = true;
    }
  });

  const ticketGroups = Object.values(grouped).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return NextResponse.json({ tickets: ticketGroups });
}

// ─── POST (resend) ────────────────────────────────────────────
export async function POST(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { references, sendAll } = await req.json();
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
  const db       = getServiceClient();

  let tickets = await safeQuery(() => {
    let q = db.from('tickets')
      .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,guest_phone,status,channel')
      .eq('status', 'valid');
    if (!sendAll && references?.length) q = q.in('reference', references);
    return q.limit(1000);
  });

  if (!tickets.length) return NextResponse.json({ ok: true, results: { sent: 0, skipped: 0, failed: 0 } });

  const refs = [...new Set(tickets.map(t => t.reference).filter(Boolean))];

  // Fallback phone resolution for pre-migration rows
  const missingRefs = refs.filter(ref => {
    const t = tickets.find(tk => tk.reference === ref);
    return !t?.guest_phone;
  });

  const fallbackPhoneByRef = {};
  if (missingRefs.length > 0) {
    const ussdRows = await safeQuery(() =>
      db.from('ussd_pending').select('reference,msisdn').in('reference', missingRefs)
    );
    ussdRows.forEach(u => { if (u.msisdn) fallbackPhoneByRef[u.reference] = u.msisdn; });

    const stillMissing = missingRefs.filter(r => !fallbackPhoneByRef[r]);
    if (stillMissing.length) {
      const logs = await safeQuery(() =>
        db.from('webhook_log').select('reference,raw_payload').in('reference', stillMissing)
      );
      logs.forEach(log => {
        try {
          const meta = log.raw_payload?.data?.metadata || {};
          const customFields = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
          const phone =
            (meta.guest_phone && String(meta.guest_phone).trim()) ||
            customFields.find(f => f.variable_name === 'guest_phone')?.value ||
            log.raw_payload?.data?.customer?.phone ||
            null;
          if (phone && !fallbackPhoneByRef[log.reference]) {
            fallbackPhoneByRef[log.reference] = String(phone).trim();
          }
        } catch { /* ignore */ }
      });
    }
  }

  // Event titles
  const eventIds = [...new Set(tickets.map(t => t.event_id).filter(Boolean))];
  const events   = eventIds.length
    ? await safeQuery(() => db.from('events').select('id,title').in('id', eventIds))
    : [];
  const eventMap = {};
  events.forEach(e => { eventMap[e.id] = e.title; });

  // Group by reference
  const grouped = {};
  tickets.forEach(t => {
    if (!t.reference) return;
    const phone = t.guest_phone || fallbackPhoneByRef[t.reference] || null;
    if (!grouped[t.reference]) {
      grouped[t.reference] = {
        reference:      t.reference,
        event_title:    eventMap[t.event_id] || 'Your Event',
        guest_name:     t.guest_name   || 'Guest',
        guest_phone:    phone,
        tier_name:      t.tier_name    || 'Ticket',
        quantity:       0,
        ticket_numbers: [],
      };
    }
    grouped[t.reference].quantity += 1;
    if (t.ticket_number) grouped[t.reference].ticket_numbers.push(t.ticket_number);
    if (!grouped[t.reference].guest_phone && phone) grouped[t.reference].guest_phone = phone;
  });

  const results = { sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const entry of Object.values(grouped)) {
    if (!entry.guest_phone) {
      results.skipped += 1;
      continue;
    }

    const message = [
      'OUSTED: Your ticket details',
      `Event: ${entry.event_title}`,
      `${entry.tier_name} x${entry.quantity}`,
      entry.ticket_numbers.length ? `Ticket(s): ${entry.ticket_numbers.join(', ')}` : null,
      `Ref: ${entry.reference}`,
      `${BASE_URL}/tickets/find?ref=${encodeURIComponent(entry.reference)}`,
    ].filter(Boolean).join('\n');

    const result = await sendSMS(entry.guest_phone, message);
    await logSMS(db, {
      reference: entry.reference,
      phone:     entry.guest_phone,
      message,
      result,
      channel:   'resend',
    });

    if (result.success) { results.sent += 1; }
    else { results.failed += 1; results.errors.push({ reference: entry.reference, error: result.error }); }

    // Rate-limit: ~8 SMS/sec max (Arkesel typical limit)
    await new Promise(r => setTimeout(r, 120));
  }

  return NextResponse.json({ ok: true, results });
}
