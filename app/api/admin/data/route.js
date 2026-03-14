// Admin data API — uses service role, bypasses RLS
// Uses FLAT queries (no deep nested joins) to avoid 400s from bad FK paths
// All relationship building done in JavaScript after fetching

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
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return null;
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

export async function GET(req) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();

  // All queries are flat — no nested selects that can fail on missing FK
  const [
    { data: tickets },
    { data: votes },
    { data: organizers },
    { data: resellers },
    { data: eventResellers },
    { data: events },
    { data: candidates },
    { data: contests },
    { data: competitions },
    { data: ledger },
  ] = await Promise.all([
    db.from('tickets').select('id,reference,event_id,base_amount,amount,platform_fee,is_reseller_purchase,reseller_code,event_reseller_id,created_at,status,guest_email,guest_name,tier_name').eq('status', 'valid').order('created_at', { ascending: false }).limit(2000),
    db.from('vote_transactions').select('id,reference,candidate_id,contest_id,competition_id,voter_email,vote_count,vote_price,platform_fee,amount_paid,status,created_at').eq('status', 'confirmed').order('created_at', { ascending: false }).limit(1000),
    db.from('organizers').select('id,user_id,name,business_name,bank_code,account_number,mobile_money_provider,mobile_money_number,paystack_subaccount_code'),
    db.from('resellers').select('id,user_id,name,phone,payment_method,mobile_money_provider,mobile_money_number,bank_code,account_number,total_earned,is_active'),
    db.from('event_resellers').select('id,event_id,reseller_id,unique_code,tickets_sold,total_earned,clicks,is_active'),
    db.from('events').select('id,title,organizer_id,date,status'),
    db.from('candidates').select('id,contest_id,name,vote_count'),
    db.from('contests').select('id,competition_id,organizer_id,title,vote_price'),
    db.from('competitions').select('id,organizer_id,title'),
    db.from('payout_ledger').select('id,reference,event_id,transaction_type,status,total_collected,organizer_owes,reseller_owes,platform_keeps,organizer_id,event_reseller_id,organizer_paid,reseller_paid,created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  return NextResponse.json({
    tickets: tickets || [],
    votes: votes || [],
    organizers: organizers || [],
    resellers: resellers || [],
    eventResellers: eventResellers || [],
    events: events || [],
    candidates: candidates || [],
    contests: contests || [],
    competitions: competitions || [],
    ledger: ledger || [],
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
  await db.from('payout_ledger')
    .update({ [field]: true, status: 'paid', paid_at: new Date().toISOString() })
    .in('reference', references);

  return NextResponse.json({ ok: true });
}
