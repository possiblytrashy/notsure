// app/api/admin/sms/route.js
// Admin endpoint to fetch ticket holders with phone numbers and resend ticket SMS
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
  if (/^\+233[2-9]\d{8}$/.test(String(input).replace(/[\s\-()]/g, ''))) return String(input).replace(/[\s\-()]/g, '');
  return null;
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

// GET — fetch all tickets with guest phone info for the SMS table
export async function GET(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Fetch tickets with all guest info including phone
  const { data: tickets, error } = await db
    .from('tickets')
    .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,guest_phone,amount,base_amount,status,created_at')
    .eq('status', 'valid')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch events for titles
  const eventIds = [...new Set((tickets || []).map(t => t.event_id).filter(Boolean))];
  const { data: events } = eventIds.length
    ? await db.from('events').select('id,title').in('id', eventIds)
    : { data: [] };

  const eventMap = {};
  (events || []).forEach(e => { eventMap[e.id] = e.title; });

  // Enrich tickets and group by reference (one purchase = one SMS)
  const grouped = {};
  (tickets || []).forEach(t => {
    const ref = t.reference;
    if (!grouped[ref]) {
      grouped[ref] = {
        reference: ref,
        event_id: t.event_id,
        event_title: eventMap[t.event_id] || 'Unknown Event',
        guest_name: t.guest_name || 'Guest',
        guest_email: t.guest_email || '',
        guest_phone: t.guest_phone || null,
        tier_name: t.tier_name || 'Ticket',
        quantity: 0,
        ticket_numbers: [],
        amount: t.amount || t.base_amount || 0,
        created_at: t.created_at,
        has_phone: false,
      };
    }
    grouped[ref].quantity += 1;
    grouped[ref].ticket_numbers.push(t.ticket_number);
    if (t.guest_phone) grouped[ref].guest_phone = t.guest_phone;
    grouped[ref].has_phone = !!grouped[ref].guest_phone;
  });

  const ticketGroups = Object.values(grouped).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return NextResponse.json({ tickets: ticketGroups });
}

// POST — send SMS to selected ticket references or all
export async function POST(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { references, sendAll } = await req.json();
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

  const db = getServiceClient();

  // Fetch ticket rows for the requested references
  let query = db
    .from('tickets')
    .select('id,reference,ticket_number,event_id,tier_name,guest_name,guest_email,guest_phone,amount')
    .eq('status', 'valid');

  if (!sendAll && references?.length) {
    query = query.in('reference', references);
  }

  const { data: tickets, error } = await query.limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch event titles
  const eventIds = [...new Set((tickets || []).map(t => t.event_id).filter(Boolean))];
  const { data: events } = eventIds.length
    ? await db.from('events').select('id,title').in('id', eventIds)
    : { data: [] };
  const eventMap = {};
  (events || []).forEach(e => { eventMap[e.id] = e.title; });

  // Group by reference again
  const grouped = {};
  (tickets || []).forEach(t => {
    if (!grouped[t.reference]) {
      grouped[t.reference] = {
        reference: t.reference,
        event_title: eventMap[t.event_id] || 'Your Event',
        guest_name: t.guest_name || 'Guest',
        guest_email: t.guest_email,
        guest_phone: t.guest_phone,
        tier_name: t.tier_name || 'Ticket',
        quantity: 0,
        ticket_numbers: [],
      };
    }
    grouped[t.reference].quantity += 1;
    grouped[t.reference].ticket_numbers.push(t.ticket_number);
    if (t.guest_phone) grouped[t.reference].guest_phone = t.guest_phone;
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

    // Rate-limit: brief delay between sends to avoid Arkesel throttling
    await new Promise(r => setTimeout(r, 120));
  }

  return NextResponse.json({ ok: true, results });
}
