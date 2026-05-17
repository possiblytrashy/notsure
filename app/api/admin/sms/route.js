// app/api/admin/sms/route.js
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
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
    .map(e => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

function normalisePhone(input) {
  if (!input) return null;
  const p = String(input).replace(/[\s\-()+]/g, '');
  if (/^0[2-9]\d{8}$/.test(p)) return '+233' + p.slice(1);
  if (/^233[2-9]\d{8}$/.test(p)) return '+' + p;
  if (/^\+233[2-9]\d{8}$/.test(p)) return p;
  return null;
}

// Extract phone from a Paystack raw_payload using same priority order as the webhook
function extractPhoneFromPayload(raw) {
  if (!raw) return null;
  const meta = raw?.data?.metadata || {};
  const customFields = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
  const fromCustomFields = customFields.find(f => f.variable_name === 'guest_phone')?.value || null;
  const fromCustomer = raw?.data?.customer?.phone ? String(raw.data.customer.phone).trim() : null;

  return (
    (meta.guest_phone && String(meta.guest_phone).trim()) ||
    (fromCustomFields && String(fromCustomFields).trim()) ||
    fromCustomer ||
    null
  );
}

async function sendSMS(phone, message) {
  const apiKey = process.env.ARKESEL_API_KEY;
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

// GET — fetch all tickets, resolve phone from webhook_log raw_payload
export async function GET(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Fetch tickets — guest_phone is NOT stored in the tickets table,
  // so we pull it from webhook_log.raw_payload below
  const { data: tickets, error: ticketError } = await db
    .from('tickets')
    .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,status,created_at,amount,base_amount')
    .eq('status', 'valid')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 500 });

  if (!tickets || tickets.length === 0) {
    return NextResponse.json({ tickets: [] });
  }

  // Get the unique references so we can look up phones from webhook_log
  const refs = [...new Set(tickets.map(t => t.reference).filter(Boolean))];

  // Fetch webhook logs for these references — raw_payload has the phone
  const { data: logs } = await db
    .from('webhook_log')
    .select('reference,raw_payload')
    .in('reference', refs);

  // Also check ussd_pending — USSD tickets store the phone as `msisdn`
  const { data: ussdRows } = await db
    .from('ussd_pending')
    .select('reference,msisdn')
    .in('reference', refs);

  // Build lookup: reference → phone
  const phoneByRef = {};
  (logs || []).forEach(log => {
    const phone = extractPhoneFromPayload(log.raw_payload);
    if (phone) phoneByRef[log.reference] = phone;
  });
  (ussdRows || []).forEach(u => {
    if (u.msisdn && !phoneByRef[u.reference]) phoneByRef[u.reference] = u.msisdn;
  });

  // Fetch event titles
  const eventIds = [...new Set(tickets.map(t => t.event_id).filter(Boolean))];
  const { data: events } = eventIds.length
    ? await db.from('events').select('id,title').in('id', eventIds)
    : { data: [] };
  const eventMap = {};
  (events || []).forEach(e => { eventMap[e.id] = e.title; });

  // Group by reference
  const grouped = {};
  tickets.forEach(t => {
    const ref = t.reference;
    const phone = phoneByRef[ref] || null;
    if (!grouped[ref]) {
      grouped[ref] = {
        reference: ref,
        event_id: t.event_id,
        event_title: eventMap[t.event_id] || 'Unknown Event',
        guest_name: t.guest_name || 'Guest',
        guest_email: t.guest_email || '',
        guest_phone: phone,
        tier_name: t.tier_name || 'Ticket',
        quantity: 0,
        ticket_numbers: [],
        amount: t.amount || t.base_amount || 0,
        created_at: t.created_at,
        has_phone: !!phone,
      };
    }
    grouped[ref].quantity += 1;
    if (t.ticket_number) grouped[ref].ticket_numbers.push(t.ticket_number);
  });

  const ticketGroups = Object.values(grouped).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return NextResponse.json({ tickets: ticketGroups });
}

// POST — send SMS to selected references or all
export async function POST(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { references, sendAll } = await req.json();
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

  const db = getServiceClient();

  // Fetch tickets
  let query = db
    .from('tickets')
    .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,status')
    .eq('status', 'valid');

  if (!sendAll && references?.length) {
    query = query.in('reference', references);
  }

  const { data: tickets, error } = await query.limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!tickets?.length) return NextResponse.json({ ok: true, results: { sent: 0, skipped: 0, failed: 0 } });

  const refs = [...new Set(tickets.map(t => t.reference).filter(Boolean))];

  // Resolve phones from webhook_log + ussd_pending
  const { data: logs } = await db.from('webhook_log').select('reference,raw_payload').in('reference', refs);
  const { data: ussdRows } = await db.from('ussd_pending').select('reference,msisdn').in('reference', refs);
  const phoneByRef = {};
  (logs || []).forEach(log => {
    const phone = extractPhoneFromPayload(log.raw_payload);
    if (phone) phoneByRef[log.reference] = phone;
  });
  (ussdRows || []).forEach(u => {
    if (u.msisdn && !phoneByRef[u.reference]) phoneByRef[u.reference] = u.msisdn;
  });

  // Event titles
  const eventIds = [...new Set(tickets.map(t => t.event_id).filter(Boolean))];
  const { data: events } = eventIds.length
    ? await db.from('events').select('id,title').in('id', eventIds)
    : { data: [] };
  const eventMap = {};
  (events || []).forEach(e => { eventMap[e.id] = e.title; });

  // Group by reference
  const grouped = {};
  tickets.forEach(t => {
    if (!grouped[t.reference]) {
      grouped[t.reference] = {
        reference: t.reference,
        event_title: eventMap[t.event_id] || 'Your Event',
        guest_name: t.guest_name || 'Guest',
        guest_email: t.guest_email,
        guest_phone: phoneByRef[t.reference] || null,
        tier_name: t.tier_name || 'Ticket',
        quantity: 0,
        ticket_numbers: [],
      };
    }
    grouped[t.reference].quantity += 1;
    if (t.ticket_number) grouped[t.reference].ticket_numbers.push(t.ticket_number);
  });

  const results = { sent: 0, skipped: 0, failed: 0, errors: [] };

  for (const entry of Object.values(grouped)) {
    if (!entry.guest_phone) { results.skipped += 1; continue; }

    const message = [
      'OUSTED: Your ticket details',
      `Event: ${entry.event_title}`,
      `${entry.tier_name} x${entry.quantity}`,
      `Ticket(s): ${entry.ticket_numbers.join(', ')}`,
      `Ref: ${entry.reference}`,
      `${BASE_URL}/tickets/find?ref=${encodeURIComponent(entry.reference)}`,
    ].join('\n');

    const result = await sendSMS(entry.guest_phone, message);
    if (result.success) {
      results.sent += 1;
    } else {
      results.failed += 1;
      results.errors.push({ reference: entry.reference, error: result.error });
    }

    await new Promise(r => setTimeout(r, 120));
  }

  return NextResponse.json({ ok: true, results });
}
