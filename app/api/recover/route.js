// TEMPORARY — DELETE AFTER RECOVERY IS DONE
// Place at: app/api/recover/route.js
//
// Hit in your browser while logged in as admin:
//   Preview (no writes): https://ousted.live/api/recover?mode=preview
//   Run recovery:        https://ousted.live/api/recover?mode=run

import { NextResponse }      from 'next/server';
import { createClient }      from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies }           from 'next/headers';

export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAdminUser() {
  // Read the session from browser cookies — works when you open the URL directly
  const cookieStore = cookies();
  const browserClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
  const { data: { user }, error } = await browserClient.auth.getUser();
  if (error || !user) return null;

  // Check admin status using service role (bypasses RLS)
  const db = getServiceClient();
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

export async function GET(req) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized — make sure you are logged in as admin.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'preview';
  const db   = getServiceClient();

  // Fetch successful Paystack transactions — secret key stays on the server
  let paystackTxns = [];
  try {
    const res  = await fetch('https://api.paystack.co/transaction?status=success&perPage=100', {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json = await res.json();
    if (!json.status) throw new Error(json.message || 'Paystack API error');
    paystackTxns = json.data || [];
  } catch (err) {
    return NextResponse.json({ error: `Paystack fetch failed: ${err.message}` }, { status: 500 });
  }

  // Only ticket purchases
  const ticketTxns = paystackTxns.filter(t => t.metadata?.type === 'TICKET' || t.metadata?.event_id);
  if (!ticketTxns.length) {
    return NextResponse.json({ message: 'No ticket transactions found in last 100 Paystack transactions.' });
  }

  // Cross-reference with webhook_log to find what was never processed
  const refs = ticketTxns.map(t => t.reference);
  const processedRefs = new Set();
  try {
    const { data: logs } = await db.from('webhook_log').select('reference,status').in('reference', refs);
    (logs || []).forEach(r => { if (r.status === 'processed') processedRefs.add(r.reference); });
  } catch (err) {
    return NextResponse.json({ error: `DB query failed: ${err.message}` }, { status: 500 });
  }

  const toRecover = ticketTxns.filter(t => !processedRefs.has(t.reference));

  // ── PREVIEW ───────────────────────────────────────────────────
  if (mode === 'preview') {
    return NextResponse.json({
      total_ticket_txns: ticketTxns.length,
      already_processed: ticketTxns.length - toRecover.length,
      needs_recovery:    toRecover.length,
      transactions:      toRecover.map(t => ({
        reference:   t.reference,
        email:       t.customer?.email,
        amount:      `GHS ${(t.amount / 100).toFixed(2)}`,
        paid_at:     t.paid_at,
        event_title: t.metadata?.event_title,
        quantity:    t.metadata?.quantity || 1,
      })),
      next_step: toRecover.length > 0
        ? `Go to ${BASE_URL}/api/recover?mode=run to recover these transactions.`
        : 'Nothing to recover.',
    });
  }

  // ── RUN ───────────────────────────────────────────────────────
  const results = [];
  for (const txn of toRecover) {
    try {
      const res  = await fetch(`${BASE_URL}/api/webhooks/paystack/manual`, {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'x-internal-key': process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal',
        },
        body: JSON.stringify({ reference: txn.reference, data: txn }),
      });
      const json = await res.json();
      results.push({
        reference:   txn.reference,
        email:       txn.customer?.email,
        event_title: txn.metadata?.event_title,
        status:      res.ok ? 'recovered' : 'failed',
        detail:      json,
      });
    } catch (err) {
      results.push({ reference: txn.reference, email: txn.customer?.email, status: 'error', detail: err.message });
    }
  }

  return NextResponse.json({
    recovered: results.filter(r => r.status === 'recovered').length,
    failed:    results.filter(r => r.status !== 'recovered').length,
    results,
    reminder:  'DELETE app/api/recover/route.js and redeploy now.',
  });
}
