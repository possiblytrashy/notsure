"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import {
  LogOut, RefreshCcw, Check, Copy, DollarSign, TrendingUp,
  Users, Ticket, ChevronDown, ChevronRight, Search, Filter,
  CheckCircle2, Clock, AlertTriangle, Loader2, X, Download,
  BarChart3, Calendar, ArrowUpRight, ShieldCheck, Zap
} from 'lucide-react';

/* ─── COPY BUTTON ─── */
function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      style={{ background: done ? '#22c55e20' : 'rgba(0,0,0,.05)', border: `1px solid ${done ? '#22c55e44' : 'rgba(0,0,0,.1)'}`, color: done ? '#22c55e' : '#64748b', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 5 }}>
      {done ? <Check size={11} /> : <Copy size={11} />}{done ? 'OK' : 'COPY'}
    </button>
  );
}

/* ─── STAT CARD ─── */
function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '18px 16px', border: '1px solid #e2e8f0', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 9, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px' }}>{label}</p>
        <div style={{ color: accent }}>{icon}</div>
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 950, letterSpacing: '-1px', color: accent || '#0f172a' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{sub}</p>}
    </div>
  );
}

/* ─── PAYOUT ROW ─── */
function PayoutRow({ entry, onMarkPaid }) {
  const [expanded, setExpanded] = useState(false);
  const [marking, setMarking] = useState(false);
  const isPaid = entry.status === 'paid';
  const isOrg = entry.recipient_type === 'ORGANIZER';

  const mark = async () => {
    setMarking(true);
    await onMarkPaid(entry.id);
    setMarking(false);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 18, marginBottom: 10, border: `1px solid ${isPaid ? '#e2e8f0' : '#f1f5f9'}`, overflow: 'hidden', opacity: isPaid ? .6 : 1 }}>
      {/* Main row */}
      <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 15px', cursor: 'pointer' }}>
        {/* Avatar */}
        <div style={{ width: 40, height: 40, borderRadius: 13, background: isOrg ? '#e0f2fe' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
          {isOrg ? '🏛️' : '🤝'}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.recipient_name || '—'}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.event_title || 'Vote Revenue'} · {entry.ticket_count} {entry.transaction_type === 'VOTE' ? 'votes' : 'ticket'}{ entry.ticket_count !== 1 ? 's' : ''}</p>
        </div>
        {/* Amount + status */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: '0 0 3px', fontSize: 16, fontWeight: 950, color: isPaid ? '#94a3b8' : '#0f172a', letterSpacing: '-0.5px' }}>GHS {Number(entry.amount_owed).toFixed(2)}</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isPaid ? '#f1f5f9' : '#fef9e7', border: `1px solid ${isPaid ? '#e2e8f0' : '#fde68a'}`, borderRadius: 20, padding: '2px 8px' }}>
            {isPaid ? <Check size={9} color="#94a3b8" /> : <Clock size={9} color="#f59e0b" />}
            <span style={{ fontSize: 8, fontWeight: 900, color: isPaid ? '#94a3b8' : '#f59e0b', letterSpacing: '1px' }}>{isPaid ? 'PAID' : 'PENDING'}</span>
          </div>
        </div>
        <ChevronDown size={14} color="#94a3b8" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 15px 15px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0' }}>
            {[
              ['TYPE', entry.recipient_type],
              ['PAYMENT', entry.payment_display || entry.account_number || 'Not on file'],
              ['NAME', entry.account_name || entry.recipient_name || '—'],
              ['PLATFORM KEEPS', `GHS ${Number(entry.platform_total).toFixed(2)}`],
            ].map(([l, v]) => (
              <div key={l} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 8, color: '#94a3b8', fontWeight: 900, letterSpacing: '1.5px' }}>{l}</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Account details for transfer */}
          {(entry.account_number || entry.payment_display) && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 900, color: '#0369a1', letterSpacing: '1.5px' }}>TRANSFER DETAILS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{entry.account_name || entry.recipient_name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#0369a1', fontWeight: 800 }}>{entry.payment_display || `${entry.bank_name || entry.mobile_money_provider || ''} · ${entry.account_number || ''}`}</p>
                </div>
                {entry.account_number && <CopyBtn text={entry.account_number} />}
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 950, color: '#0369a1' }}>Amount to send: GHS {Number(entry.amount_owed).toFixed(2)}</p>
            </div>
          )}

          {/* Transactions list */}
          {entry.transactions?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px' }}>TRANSACTIONS</p>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {entry.transactions.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>
                    <span style={{ color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>{t.reference?.substring(0, 18)}...</span>
                    <span style={{ color: '#0f172a', fontWeight: 900 }}>GHS {Number(t.organizer_owes || t.reseller_owes || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPaid && (
            <button onClick={mark} disabled={marking} style={{ width: '100%', background: marking ? '#f1f5f9' : 'linear-gradient(135deg,#0f172a,#1e293b)', color: marking ? '#94a3b8' : '#fff', border: 'none', padding: '12px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: marking ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {marking ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} />Marking...</> : <><CheckCircle2 size={14} />MARK AS PAID</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN DASHBOARD ─── */
export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending | paid | all
  const [typeFilter, setTypeFilter] = useState('all'); // all | ORGANIZER | RESELLER
  const [search, setSearch] = useState('');
  const [totals, setTotals] = useState({ collected: 0, owed_org: 0, owed_res: 0, platform: 0, pending_count: 0 });
  const [tab, setTab] = useState('payouts'); // payouts | overview
  const [eventBreakdown, setEventBreakdown] = useState([]);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin/data', {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (!res.ok) { setLoading(false); setRefreshing(false); return; }

    const {
      tickets, votes, organizers, resellers, eventResellers,
      resellerSales, events, candidates, contests, competitions, ledger
    } = await res.json();

    // ── LOOKUP MAPS ───────────────────────────────────────────
    const eventMap = {};
    (events || []).forEach(e => { eventMap[e.id] = e; });

    // Organizers keyed by user_id (that's the FK events.organizer_id points to)
    const orgByUserId = {};
    (organizers || []).forEach(o => { orgByUserId[o.user_id] = o; });

    // Resellers keyed by their id (event_resellers.reseller_id)
    const resellerById = {};
    (resellers || []).forEach(r => { resellerById[r.id] = r; });

    // event_resellers keyed by id
    const erById = {};
    (eventResellers || []).forEach(er => { erById[er.id] = er; });

    const contestMap = {};
    (contests || []).forEach(ct => { contestMap[ct.id] = ct; });
    const compMap = {};
    (competitions || []).forEach(cp => { compMap[cp.id] = cp; });
    const candMap = {};
    (candidates || []).forEach(c => { candMap[c.id] = c; });

    // reseller_sales grouped by event_reseller_id
    const salesByEr = {};
    (resellerSales || []).forEach(s => {
      if (!salesByEr[s.event_reseller_id]) salesByEr[s.event_reseller_id] = [];
      salesByEr[s.event_reseller_id].push(s);
    });

    const ledgerRefs = new Set((ledger || []).map(r => r.reference));

    // ── HELPER: payment display ───────────────────────────────
    const paymentInfo = (entity) => {
      // entity can be an organizer or reseller row
      if (entity?.mobile_money_number) {
        return {
          display: `${entity.mobile_money_provider || 'MoMo'}: ${entity.mobile_money_number}`,
          account: entity.mobile_money_number,
          method: entity.mobile_money_provider || 'Mobile Money',
        };
      }
      if (entity?.account_number) {
        return {
          display: `${entity.bank_code || entity.bank_name || 'Bank'}: ${entity.account_number}`,
          account: entity.account_number,
          method: entity.bank_code || entity.bank_name || 'Bank Transfer',
        };
      }
      return { display: 'Payment details not on file', account: null, method: null };
    };

    // ── BUILD PAYOUT ENTRIES ──────────────────────────────────
    const orgMap = {};
    const resMap = {};

    const getOrg = (orgUserId, eventId, txType) => {
      const key = `${orgUserId}||${eventId || 'votes'}`;
      if (!orgMap[key]) {
        const o = orgByUserId[orgUserId] || {};
        const ev = eventMap[eventId] || {};
        const pi = paymentInfo(o);
        orgMap[key] = {
          id: key, recipient_type: 'ORGANIZER',
          organizer_id: orgUserId, event_id: eventId,
          event_title: ev.title || (txType === 'VOTE' ? 'Vote Revenue' : 'Unknown Event'),
          transaction_type: txType,
          recipient_name: o.business_name || o.name || '—',
          payment_display: pi.display,
          account_number: pi.account,
          bank_name: pi.method,
          mobile_money_provider: o.mobile_money_provider || null,
          account_name: o.name || o.business_name || null,
          amount_owed: 0, platform_total: 0, ticket_count: 0,
          status: 'pending', transactions: []
        };
      }
      return orgMap[key];
    };

    const getRes = (erLinkId, eventId) => {
      if (!resMap[erLinkId]) {
        const er = erById[erLinkId] || {};
        // reseller_id on event_resellers points to resellers.id
        const r = resellerById[er.reseller_id] || {};
        const ev = eventMap[eventId] || {};
        const pi = paymentInfo(r);
        resMap[erLinkId] = {
          id: erLinkId, recipient_type: 'RESELLER', event_reseller_id: erLinkId,
          reseller_id: er.reseller_id,
          event_id: eventId, event_title: ev.title || '—', transaction_type: 'TICKET',
          recipient_name: r.name || '—',
          payment_display: pi.display,
          account_number: pi.account,
          bank_name: pi.method,
          mobile_money_provider: r.mobile_money_provider || null,
          account_name: r.account_name || r.name || null,
          amount_owed: 0, platform_total: 0, ticket_count: 0,
          status: 'pending', transactions: []
        };
      }
      return resMap[erLinkId];
    };

    // Process ledger rows (already computed splits)
    (ledger || []).forEach(row => {
      if (row.organizer_id && Number(row.organizer_owes) > 0) {
        const e = getOrg(row.organizer_id, row.event_id, row.transaction_type);
        e.amount_owed += Number(row.organizer_owes);
        e.platform_total += Number(row.platform_keeps || 0);
        e.ticket_count++;
        e.transactions.push({ reference: row.reference, organizer_owes: row.organizer_owes, created_at: row.created_at });
        if (row.organizer_paid) e.status = 'paid';
      }
      if (row.event_reseller_id && Number(row.reseller_owes) > 0) {
        const r = getRes(row.event_reseller_id, row.event_id);
        r.amount_owed += Number(row.reseller_owes);
        r.ticket_count++;
        r.transactions.push({ reference: row.reference, reseller_owes: row.reseller_owes, created_at: row.created_at });
        if (row.reseller_paid) r.status = 'paid';
      }
    });

    // Process tickets not yet in ledger
    (tickets || []).filter(t => !ledgerRefs.has(t.reference)).forEach(t => {
      const ev = eventMap[t.event_id] || {};
      const orgUserId = ev.organizer_id;
      if (!orgUserId) return;
      const base = Number(t.base_amount || t.amount || 0);
      const fee = Number(t.platform_fee || base * 0.05);
      const e = getOrg(orgUserId, t.event_id, 'TICKET');
      e.amount_owed += base;
      e.platform_total += fee;
      e.ticket_count++;
      e.transactions.push({ reference: t.reference, organizer_owes: base, created_at: t.created_at });

      if (t.is_reseller_purchase && t.event_reseller_id) {
        const markup = base * 0.10;
        const r = getRes(t.event_reseller_id, t.event_id);
        r.amount_owed += markup;
        r.ticket_count++;
        r.transactions.push({ reference: t.reference, reseller_owes: markup, created_at: t.created_at });
      }
    });

    // Process reseller_sales (the dedicated commission table)
    // This is the most reliable source for reseller payouts
    (resellerSales || []).forEach(sale => {
      const er = erById[sale.event_reseller_id] || {};
      if (!er.id) return;
      // Check if this sale's ticket is already accounted for above
      const alreadyCounted = Object.values(resMap).some(r =>
        r.transactions.some(t => t.reference === sale.ticket_ref)
      );
      if (alreadyCounted) return;
      const r = getRes(sale.event_reseller_id, er.event_id);
      const commission = Number(sale.commission_earned || 0);
      r.amount_owed += commission;
      r.ticket_count++;
      r.transactions.push({ reference: sale.ticket_ref, reseller_owes: commission, created_at: sale.created_at });
      if (sale.paid) r.status = 'paid';
    });

    // Votes not in ledger
    (votes || []).filter(v => !ledgerRefs.has(v.reference)).forEach(v => {
      const cand = candMap[v.candidate_id] || {};
      const contest = contestMap[cand.contest_id || v.contest_id] || {};
      const comp = compMap[contest.competition_id || v.competition_id] || {};
      const orgUserId = comp.organizer_id || contest.organizer_id;
      if (!orgUserId) return;
      const owed = Number(v.vote_price || 0) * Number(v.vote_count || 1);
      const fee = Number(v.platform_fee || 0) * Number(v.vote_count || 1);
      const e = getOrg(orgUserId, null, 'VOTE');
      e.amount_owed += owed;
      e.platform_total += fee;
      e.ticket_count++;
      e.transactions.push({ reference: v.reference, organizer_owes: owed, created_at: v.created_at });
    });

    const allPayouts = [...Object.values(orgMap), ...Object.values(resMap)]
      .filter(p => p.amount_owed > 0.01)
      .sort((a, b) => b.amount_owed - a.amount_owed);
    setPayouts(allPayouts);

    // ── TOTALS ────────────────────────────────────────────────
    const tktRevenue = (tickets || []).reduce((s, t) => {
      const b = Number(t.base_amount || t.amount || 0);
      return s + b + (b * 0.05) + (t.is_reseller_purchase ? b * 0.10 : 0);
    }, 0);
    const voteRevenue = (votes || []).reduce((s, v) => s + Number(v.amount_paid || 0), 0);
    const collected = tktRevenue + voteRevenue;
    const owedOrg = Object.values(orgMap).reduce((s, p) => s + p.amount_owed, 0);
    const owedRes = Object.values(resMap).reduce((s, p) => s + p.amount_owed, 0);
    setTotals({
      collected, owed_org: owedOrg, owed_res: owedRes,
      platform: collected - owedOrg - owedRes,
      pending_count: allPayouts.filter(p => p.status !== 'paid').length
    });

    // ── EVENT BREAKDOWN ───────────────────────────────────────
    const evBreak = {};
    (tickets || []).forEach(t => {
      const ev = eventMap[t.event_id] || {};
      const k = t.event_id || 'other';
      if (!evBreak[k]) evBreak[k] = { title: ev.title || 'Unknown', collected: 0, owed_org: 0, owed_res: 0, platform: 0, tx: 0 };
      const b = Number(t.base_amount || t.amount || 0);
      evBreak[k].collected += b * (t.is_reseller_purchase ? 1.15 : 1.05);
      evBreak[k].owed_org += b;
      evBreak[k].owed_res += t.is_reseller_purchase ? b * 0.10 : 0;
      evBreak[k].platform += b * 0.05;
      evBreak[k].tx++;
    });
    (votes || []).forEach(() => {
      if (!evBreak['votes']) evBreak['votes'] = { title: 'Vote Revenue', collected: 0, owed_org: 0, owed_res: 0, platform: 0, tx: 0 };
    });
    (votes || []).forEach(v => {
      evBreak['votes'].collected += Number(v.amount_paid || 0);
      evBreak['votes'].owed_org += Number(v.vote_price || 0) * Number(v.vote_count || 1);
      evBreak['votes'].platform += Number(v.platform_fee || 0) * Number(v.vote_count || 1);
      evBreak['votes'].tx++;
    });
    setEventBreakdown(Object.values(evBreak).filter(e => e.tx > 0).sort((a, b) => b.collected - a.collected));

    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      // Ensure profile row exists — NEVER overwrite role here
      try {
        await supabase.from('profiles')
          .upsert({ id: user.id, email: user.email }, { onConflict: 'id', ignoreDuplicates: true });
      } catch {}

      // Check admin — read role from DB only, never from user_metadata
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();

      // Also accept ADMIN_EMAIL env var as a hard bypass
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      const isAdmin = profile?.role === 'admin' || adminEmails.includes(user.email?.toLowerCase());

      if (!isAdmin) { router.push('/'); return; }
      await load();
    })();
  }, [router, load]);

  const markPaid = async (payoutId) => {
    const payout = payouts.find(p => p.id === payoutId);
    if (!payout) return;
    const refs = payout.transactions.map(t => t.reference).filter(Boolean);
    if (!refs.length) { await load(); return; }
    const field = payout.recipient_type === 'ORGANIZER' ? 'organizer_paid' : 'reseller_paid';
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ references: refs, field })
    });
    await load();
  };

  const filtered = payouts.filter(p => {
    const mF = filter === 'all' ? true : filter === 'pending' ? p.status !== 'paid' : p.status === 'paid';
    const mT = typeFilter === 'all' ? true : p.recipient_type === typeFilter;
    const mS = !search || p.recipient_name?.toLowerCase().includes(search.toLowerCase()) || p.event_title?.toLowerCase().includes(search.toLowerCase());
    return mF && mT && mS;
  });

  const pendingTotal = payouts.filter(p => p.status !== 'paid').reduce((a, p) => a + p.amount_owed, 0);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <Loader2 size={32} color="#CDA434" style={{ animation: 'spin .8s linear infinite' }} />
      <p style={{ fontSize: 10, letterSpacing: 4, color: '#94a3b8', fontWeight: 900 }}>LOADING ADMIN</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background: '#0f172a', padding: '14px 18px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>💰</div>
            <div>
              <h1 style={{ color: '#fff', fontWeight: 950, fontSize: 16, margin: 0, letterSpacing: '-.3px' }}>OUSTED ADMIN</h1>
              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, margin: '2px 0 0', letterSpacing: '1px' }}>PAYOUT LEDGER</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {totals.pending_count > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={11} color="#f59e0b" />
                <span style={{ fontSize: 10, fontWeight: 900, color: '#f59e0b' }}>{totals.pending_count} PENDING</span>
              </div>
            )}
            <button onClick={() => { setRefreshing(true); load(); }} style={hBtn}><RefreshCcw size={13} style={{ animation: refreshing ? 'spin .8s linear infinite' : 'none' }} /></button>
            <button onClick={() => router.push('/admin/scan')} style={{ ...hBtn, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', color: '#38bdf8' }}>🎯 Scanner</button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }} style={hBtn}><LogOut size={13} /></button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '18px 16px 80px' }}>

        {/* Urgent payout alert */}
        {pendingTotal > 0 && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '15px 18px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <div>
                <p style={{ margin: '0 0 3px', fontWeight: 900, color: '#92400e', fontSize: 14 }}>Pending Payouts</p>
                <p style={{ margin: 0, fontSize: 12, color: '#b45309', fontWeight: 700 }}>{totals.pending_count} recipient{totals.pending_count !== 1 ? 's' : ''} waiting · Expand each row to see transfer details</p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 950, color: '#92400e', letterSpacing: '-1px' }}>GHS {pendingTotal.toFixed(2)}</p>
          </div>
        )}

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 18 }}>
          <StatCard label="TOTAL COLLECTED" value={`GHS ${totals.collected.toFixed(2)}`} sub="All time" accent="#0f172a" icon={<DollarSign size={16} />} />
          <StatCard label="PLATFORM PROFIT" value={`GHS ${totals.platform.toFixed(2)}`} sub="5% of all sales" accent="#22c55e" icon={<TrendingUp size={16} />} />
          <StatCard label="OWE ORGANIZERS" value={`GHS ${totals.owed_org.toFixed(2)}`} sub="Ticket + vote revenue" accent="#ef4444" icon={<Users size={16} />} />
          <StatCard label="OWE RESELLERS" value={`GHS ${totals.owed_res.toFixed(2)}`} sub="10% commissions" accent="#f59e0b" icon={<Zap size={16} />} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[['payouts', '💸 Payouts'], ['overview', '📊 By Event']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} style={{ padding: '9px 18px', borderRadius: 20, border: 'none', background: tab === v ? '#0f172a' : '#fff', color: tab === v ? '#fff' : '#64748b', fontSize: 12, fontWeight: 900, cursor: 'pointer', boxShadow: tab === v ? '0 4px 14px rgba(0,0,0,.15)' : 'none' }}>{l}</button>
          ))}
        </div>

        {tab === 'overview' ? (
          /* ── EVENT BREAKDOWN TABLE ── */
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 950, margin: '0 0 14px', color: '#0f172a' }}>Revenue by Event</h2>
            {eventBreakdown.map((ev, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', marginBottom: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{ev.title}</h3>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{ev.tx} transaction{ev.tx !== 1 ? 's' : ''}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 950, color: '#0f172a', letterSpacing: '-1px' }}>GHS {ev.collected.toFixed(2)}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[['Organizer', ev.owed_org, '#ef4444'], ['Resellers', ev.owed_res, '#f59e0b'], ['Platform', ev.platform, '#22c55e']].map(([l, v, c]) => (
                    <div key={l} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 10px' }}>
                      <p style={{ margin: '0 0 3px', fontSize: 8, color: '#94a3b8', fontWeight: 900, letterSpacing: '1px' }}>{l.toUpperCase()}</p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 950, color: c }}>GHS {Number(v).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {eventBreakdown.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40, fontWeight: 700 }}>No revenue data yet</p>}
          </div>
        ) : (
          /* ── PAYOUTS VIEW ── */
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['pending', '⏰ Pending'], ['paid', '✅ Paid'], ['all', '📋 All']].map(([v, l]) => (
                  <button key={v} onClick={() => setFilter(v)} style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: filter === v ? '#0f172a' : '#fff', color: filter === v ? '#fff' : '#64748b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['all', 'All'], ['ORGANIZER', '🏛️ Organizers'], ['RESELLER', '🤝 Resellers']].map(([v, l]) => (
                  <button key={v} onClick={() => setTypeFilter(v)} style={{ padding: '7px 13px', borderRadius: 20, border: 'none', background: typeFilter === v ? '#334155' : '#fff', color: typeFilter === v ? '#fff' : '#64748b', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '10px 14px', marginBottom: 16 }}>
              <Search size={13} color="#94a3b8" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or event..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, flex: 1, color: '#0f172a' }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={13} /></button>}
            </div>

            {/* Count + total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#0f172a' }}>Total: GHS {filtered.reduce((a, p) => a + p.amount_owed, 0).toFixed(2)}</p>
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
                <p style={{ color: '#94a3b8', fontWeight: 800, margin: 0 }}>
                  {filter === 'pending' ? 'No pending payouts — all clear!' : 'No records found'}
                </p>
              </div>
            ) : (
              filtered.map(p => <PayoutRow key={p.id} entry={p} onMarkPaid={markPaid} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const hBtn = { background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 };
