"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Zap, Plus, Trash2, Check, X, Loader2, ChevronDown,
  ArrowLeft, Play, Circle, CheckCircle2, AlertTriangle,
  ExternalLink, Copy, RefreshCcw, ChevronRight, Eye, EyeOff
} from 'lucide-react';

const TRIGGERS = [
  { value: 'ticket.purchased',    label: '🎟️  Ticket Purchased',    desc: 'Fires every time a ticket is sold for this event' },
  { value: 'ticket.checked_in',   label: '✅  Attendee Checked In', desc: 'Fires when a ticket is scanned at the gate' },
  { value: 'event.low_inventory', label: '⚠️  Low Inventory',       desc: 'Fires when tickets sold reach a threshold %' },
  { value: 'event.sold_out',      label: '🔥  Event Sold Out',      desc: 'Fires when the last ticket is sold' },
  { value: 'vote.cast',           label: '🗳️  Vote Cast',           desc: 'Fires every time votes are purchased' },
  { value: 'reseller.sale',       label: '🤝  Reseller Sale',       desc: 'Fires when a reseller converts a sale' },
];

const BLANK = { name: '', trigger_event: 'ticket.purchased', event_id: '', url: '', secret: '', threshold_pct: 90 };

export default function AutomationsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [showSecret, setShowSecret] = useState({});
  const [expandedRule, setExpandedRule] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);
      const { data: evs } = await supabase.from('events')
        .select('id,title').eq('organizer_id', u.id).order('date', { ascending: false });
      setEvents(evs || []);
      await loadRules(u);
    })();
  }, [router]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadRules = async (u) => {
    const token = await getToken();
    const res = await fetch('/api/automations/rules', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const d = await res.json();
    setRules(d.rules || []);
    setLoading(false);
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Rule name is required'); return; }
    if (!form.url.trim()) { setError('Webhook URL is required'); return; }
    try { new URL(form.url); } catch { setError('Invalid URL'); return; }

    setSaving(true); setError('');
    const token = await getToken();
    const payload = {
      name: form.name.trim(),
      trigger_event: form.trigger_event,
      event_id: form.event_id || null,
      conditions: form.trigger_event === 'event.low_inventory' ? { threshold_pct: Number(form.threshold_pct) || 90 } : {},
      action_config: { url: form.url.trim(), secret: form.secret.trim() || undefined },
    };

    const res = await fetch('/api/automations/rules', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) { setError(d.error || 'Save failed'); setSaving(false); return; }
    setShowForm(false);
    setForm(BLANK);
    await loadRules(user);
    setSaving(false);
  };

  const toggleActive = async (rule) => {
    const token = await getToken();
    await fetch(`/api/automations/rules?id=${rule.id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    });
    await loadRules(user);
  };

  const deleteRule = async (id) => {
    if (!confirm('Delete this rule?')) return;
    const token = await getToken();
    await fetch(`/api/automations/rules?id=${id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    await loadRules(user);
  };

  const testRule = async (rule) => {
    setTesting(rule.id);
    const token = await getToken();
    const res = await fetch('/api/automations/test', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_id: rule.id }),
    });
    const d = await res.json();
    setTestResults(prev => ({ ...prev, [rule.id]: d }));
    setTesting(null);
  };

  const samplePayload = (trigger) => {
    const samples = {
      'ticket.purchased': { event_type: 'ticket.purchased', data: { reference: 'OT-XXXXXX', tier_name: 'VIP', guest_name: 'John Doe', amount_paid: 120, currency: 'GHS' } },
      'ticket.checked_in': { event_type: 'ticket.checked_in', data: { reference: 'OT-XXXXXX', tier_name: 'VIP', guest_name: 'John Doe', scanned_at: new Date().toISOString() } },
      'event.low_inventory': { event_type: 'event.low_inventory', data: { tier_name: 'General', tickets_remaining: 12, sold_pct: 94 } },
      'event.sold_out': { event_type: 'event.sold_out', data: { total_tickets_sold: 200, gross_revenue: 12000 } },
      'vote.cast': { event_type: 'vote.cast', data: { candidate_name: 'Jane Smith', vote_count: 5, amount_paid: 26.25 } },
      'reseller.sale': { event_type: 'reseller.sale', data: { reseller_name: 'John Reseller', tickets_sold: 2, commission_earned: 20 } },
    };
    return JSON.stringify(samples[trigger] || {}, null, 2);
  };

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <button onClick={() => router.push('/dashboard/organizer')} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, padding: 0 }}>
            <ArrowLeft size={13} /> DASHBOARD
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 950, margin: '0 0 6px', letterSpacing: '-1px' }}>Automations</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 600 }}>Webhook rules that fire on real platform events — ticket sales, check-ins, sold-out alerts and more.</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setForm(BLANK); }}
          style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* How it works callout */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 20, padding: '18px 20px', marginBottom: 28, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Zap size={18} color="#0ea5e9" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: '0 0 4px', fontWeight: 900, fontSize: 14, color: '#0369a1' }}>How automations work</p>
          <p style={{ margin: 0, fontSize: 13, color: '#0369a1', lineHeight: 1.6, fontWeight: 600 }}>
            When a trigger fires (e.g. a ticket is sold), OUSTED sends a <strong>signed HTTP POST</strong> to your webhook URL with the event data as JSON.
            Use this to update your CRM, push a Slack notification, trigger a Google Sheet update, or integrate with any tool that accepts webhooks.
            Every request includes an <code style={{ background: '#e0f2fe', padding: '1px 6px', borderRadius: 4 }}>X-OUSTED-Signature</code> header so you can verify it's really from us.
          </p>
        </div>
      </div>

      {/* New rule form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 24, padding: '24px', marginBottom: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.06)', animation: 'fadeUp .2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontWeight: 950, fontSize: 16 }}>New Automation Rule</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>RULE NAME</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder='e.g. "Notify my CRM on sale"' style={inp} />
            </div>
            <div>
              <label style={lbl}>EVENT (OPTIONAL)</label>
              <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))} style={inp}>
                <option value="">All my events</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>TRIGGER</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
              {TRIGGERS.map(t => (
                <div key={t.value} onClick={() => setForm(f => ({ ...f, trigger_event: t.value }))}
                  style={{ border: `2px solid ${form.trigger_event === t.value ? '#000' : '#e2e8f0'}`, borderRadius: 14, padding: '11px 14px', cursor: 'pointer', background: form.trigger_event === t.value ? '#000' : '#fff', transition: 'all .15s' }}>
                  <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 900, color: form.trigger_event === t.value ? '#fff' : '#0f172a' }}>{t.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: form.trigger_event === t.value ? 'rgba(255,255,255,.5)' : '#94a3b8', fontWeight: 600 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {form.trigger_event === 'event.low_inventory' && (
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>FIRE WHEN SOLD %</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="50" max="99" value={form.threshold_pct}
                  onChange={e => setForm(f => ({ ...f, threshold_pct: e.target.value }))}
                  style={{ flex: 1 }} />
                <span style={{ fontWeight: 900, minWidth: 40 }}>{form.threshold_pct}%</span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>WEBHOOK URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-server.com/webhooks/ousted" style={inp} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>SECRET (OPTIONAL — for HMAC verification)</label>
            <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="Any random string — we send it as X-OUSTED-Signature" style={inp} type="password" />
          </div>

          {/* Sample payload */}
          <details style={{ marginBottom: 20 }}>
            <summary style={{ fontSize: 12, fontWeight: 800, color: '#64748b', cursor: 'pointer', marginBottom: 8 }}>
              Preview sample payload →
            </summary>
            <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px', fontSize: 11, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
              {samplePayload(form.trigger_event)}
            </pre>
          </details>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> Saving...</> : <><Check size={13} /> Save Rule</>}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '12px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', background: '#f8fafc', borderRadius: 24, border: '1px dashed #e2e8f0' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>⚡</div>
          <h3 style={{ fontWeight: 900, color: '#334155', margin: '0 0 8px' }}>No automations yet</h3>
          <p style={{ color: '#94a3b8', fontWeight: 600, margin: '0 0 20px', fontSize: 14 }}>Create your first rule to start receiving webhooks when things happen on OUSTED</p>
          <button onClick={() => setShowForm(true)} style={{ background: '#000', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            + Create First Rule
          </button>
        </div>
      ) : rules.map(rule => (
        <div key={rule.id} style={{ background: '#fff', borderRadius: 22, marginBottom: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Rule header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer' }}
            onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}>
            {/* Active toggle */}
            <button onClick={e => { e.stopPropagation(); toggleActive(rule); }}
              style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: rule.is_active ? '#22c55e' : '#e2e8f0', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: rule.is_active ? 19 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 3px', fontWeight: 900, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                {TRIGGERS.find(t => t.value === rule.trigger_event)?.label || rule.trigger_event}
                {rule.event_id ? ` · specific event` : ' · all events'}
                {rule.fire_count > 0 ? ` · fired ${rule.fire_count}×` : ''}
              </p>
            </div>
            {/* Last test result */}
            {testResults[rule.id] && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: testResults[rule.id].ok ? '#f0fdf4' : '#fef2f2', borderRadius: 20, border: `1px solid ${testResults[rule.id].ok ? '#86efac' : '#fecaca'}` }}>
                {testResults[rule.id].ok ? <CheckCircle2 size={12} color="#22c55e" /> : <AlertTriangle size={12} color="#ef4444" />}
                <span style={{ fontSize: 10, fontWeight: 800, color: testResults[rule.id].ok ? '#22c55e' : '#ef4444' }}>
                  {testResults[rule.id].ok ? `${testResults[rule.id].response_ms}ms` : 'Failed'}
                </span>
              </div>
            )}
            <ChevronDown size={14} color="#94a3b8" style={{ transform: expandedRule === rule.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
          </div>

          {/* Expanded detail */}
          {expandedRule === rule.id && (
            <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 12 }}>
                <code style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rule.action_config?.url || '—'}
                </code>
                <button onClick={() => navigator.clipboard.writeText(rule.action_config?.url || '')}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', color: '#64748b' }}>
                  <Copy size={13} />
                </button>
              </div>

              {/* Recent logs */}
              {rule.recent_logs?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px', margin: '0 0 8px' }}>RECENT DELIVERIES</p>
                  {rule.recent_logs.map((log, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 12 }}>
                      {log.status === 'ok' ? <CheckCircle2 size={13} color="#22c55e" /> : <AlertTriangle size={13} color="#ef4444" />}
                      <span style={{ color: '#64748b', fontWeight: 700 }}>{new Date(log.created_at).toLocaleString()}</span>
                      {log.response_ms && <span style={{ color: '#94a3b8' }}>{log.response_ms}ms</span>}
                      {log.error && <span style={{ color: '#ef4444', fontSize: 11 }}>{log.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => testRule(rule)} disabled={testing === rule.id}
                  style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', padding: '9px 16px', borderRadius: 12, fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {testing === rule.id ? <><Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} /> Testing...</> : <><Play size={12} /> Test Webhook</>}
                </button>
                <button onClick={() => deleteRule(rule.id)}
                  style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '9px 14px', borderRadius: 12, fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 9, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: 7 };
const inp = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, outline: 'none', background: '#f8fafc', boxSizing: 'border-box' };
