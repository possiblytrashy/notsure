"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Sparkles, Image, Video, MessageSquare, Film, Plus, ArrowLeft, Users, Check, Loader2, Trash2 } from 'lucide-react';

const DROP_TYPES = [
  { type: 'photo', icon: Image, label: 'Photo', desc: 'Share a photo from the event', placeholder: 'Paste image URL...' },
  { type: 'video', icon: Video, label: 'Video', desc: 'Share a video highlight', placeholder: 'Paste video URL (YouTube, Vimeo, direct)...' },
  { type: 'message', icon: MessageSquare, label: 'Message', desc: 'Send a personal note to attendees', placeholder: 'Write your message to everyone who attended...' },
  { type: 'highlight_reel', icon: Film, label: 'Highlight Reel', desc: 'A curated video montage', placeholder: 'Paste highlight reel URL...' },
];

export default function AftergrowPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId;
  const [event, setEvent] = useState(null);
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'photo', content: '', caption: '', thumbnail_url: '' });
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      const { data: ev } = await supabase.from('events').select('id,title,date,organizer_id').eq('id', eventId).maybeSingle();
      if (!ev || ev.organizer_id !== u.id) { router.push('/dashboard/organizer'); return; }
      setEvent(ev);

      // Load existing drops
      const res = await fetch(`/api/afterglow/${eventId}`);
      const d = await res.json();
      setDrops(d.drops || []);

      // Count attendees
      const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'valid');
      setAttendeeCount(count || 0);
      setLoading(false);
    })();
  }, [eventId, router]);

  const drop = async () => {
    if (!form.content.trim()) { setError('Content is required'); return; }
    setSaving(true); setError(''); setSuccess('');

    const res = await fetch('/api/afterglow/drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, organizer_id: user.id, ...form }),
    });
    const d = await res.json();

    if (!res.ok) { setError(d.error || 'Failed to drop'); setSaving(false); return; }

    setSuccess(`✨ Dropped to ${d.attendees_reached} attendees!`);
    setForm({ type: 'photo', content: '', caption: '', thumbnail_url: '' });
    // Reload drops
    const r2 = await fetch(`/api/afterglow/${eventId}`);
    const d2 = await r2.json();
    setDrops(d2.drops || []);
    setSaving(false);
  };

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const selectedType = DROP_TYPES.find(t => t.type === form.type) || DROP_TYPES[0];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}*{box-sizing:border-box}`}</style>

      <button onClick={() => router.push('/dashboard/organizer')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#94a3b8', padding: 0, marginBottom: 24 }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63)', borderRadius: 28, padding: '28px 28px 24px', marginBottom: 28, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 120, opacity: .06 }}>✨</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(205,164,52,.15)', border: '1px solid rgba(205,164,52,.3)', borderRadius: 20, padding: '4px 12px', marginBottom: 12 }}>
          <Sparkles size={11} color="#CDA434" /><span style={{ fontSize: 9, fontWeight: 900, color: '#CDA434', letterSpacing: '2px' }}>EVENT AFTERGLOW</span>
        </div>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 950, margin: '0 0 6px', letterSpacing: '-1px' }}>{event?.title}</h1>
        <p style={{ color: 'rgba(255,255,255,.5)', margin: '0 0 20px', fontSize: 13 }}>Drop memories directly into the tickets of everyone who attended</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={14} color="#CDA434" />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{attendeeCount}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>ATTENDEES</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color="#CDA434" />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{drops.length}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>DROPS</span>
          </div>
        </div>
      </div>

      {/* Drop type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {DROP_TYPES.map(({ type, icon: Icon, label, desc }) => (
          <button key={type} onClick={() => setForm(f => ({ ...f, type }))} style={{ background: form.type === type ? '#000' : '#fff', color: form.type === type ? '#fff' : '#64748b', border: `1.5px solid ${form.type === type ? '#000' : '#e2e8f0'}`, borderRadius: 16, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' }}>
            <Icon size={18} style={{ marginBottom: 6, display: 'block', margin: '0 auto 6px' }} />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900 }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Drop form */}
      <div style={{ background: '#fff', borderRadius: 22, padding: '22px', border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', fontWeight: 700 }}>{selectedType.desc}</p>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#16a34a', fontWeight: 700, animation: 'fadeUp .3s ease' }}>{success}</div>}

        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder={selectedType.placeholder} rows={form.type === 'message' ? 4 : 2}
          style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', outline: 'none', marginBottom: 12 }} />

        {form.type !== 'message' && (
          <input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} placeholder="Caption (optional)"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 14, fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />
        )}

        <button onClick={drop} disabled={saving || !form.content.trim()} style={{ width: '100%', background: saving || !form.content.trim() ? '#f1f5f9' : '#000', color: saving || !form.content.trim() ? '#94a3b8' : '#fff', border: 'none', padding: '15px', borderRadius: 14, fontWeight: 900, fontSize: 14, cursor: saving || !form.content.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} />Dropping to {attendeeCount} attendees...</> : <><Sparkles size={15} /> DROP TO ALL ATTENDEES</>}
        </button>
      </div>

      {/* Existing drops */}
      {drops.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 900, margin: '0 0 14px', color: '#0f172a' }}>Dropped Memories ({drops.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {drops.map(d => (
              <div key={d.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                  {d.type === 'photo' ? '📷' : d.type === 'video' ? '🎬' : d.type === 'message' ? '💬' : '🎞️'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.content}</p>
                  {d.caption && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{d.caption}</p>}
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, flexShrink: 0 }}>
                  {new Date(d.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
