// Automation trigger engine — internal API called by webhook handler & other routes
// Loads matching rules from DB and fires their configured webhook URLs
// No Zapier, no external auth required — just direct webhook delivery

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

function isInternal(req) {
  return req.headers.get('x-internal-key') === (process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal');
}

export async function POST(req) {
  if (!isInternal(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const { event_type, event_id, organizer_id, data } = body;
  if (!event_type) return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });

  const db = getDb();

  // Load matching rules: event-specific + organizer-global (no event_id)
  const [{ data: specificRules }, { data: globalRules }] = await Promise.all([
    event_id
      ? db.from('automation_rules').select('*').eq('event_id', event_id).eq('trigger_event', event_type).eq('is_active', true)
      : { data: [] },
    organizer_id
      ? db.from('automation_rules').select('*').is('event_id', null).eq('organizer_id', organizer_id).eq('trigger_event', event_type).eq('is_active', true)
      : { data: [] },
  ]);

  const rules = [...(specificRules || []), ...(globalRules || [])];
  if (!rules.length) return NextResponse.json({ ok: true, fired: 0, message: 'No matching rules' });

  const payload = {
    event_type,
    event_id: event_id || null,
    timestamp: new Date().toISOString(),
    platform: 'OUSTED',
    data: data || {},
  };

  // Fire all matching rules in parallel
  const results = await Promise.allSettled(rules.map(rule => fireWebhook(rule, payload)));

  // Log results
  const logEntries = results.map((r, i) => ({
    rule_id: rules[i].id,
    organizer_id: rules[i].organizer_id,
    event_id: event_id || null,
    event_type,
    action_type: 'webhook',
    status: r.status === 'fulfilled' ? 'ok' : 'failed',
    response_ms: r.status === 'fulfilled' ? r.value?.ms : null,
    error: r.status === 'rejected' ? String(r.reason?.message || r.reason).substring(0, 500) : null,
    payload,
  }));

  await db.from('automation_log').insert(logEntries).catch(() => {});

  // Update fire_count + last_fired_at on successful rules
  const firedIds = results
    .map((r, i) => r.status === 'fulfilled' ? rules[i].id : null)
    .filter(Boolean);

  if (firedIds.length) {
    await db.from('automation_rules')
      .update({ last_fired_at: new Date().toISOString(), fire_count: db.rpc('increment', { x: 1 }) })
      .in('id', firedIds)
      .catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    fired: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}

async function fireWebhook(rule, payload) {
  const { url, secret } = rule.action_config || {};
  if (!url) throw new Error('No webhook URL configured on rule ' + rule.id);

  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'OUSTED-Webhooks/1.0',
    'X-OUSTED-Event': payload.event_type,
    'X-OUSTED-Timestamp': payload.timestamp,
    'X-OUSTED-Delivery': crypto.randomUUID(),
  };

  // HMAC-SHA256 signature so receiver can verify authenticity
  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-OUSTED-Signature'] = `sha256=${sig}`;
  }

  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });
  const ms = Date.now() - start;

  if (!res.ok) throw new Error(`Webhook to ${url} returned HTTP ${res.status} in ${ms}ms`);
  return { ms, status: res.status };
}
