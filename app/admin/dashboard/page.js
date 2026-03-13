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
              ['ACCOUNT', entry.account_number || 'Not on file'],
              ['BANK/MoMo', entry.bank_name || entry.mobile_money_provider || 'N/A'],
              ['PLATFORM KEEPS', `GHS ${Number(entry.platform_total).toFixed(2)}`],
            ].map(([l, v]) => (
              <div key={l} style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 8, color: '#94a3b8', fontWeight: 900, letterSpacing: '1.5px' }}>{l}</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Account details for transfer */}
          {entry.account_number && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 900, color: '#0369a1', letterSpacing: '1.5px' }}>TRANSFER DETAILS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{entry.account_name || entry.recipient_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontWeight: 700 }}>{entry.bank_name || entry.mobile_money_provider} · {entry.account_number}</p>
                </div>
                <CopyBtn text={entry.account_number} />
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 950, color: '#0369a1' }}>Amount: GHS {Number(entry.amount_owed).toFixed(2)}</p>
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
    // Pull from payout_ledger + join with organizers/resellers for account details
    const { data: ledger } = await supabase
      .from('payout_ledger')
      .select(`
        id, reference, event_id, transaction_type, status,
        total_collected, organizer_owes, reseller_owes, platform_keeps,
        organizer_id, event_reseller_id, notes, created_at,
        events:event_id(title),
        organizers:organizer_id(
          id, name, business_name, bank_code, account_number,
          mobile_money_provider, mobile_money_number, paystack_subaccount_code,
          profiles:user_id(email)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    // Pull reseller info separately
    const { data: resellerLinks } = await supabase
      .from('event_resellers')
      .select('id, unique_code, total_earned, tickets_sold, resellers:reseller_id(id, name, phone, mobile_money_number, mobile_money_provider, bank_code, account_number)')
      .in('id', (ledger || []).map(l => l.event_reseller_id).filter(Boolean));

    const resellerMap = {};
    (resellerLinks || []).forEach(l => { resellerMap[l.id] = l; });

    // Group by organizer+event and reseller+event for payout rows
    const orgMap = {};
    const resMap = {};

    (ledger || []).forEach(row => {
      // Organizer payout
      const orgKey = `${row.organizer_id}|${row.event_id || 'vote'}`;
      if (!orgMap[orgKey]) {
        orgMap[orgKey] = {
          id: orgKey, recipient_type: 'ORGANIZER',
          organizer_id: row.organizer_id,
          event_id: row.event_id, event_title: row.events?.title || 'Vote Revenue',
          transaction_type: row.transaction_type,
          recipient_name: row.organizers?.business_name || row.organizers?.name || row.organizers?.profiles?.email || '—',
          account_number: row.organizers?.mobile_money_number || row.organizers?.account_number,
          bank_name: row.organizers?.bank_code,
          mobile_money_provider: row.organizers?.mobile_money_provider,
          account_name: row.organizers?.name,
          amount_owed: 0, platform_total: 0, ticket_count: 0,
          status: 'pending', transactions: [],
          latest_ref: row.id
        };
      }
      orgMap[orgKey].amount_owed += Number(row.organizer_owes || 0);
      orgMap[orgKey].platform_total += Number(row.platform_keeps || 0);
      orgMap[orgKey].ticket_count += 1;
      orgMap[orgKey].transactions.push(row);
      if (row.status === 'paid') orgMap[orgKey].status = 'paid';

      // Reseller payout
      if (row.event_reseller_id && Number(row.reseller_owes) > 0) {
        const resKey = row.event_reseller_id;
        const rl = resellerMap[row.event_reseller_id];
        if (!resMap[resKey]) {
          resMap[resKey] = {
            id: resKey, recipient_type: 'RESELLER',
            event_reseller_id: row.event_reseller_id,
            event_id: row.event_id, event_title: row.events?.title || '—',
            transaction_type: 'TICKET',
            recipient_name: rl?.resellers?.name || '—',
            account_number: rl?.resellers?.mobile_money_number || rl?.resellers?.account_number,
            bank_name: rl?.resellers?.bank_code,
            mobile_money_provider: rl?.resellers?.mobile_money_provider,
            account_name: rl?.resellers?.name,
            amount_owed: 0, platform_total: 0, ticket_count: 0,
            status: 'pending', transactions: []
          };
        }
        resMap[resKey].amount_owed += Number(row.reseller_owes || 0);
        resMap[resKey].ticket_count += 1;
        resMap[resKey].transactions.push(row);
        if (row.status === 'paid') resMap[resKey].status = 'paid';
      }
    });

    const allPayouts = [...Object.values(orgMap), ...Object.values(resMap)]
      .sort((a, b) => b.amount_owed - a.amount_owed);

    setPayouts(allPayouts);

    // Totals
    const t = (ledger || []).reduce((acc, row) => ({
      collected: acc.collected + Number(row.total_collected || 0),
      owed_org: acc.owed_org + Number(row.organizer_owes || 0),
      owed_res: acc.owed_res + Number(row.reseller_owes || 0),
      platform: acc.platform + Number(row.platform_keeps || 0),
    }), { collected: 0, owed_org: 0, owed_res: 0, platform: 0 });
    t.pending_count = allPayouts.filter(p => p.status !== 'paid').length;
    setTotals(t);

    // Event breakdown
    const evMap = {};
    (ledger || []).forEach(row => {
      const k = row.event_id || 'votes';
      if (!evMap[k]) evMap[k] = { title: row.events?.title || 'Vote Revenue', collected: 0, owed_org: 0, owed_res: 0, platform: 0, tx: 0 };
      evMap[k].collected += Number(row.total_collected || 0);
      evMap[k].owed_org += Number(row.organizer_owes || 0);
      evMap[k].owed_res += Number(row.reseller_owes || 0);
      evMap[k].platform += Number(row.platform_keeps || 0);
      evMap[k].tx++;
    });
    setEventBreakdown(Object.values(evMap).sort((a, b) => b.collected - a.collected));

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      // Check admin role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') { router.push('/'); return; }
      await load();
    })();
  }, [router, load]);

  const markPaid = async (payoutId) => {
    // Mark all ledger rows for this payout as paid
    // payoutId is either "orgId|eventId" or "reseller_link_id"
    const payout = payouts.find(p => p.id === payoutId);
    if (!payout) return;
    const refs = payout.transactions.map(t => t.reference);
    const field = payout.recipient_type === 'ORGANIZER' ? 'organizer_paid' : 'reseller_paid';
    await supabase.from('payout_ledger').update({ [field]: true, status: 'paid', paid_at: new Date().toISOString() }).in('reference', refs);
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
