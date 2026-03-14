// Admin data API — service role, bypasses RLS
// Written against ACTUAL live DB schema (columns verified from user's Supabase)
// resellers: bank_name, bank_code, account_number, mobile_money_provider, mobile_money_number, name
// organizers: user_id, business_name, name, bank_code, account_number, mobile_money_provider, mobile_money_number
// event_resellers: reseller_id, event_id, unique_code, tickets_sold, total_earned, clicks, is_active
// reseller_sales: event_reseller_id, ticket_ref, amount, commission_earned, paid

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verifyAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const db = getDb();
  try {
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return null;
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
    return isAdmin ? user : null;
  } catch { return null; }
}

export async function GET(req) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // Run all queries in parallel — flat, no nested joins
  const results = await Promise.allSettled([
    // 0: tickets
    db.from('tickets')
      .select('id,reference,event_id,base_amount,amount,platform_fee,is_reseller_purchase,reseller_code,event_reseller_id,created_at,status,guest_email,guest_name,tier_name')
      .eq('status', 'valid')
      .order('created_at', { ascending: false })
      .limit(2000),

    // 1: vote_transactions
    db.from('vote_transactions')
      .select('id,reference,candidate_id,contest_id,competition_id,vote_count,vote_price,platform_fee,amount_paid,status,created_at')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1000),

    // 2: organizers — using actual column names
    db.from('organizers')
      .select('id,user_id,name,business_name,bank_code,account_number,mobile_money_provider,mobile_money_number,paystack_subaccount_code,default_subaccount_code'),

    // 3: resellers — using actual column names (has bank_name AND bank_code)
    db.from('resellers')
      .select('id,user_id,name,phone,payment_method,mobile_money_provider,mobile_money_number,bank_code,bank_name,account_number,account_name,total_earned,is_active'),

    // 4: event_resellers — actual schema
    db.from('event_resellers')
      .select('id,event_id,reseller_id,unique_code,tickets_sold,total_earned,clicks,is_active,sales_count'),

    // 5: reseller_sales — the actual sales tracking table
    db.from('reseller_sales')
      .select('id,event_reseller_id,ticket_ref,amount,commission_earned,created_at,paid')
      .order('created_at', { ascending: false })
      .limit(2000),

    // 6: events
    db.from('events')
      .select('id,title,organizer_id,date,status'),

    // 7: candidates
    db.from('candidates')
      .select('id,contest_id,name,vote_count'),

    // 8: contests
    db.from('contests')
      .select('id,competition_id,organizer_id,title,vote_price'),

    // 9: competitions
    db.from('competitions')
      .select('id,organizer_id,title'),

    // 10: payout_ledger (may not exist on older installs, handled gracefully)
    db.from('payout_ledger')
      .select('id,reference,event_id,transaction_type,status,total_collected,organizer_owes,reseller_owes,platform_keeps,organizer_id,event_reseller_id,organizer_paid,reseller_paid,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const safe = (r) => (r.status === 'fulfilled' ? r.value.data || [] : []);

  return NextResponse.json({
    tickets:       safe(results[0]),
    votes:         safe(results[1]),
    organizers:    safe(results[2]),
    resellers:     safe(results[3]),
    eventResellers: safe(results[4]),
    resellerSales: safe(results[5]),  // individual commission records
    events:        safe(results[6]),
    candidates:    safe(results[7]),
    contests:      safe(results[8]),
    competitions:  safe(results[9]),
    ledger:        safe(results[10]),
  });
}

export async function POST(req) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { references, field } = await req.json().catch(() => ({}));
  if (!references?.length || !['organizer_paid', 'reseller_paid'].includes(field)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const db = getDb();

  // Mark ledger rows
  try {
    await db.from('payout_ledger')
      .update({ [field]: true, status: 'paid', paid_at: new Date().toISOString() })
      .in('reference', references);
  } catch {}

  // Also mark reseller_sales as paid if marking reseller
  if (field === 'reseller_paid') {
    try {
      await db.from('reseller_sales')
        .update({ paid: true, payout_reference: `manual-${Date.now()}` })
        .in('ticket_ref', references);
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
