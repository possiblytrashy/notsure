"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Users, CheckCircle2, Clock, TrendingUp, RefreshCcw, Share2, ArrowLeft, BarChart3 } from 'lucide-react';

export default function CheckinDashboard() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId;
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadStats = useCallback(async () => {
    // Fetch event info
    const { data: ev } = await supabase.from('events').select('id,title,date,time,location,organizer_id').eq('id', eventId).maybeSingle();
    if (!ev) { router.push('/dashboard/organizer'); return; }
    setEvent(ev);

    // All tickets
    const { data: allTickets } = await supabase.from('tickets').select('id,is_scanned,scanned_at,tier_name,guest_name,created_at').eq('event_id', eventId).eq('status', 'valid');
    const tickets = allTickets || [];
    const scanned = tickets.filter(t => t.is_scanned);
    const unscanned = tickets.filter(t => !t.is_scanned);

    // By tier
    const byTier = {};
    tickets.forEach(t => {
      const tier = t.tier_name || 'General';
      if (!byTier[tier]) byTier[tier] = { total: 0, scanned: 0 };
      byTier[tier].total++;
      if (t.is_scanned) byTier[tier].scanned++;
    });

    // Scan rate over time (last 60 mins in 5-min buckets)
    const now = new Date();
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now.getTime() - (12 - i) * 5 * 60000);
      const end = new Date(now.getTime() - (11 - i) * 5 * 60000);
      const count = scanned.filter(t => t.scanned_at && new Date(t.scanned_at) >= start && new Date(t.scanned_at) < end).length;
      return { label: start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), count };
    });

    // Recent scans
    const recent = [...scanned].sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at)).slice(0, 10);

    setStats({
      total: tickets.length,
      scanned: scanned.length,
      remaining: unscanned.length,
      rate: tickets.length ? Math.round((scanned.length / tickets.length) * 100) : 0,
      byTier: Object.entries(byTier).map(([name, d]) => ({ name, ...d, pct: d.total ? Math.round((d.scanned / d.total) * 100) : 0 })),
      timeline: buckets,
      peakMinute: Math.max(...buckets.map(b => b.count)),
    });
    setRecentScans(recent);
    setLastUpdate(new Date());
    setLoading(false);
  }, [eventId, router]);

  // Load on mount and poll every 15 seconds
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 15000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase.channel(`checkin-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `event_id=eq.${eventId}` }, () => { loadStats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, loadStats]);

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const maxCount = Math.max(...(stats?.timeline?.map(b => b.count) || [1]), 1);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'inherit' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}*{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <button onClick={() => router.push('/dashboard/organizer')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#94a3b8', padding: 0, marginBottom: 8 }}><ArrowLeft size={14} /> Dashboard</button>
          <h1 style={{ fontSize: 24, fontWeight: 950, margin: '0 0 3px', letterSpacing: '-1px' }}>{event?.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>LIVE · updates every 15s</span>
            {lastUpdate && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Last: {lastUpdate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </div>
        </div>
        <button onClick={loadStats} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', borderRadius: 12, padding: '10px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#334155' }}>
          <RefreshCcw size={13} /> Refresh
        </button>
      </div>

      {/* Hero stat */}
      <div style={{ background: '#0f172a', borderRadius: 28, padding: '32px', marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: `${stats.rate}%`, height: '100%', background: 'linear-gradient(90deg,rgba(34,197,94,.12),rgba(34,197,94,.04))', transition: 'width 1s ease', pointerEvents: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, position: 'relative' }}>
          {[
            ['CHECKED IN', stats.scanned, '#22c55e', <CheckCircle2 size={18} />],
            ['REMAINING', stats.remaining, '#f59e0b', <Clock size={18} />],
            ['TOTAL SOLD', stats.total, '#fff', <Users size={18} />],
            ['CHECK-IN RATE', `${stats.rate}%`, '#CDA434', <TrendingUp size={18} />],
          ].map(([label, value, color, icon]) => (
            <div key={label}>
              <div style={{ color, marginBottom: 6 }}>{icon}</div>
              <p style={{ margin: '0 0 3px', fontSize: 32, fontWeight: 950, color, letterSpacing: '-2px', lineHeight: 1 }}>{value}</p>
              <p style={{ margin: 0, fontSize: 9, color: 'rgba(255,255,255,.3)', fontWeight: 900, letterSpacing: '1.5px' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Scan timeline */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, margin: '0 0 16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} /> Scan Activity (last 60 min)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {stats.timeline.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${maxCount > 0 ? Math.max(4, (b.count / maxCount) * 64) : 4}px`, background: b.count > 0 ? '#22c55e' : '#f1f5f9', borderRadius: 3, transition: 'height .3s' }} />
                {i % 3 === 0 && <span style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>{b.label}</span>}
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Peak: {stats.peakMinute} scan{stats.peakMinute !== 1 ? 's' : ''} in a 5-min window</p>
        </div>

        {/* By tier */}
        <div style={{ background: '#fff', borderRadius: 22, padding: '20px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, margin: '0 0 16px', color: '#0f172a' }}>By Ticket Type</h3>
          {stats.byTier.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>No tier data</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stats.byTier.map(tier => (
                <div key={tier.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{tier.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>{tier.scanned}/{tier.total} ({tier.pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${tier.pct}%`, background: tier.pct >= 80 ? '#22c55e' : tier.pct >= 50 ? '#f59e0b' : '#e2e8f0', borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent check-ins */}
      <div style={{ background: '#fff', borderRadius: 22, padding: '20px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: 13, fontWeight: 900, margin: '0 0 14px', color: '#0f172a' }}>Recent Check-ins</h3>
        {recentScans.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>No check-ins yet</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentScans.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: i === 0 ? '#f0fdf4' : '#f8fafc', borderRadius: 12, border: `1px solid ${i === 0 ? '#86efac' : '#f1f5f9'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={14} color={i === 0 ? '#22c55e' : '#94a3b8'} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{t.guest_name || 'Guest'}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{t.tier_name || 'General'}</p>
                  </div>
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                  {t.scanned_at ? new Date(t.scanned_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
