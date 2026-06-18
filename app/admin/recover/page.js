'use client';
// TEMPORARY — DELETE AFTER RECOVERY IS DONE
// Place at: app/admin/recover/page.js
// Visit:    https://ousted.live/admin/recover

import { useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function RecoverPage() {
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function runPreview() {
    setLoading(true); setError(null); setPreview(null); setResults(null);
    try {
      const token = await getToken();
      const res   = await fetch('/api/recover?mode=preview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreview(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function runRecovery() {
    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const res   = await fetch('/api/recover?mode=run', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResults(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const s = {
    page:    { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 40, fontFamily: 'monospace' },
    card:    { background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: 28, marginBottom: 20 },
    title:   { fontSize: 20, fontWeight: 700, color: '#f8fafc', marginBottom: 6 },
    sub:     { fontSize: 13, color: '#94a3b8', marginBottom: 24 },
    btnGreen:{ padding: '12px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    btnRed:  { padding: '12px 28px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    row:     { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #334155' },
    label:   { color: '#94a3b8' },
    warn:    { background: '#431407', border: '1px solid #9a3412', borderRadius: 8, padding: 16, color: '#fdba74', marginTop: 20, fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>Ticket Recovery</div>
        <div style={s.sub}>Finds payments that succeeded on Paystack but were never written to the database.</div>
        <button style={s.btnGreen} onClick={runPreview} disabled={loading}>
          {loading && !preview ? 'Checking…' : 'Preview'}
        </button>
      </div>

      {error && (
        <div style={{ ...s.card, borderColor: '#dc2626', color: '#fca5a5' }}>
          Error: {error}
        </div>
      )}

      {preview && (
        <div style={s.card}>
          <div style={s.title}>Preview</div>
          <div style={s.row}><span style={s.label}>Ticket transactions checked</span><span>{preview.total_ticket_txns}</span></div>
          <div style={s.row}><span style={s.label}>Already processed</span><span style={{ color: '#4ade80' }}>{preview.already_processed}</span></div>
          <div style={{ ...s.row, borderBottom: 'none' }}><span style={s.label}>Need recovery</span><span style={{ color: preview.needs_recovery > 0 ? '#fbbf24' : '#4ade80' }}>{preview.needs_recovery}</span></div>

          {preview.transactions?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              {preview.transactions.map(t => (
                <div key={t.reference} style={{ ...s.row, flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#f1f5f9' }}>{t.email} — {t.amount} — {t.event_title || 'Unknown event'} (qty {t.quantity})</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{t.reference} · {t.paid_at}</span>
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <button style={s.btnRed} onClick={runRecovery} disabled={loading}>
                  {loading ? 'Recovering…' : `Recover ${preview.needs_recovery} transaction(s)`}
                </button>
              </div>
            </div>
          )}

          {preview.needs_recovery === 0 && (
            <div style={{ marginTop: 16, color: '#4ade80' }}>✓ Nothing to recover.</div>
          )}
        </div>
      )}

      {results && (
        <div style={s.card}>
          <div style={s.title}>Done</div>
          <div style={s.row}><span style={s.label}>Recovered</span><span style={{ color: '#4ade80' }}>{results.recovered}</span></div>
          <div style={{ ...s.row, borderBottom: 'none' }}><span style={s.label}>Failed</span><span style={{ color: results.failed > 0 ? '#f87171' : '#4ade80' }}>{results.failed}</span></div>
          {results.results?.map(r => (
            <div key={r.reference} style={{ ...s.row, flexDirection: 'column', gap: 2, marginTop: 8 }}>
              <span style={{ color: r.status === 'recovered' ? '#4ade80' : '#f87171' }}>
                {r.status === 'recovered' ? '✓' : '✗'} {r.email} — {r.event_title}
              </span>
              <span style={{ color: '#64748b', fontSize: 11 }}>{r.reference}</span>
            </div>
          ))}
          <div style={s.warn}>
            ⚠ Recovery done. Delete <code>app/api/recover/route.js</code> and <code>app/admin/recover/page.js</code> then redeploy.
          </div>
        </div>
      )}
    </div>
  );
}
