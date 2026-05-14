// Server-side admin data endpoint — uses service role key, bypasses RLS
// The browser client only has anon key which RLS blocks from financial tables
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAdminUser(req) {
  // Verify the requester is actually an admin using their session token
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Check profile role
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',')
    .map(e => e.trim().toLowerCase()).filter(Boolean);

  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

export async function GET(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Fetch all three sources in parallel
  const [
    { data: tickets },
    { data: votes },
    { data: organizers },
    { data: resellerLinks },
    { data: ledger },
  ] = await Promise.all([
    // Tickets — simple join, no deep nesting
    db.from('tickets')
      .select('id,reference,event_id,base_amount,platform_fee,is_reseller_purchase,reseller_code,event_reseller_id,created_at,status,amount')
      .eq('status', 'valid')
      .order('created_at', { ascending: false })
      .limit(1000),

    // Vote transactions
    db.from('vote_transactions')
      .select('id,reference,candidate_id,contest_id,competition_id,voter_email,vote_count,vote_price,platform_fee,amount_paid,status,created_at')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(500),

    // Organizers — separate so we can build a lookup map
    db.from('organizers')
      .select('id,user_id,name,business_name,bank_code,account_number,mobile_money_provider,mobile_money_number'),

    // Reseller links
    db.from('event_resellers')
      .select('id,event_id,reseller_id,unique_code,tickets_sold,total_earned,resellers:reseller_id(id,name,mobile_money_number,mobile_money_provider,bank_code,account_number)'),

    // Payout ledger (may be empty for older installs — that's OK)
    db.from('payout_ledger')
      .select('id,reference,event_id,transaction_type,status,total_collected,organizer_owes,reseller_owes,platform_keeps,organizer_id,event_reseller_id,organizer_paid,reseller_paid,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  // Fetch events separately to avoid FK join issues
  const eventIds = [...new Set([
    ...(tickets || []).map(t => t.event_id),
    ...(votes || []).map(v => v.contest_id), // for labelling
  ].filter(Boolean))];

  const { data: events } = await db.from('events')
    .select('id,title,organizer_id')
    .in('id', eventIds.length ? eventIds : ['00000000-0000-0000-0000-000000000000']);

  // Fetch candidates for vote → organizer mapping
  const candidateIds = [...new Set((votes || []).map(v => v.candidate_id).filter(Boolean))];
  const { data: candidates } = candidateIds.length ? await db.from('candidates')
    .select('id,contest_id,contests:contest_id(id,organizer_id,competition_id,competitions:competition_id(organizer_id))')
    .in('id', candidateIds) : { data: [] };

  // Fetch USSD stats
  let ussdPending = [];
  try {
    const { data: up } = await db.from('ussd_pending')
      .select('id,reference,msisdn,event_title,tier_name,quantity,total_amount,momo_network,status,created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    ussdPending = up || [];
  } catch {}

  return NextResponse.json({
    tickets: tickets || [],
    votes: votes || [],
    organizers: organizers || [],
    resellerLinks: resellerLinks || [],
    ledger: ledger || [],
    events: events || [],
    candidates: candidates || [],
    ussdPending,
  });
}

export async function POST(req) {
  // Mark payout as paid
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { references, field } = await req.json();
  if (!references?.length || !['organizer_paid', 'reseller_paid'].includes(field)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const db = getServiceClient();
  const { error } = await db.from('payout_ledger')
    .update({ [field]: true, status: 'paid', paid_at: new Date().toISOString() })
    .in('reference', references);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
