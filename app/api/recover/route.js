// TEMPORARY — DELETE AFTER RECOVERY IS DONE
// Place at: app/api/recover/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAdminUser(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const db = getServiceClient();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());
  return isAdmin ? user : null;
}

export async function GET(req) {
  const admin = await getAdminUser(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'preview';
  const db   = getServiceClient();

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

  const ticketTxns = paystackTxns.filter(t => t.metadata?.type === 'TICKET' || t.metadata?.event_id);
  if (!ticketTxns.length) {
    return NextResponse.json({ message: 'No ticket transactions found in last 100 Paystack transactions.' });
  }

  const refs = ticketTxns.map(t => t.reference);
  const processedRefs = new Set();
  try {
    const { data: logs } = await db.from('webhook_log').select('reference,status').in('reference', refs);
    (logs || []).forEach(r => { if (r.status === 'processed') processedRefs.add(r.reference); });
  } catch (err) {
    return NextResponse.json({ error: `DB query failed: ${err.message}` }, { status: 500 });
  }

  const toRecover = ticketTxns.filter(t => !processedRefs.has(t.reference));

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
    });
  }

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
  });
}
