// Test-fire a webhook rule with synthetic sample data
// Organizer calls this to verify their endpoint is receiving correctly

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SAMPLE_DATA = {
  'ticket.purchased': {
    reference: 'OT-TEST-SAMPLE001',
    ticket_number: 'OT-M3X9K2-ABC123',
    event_title: 'Test Event',
    tier_name: 'VIP',
    guest_name: 'Sample Buyer',
    guest_email: 'sample@ousted.live',
    amount_paid: 120.00,
    currency: 'GHS',
    is_reseller_purchase: false,
  },
  'ticket.checked_in': {
    reference: 'OT-TEST-SAMPLE001',
    ticket_number: 'OT-M3X9K2-ABC123',
    event_title: 'Test Event',
    tier_name: 'VIP',
    guest_name: 'Sample Buyer',
    scanned_at: new Date().toISOString(),
    scanned_by: 'gate-web',
  },
  'event.low_inventory': {
    event_id: 'sample-event-id',
    event_title: 'Test Event',
    tier_name: 'General Admission',
    tickets_remaining: 12,
    tickets_total: 200,
    sold_pct: 94,
  },
  'event.sold_out': {
    event_id: 'sample-event-id',
    event_title: 'Test Event',
    total_tickets_sold: 200,
    gross_revenue: 12000.00,
    currency: 'GHS',
  },
  'vote.cast': {
    reference: 'VOTE-TEST-SAMPLE001',
    candidate_name: 'Sample Candidate',
    contest_title: 'Best Performer',
    vote_count: 5,
    amount_paid: 26.25,
    currency: 'GHS',
  },
  'reseller.sale': {
    reseller_name: 'Sample Reseller',
    event_title: 'Test Event',
    tickets_sold: 2,
    commission_earned: 20.00,
    currency: 'GHS',
  },
};

export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rule_id } = await req.json().catch(() => ({}));
  if (!rule_id) return NextResponse.json({ error: 'Missing rule_id' }, { status: 400 });

  const { data: rule } = await db.from('automation_rules')
    .select('*').eq('id', rule_id).eq('organizer_id', user.id).maybeSingle();

  if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

  const { url, secret } = rule.action_config || {};
  if (!url) return NextResponse.json({ error: 'Rule has no webhook URL' }, { status: 400 });

  const payload = {
    event_type: rule.trigger_event,
    event_id: rule.event_id || null,
    timestamp: new Date().toISOString(),
    platform: 'OUSTED',
    test: true,
    data: SAMPLE_DATA[rule.trigger_event] || { message: 'Test delivery from OUSTED' },
  };

  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'OUSTED-Webhooks/1.0',
    'X-OUSTED-Event': rule.trigger_event,
    'X-OUSTED-Timestamp': payload.timestamp,
    'X-OUSTED-Delivery': crypto.randomUUID(),
    'X-OUSTED-Test': 'true',
  };

  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-OUSTED-Signature'] = `sha256=${sig}`;
  }

  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
    const ms = Date.now() - start;
    const responseText = await res.text().catch(() => '');

    await db.from('automation_log').insert({
      rule_id: rule.id,
      organizer_id: user.id,
      event_id: rule.event_id || null,
      event_type: rule.trigger_event,
      action_type: 'webhook',
      status: res.ok ? 'ok' : 'failed',
      response_ms: ms,
      error: res.ok ? null : `HTTP ${res.status}`,
      payload,
    }).catch(() => {});

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      response_ms: ms,
      response_preview: responseText.substring(0, 200),
      message: res.ok
        ? `✓ Delivered successfully in ${ms}ms`
        : `✗ Endpoint returned HTTP ${res.status}`,
    });
  } catch (err) {
    const ms = Date.now() - start;
    await db.from('automation_log').insert({
      rule_id: rule.id, organizer_id: user.id,
      event_type: rule.trigger_event, action_type: 'webhook',
      status: 'failed', response_ms: ms,
      error: err.message?.substring(0, 500), payload,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: err.message, response_ms: ms }, { status: 500 });
  }
}
