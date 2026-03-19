// Automation rules management API
// GET = list organizer's rules, POST = create, PATCH = update, DELETE = delete

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const VALID_TRIGGERS = [
  'ticket.purchased',       // any ticket sold for this event
  'ticket.checked_in',      // attendee scanned at gate
  'event.low_inventory',    // tickets below threshold % (conditions.threshold_pct)
  'event.sold_out',         // last ticket sold
  'vote.cast',              // vote transaction confirmed
  'reseller.sale',          // a reseller made a sale
];

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUser(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const db = getDb();
  const { data: { user } } = await db.auth.getUser(token);
  return user || null;
}

// GET /api/automations/rules?event_id=xxx
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get('event_id');
  const db = getDb();

  let query = db.from('automation_rules')
    .select('id,name,trigger_event,action_type,action_config,conditions,is_active,last_fired_at,fire_count,event_id,created_at')
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false });

  if (event_id) query = query.eq('event_id', event_id);

  const { data: rules, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Load last 5 log entries per rule
  const ruleIds = (rules || []).map(r => r.id);
  let logMap = {};
  if (ruleIds.length) {
    const { data: logs } = await db.from('automation_log')
      .select('rule_id,status,response_ms,error,created_at')
      .in('rule_id', ruleIds)
      .order('created_at', { ascending: false })
      .limit(ruleIds.length * 5);
    (logs || []).forEach(l => {
      if (!logMap[l.rule_id]) logMap[l.rule_id] = [];
      if (logMap[l.rule_id].length < 5) logMap[l.rule_id].push(l);
    });
  }

  return NextResponse.json({
    rules: (rules || []).map(r => ({
      ...r,
      // Mask webhook secret in response
      action_config: r.action_config?.secret
        ? { ...r.action_config, secret: '••••••••' + (r.action_config.secret.slice(-4) || '') }
        : r.action_config,
      recent_logs: logMap[r.id] || [],
    }))
  });
}

// POST /api/automations/rules — create a rule
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, trigger_event, event_id, conditions, action_config } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Rule name is required' }, { status: 400 });
  if (!VALID_TRIGGERS.includes(trigger_event)) {
    return NextResponse.json({ error: `Invalid trigger. Valid: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }
  if (!action_config?.url) return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });

  // Basic URL validation
  try { new URL(action_config.url); } catch {
    return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 });
  }

  const db = getDb();
  const { data: rule, error } = await db.from('automation_rules').insert({
    organizer_id: user.id,
    event_id: event_id || null,
    name: name.trim(),
    trigger_event,
    conditions: conditions || {},
    action_type: 'webhook',
    action_config,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule });
}

// PATCH /api/automations/rules?id=xxx — update
export async function PATCH(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const allowed = ['name', 'trigger_event', 'conditions', 'action_config', 'is_active'];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const db = getDb();
  const { data: rule, error } = await db.from('automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('organizer_id', user.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule });
}

// DELETE /api/automations/rules?id=xxx
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const db = getDb();
  await db.from('automation_rules').delete().eq('id', id).eq('organizer_id', user.id);
  return NextResponse.json({ ok: true });
}
