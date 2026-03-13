// Manual webhook fallback — triggered by payment/status polling when webhook was delayed/missed
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';

export async function POST(req) {
  const internalKey = req.headers.get('x-internal-key');
  if (internalKey !== (process.env.INTERNAL_WEBHOOK_KEY || 'ousted-internal')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { reference, data: txData } = await req.json().catch(() => ({}));
  if (!reference || !txData) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Idempotency — don't process twice
  const { data: existing } = await supabase.from('webhook_log').select('status').eq('reference', reference).single().catch(() => ({ data: null }));
  if (existing?.status === 'processed') return NextResponse.json({ ok: true, message: 'Already processed' });

  // Re-use the same webhook processing logic
  const meta = txData.metadata || {};
  try {
    if (meta.type === 'TICKET') {
      const qty = Math.max(1, parseInt(meta.quantity || 1));
      const tickets = Array.from({ length: qty }, () => ({
        event_id: meta.event_id, tier_id: meta.tier_id, tier_name: meta.tier_name || '',
        reference, ticket_number: `OT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
        guest_email: (meta.guest_email || '').toLowerCase(), guest_name: meta.guest_name || 'Guest',
        amount: meta.base_price || (txData.amount / 100 / qty), base_amount: meta.base_price || (txData.amount / 100 / qty),
        platform_fee: meta.platform_fee || 0, is_reseller_purchase: meta.is_reseller_purchase || false,
        reseller_code: meta.reseller_code || 'DIRECT', event_reseller_id: meta.event_reseller_id || null, status: 'valid', is_scanned: false
      }));
      await supabase.from('tickets').insert(tickets);
    } else if (meta.type === 'VOTE') {
      const votes = parseInt(meta.vote_count || 1);
      await supabase.from('vote_transactions').upsert({ reference, candidate_id: meta.candidate_id, contest_id: meta.contest_id, competition_id: meta.competition_id, voter_email: (meta.voter_email || '').toLowerCase(), voter_name: meta.voter_name || 'Anonymous', vote_count: votes, vote_price: meta.vote_price || 0, platform_fee: meta.platform_fee || 0, amount_paid: txData.amount / 100, status: 'confirmed' }, { onConflict: 'reference' });
      const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', meta.candidate_id).single();
      await supabase.from('candidates').update({ vote_count: (cand?.vote_count || 0) + votes }).eq('id', meta.candidate_id);
    }
    await supabase.from('webhook_log').upsert({ reference, status: 'processed', raw_payload: { source: 'manual_fallback', data: txData } }, { onConflict: 'reference' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await supabase.from('webhook_log').upsert({ reference, status: 'failed', raw_payload: { source: 'manual_fallback', error: err.message } }, { onConflict: 'reference' });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
