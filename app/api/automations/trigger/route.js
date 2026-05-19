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
    rule_id:      rules[i].id,
    organizer_id: rules[i].organizer_id,
    event_id:     event_id || null,
    event_type,
    action_type:  'webhook',
    status:       r.status === 'fulfilled' ? 'ok' : 'failed',
    response_ms:  r.status === 'fulfilled' ? r.value?.ms : null,
    error:        r.status === 'rejected'  ? String(r.reason?.message || r.reason).substring(0, 500) : null,
    payload,
  }));

  await db.from('automation_log').insert(logEntries).catch(() => {});

  // Update last_fired_at on successful rules, then increment fire_count via a separate
  // plain UPDATE that reads the current value first (avoids passing a Promise as a column value)
  const firedIds = results
    .map((r, i) => r.status === 'fulfilled' ? rules[i].id : null)
    .filter(Boolean);

  if (firedIds.length) {
    const now = new Date().toISOString();

    // Update last_fired_at for all fired rules at once
    await db.from('automation_rules')
      .update({ last_fired_at: now })
      .in('id', firedIds)
      .catch(() => {});

    // Increment fire_count one by one using raw SQL expression via RPC.
    // Falls back to a read-then-write if the RPC doesn't exist.
    for (const ruleId of firedIds) {
      const { error: rpcErr } = await db.rpc('increment_automation_fire_count', { rule_id_param: ruleId }).catch(() => ({ error: true }));
      if (rpcErr) {
        // Fallback: read current count, add 1
        const { data: rule } = await db.from('automation_rules').select('fire_count').eq('id', ruleId).single().catch(() => ({ data: null }));
        await db.from('automation_rules')
          .update({ fire_count: (rule?.fire_count || 0) + 1 })
          .eq('id', ruleId)
          .catch(() => {});
      }
    }
  }

  return NextResponse.json({
    ok:     true,
    fired:  results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  });
}

async function fireWebhook(rule, payload) {
  const { url, secret } = rule.action_config || {};
  if (!url) throw new Error('No webhook URL configured on rule ' + rule.id);

  const body    = JSON.stringify(payload);
  const headers = {
    'Content-Type':        'application/json',
    'User-Agent':          'OUSTED-Webhooks/1.0',
    'X-OUSTED-Event':      payload.event_type,
    'X-OUSTED-Timestamp':  payload.timestamp,
    'X-OUSTED-Delivery':   crypto.randomUUID(),
  };

  if (secret) {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    headers['X-OUSTED-Signature'] = `sha256=${sig}`;
  }

  const start = Date.now();
  const res   = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });
  const ms = Date.now() - start;

  if (!res.ok) throw new Error(`Webhook to ${url} returned HTTP ${res.status} in ${ms}ms`);
  return { ms, status: res.status };
}
