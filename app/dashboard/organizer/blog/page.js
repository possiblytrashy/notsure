"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { PenLine, Eye, Trash2, Plus, Save, X, Loader2, ArrowLeft, ExternalLink, Image, Tag } from 'lucide-react';

const EMPTY_POST = { title: '', content: '', excerpt: '', cover_image: '', tags: '', event_id: '', status: 'draft' };

export default function OrganizerBlog() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [editing, setEditing] = useState(null); // null = new, slug = existing
  const [form, setForm] = useState(EMPTY_POST);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);
      await loadPosts(u);
    })();
  }, [router]);

  const loadPosts = async (u) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/blog?author_id=${u.id}&limit=50`);
    const d = await res.json();
    // Also get drafts via direct DB call
    const { data: drafts } = await supabase.from('blog_posts').select('*').eq('author_id', u.id).order('created_at', { ascending: false });
    setPosts(drafts || d.posts || []);
    setLoading(false);
  };

  const startNew = () => { setForm(EMPTY_POST); setEditing(null); setView('editor'); setError(''); };
  const startEdit = (post) => { setForm({ ...post, tags: (post.tags || []).join(', ') }); setEditing(post.slug); setView('editor'); setError(''); };

  const save = async (status) => {
    if (!form.title.trim() || !form.content.trim()) { setError('Title and content are required'); return; }
    setSaving(true); setError('');
    const { data: { session } } = await supabase.auth.getSession();
    const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), status };

    let res;
    if (editing) {
      res = await fetch(`/api/blog/${editing}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      res = await fetch('/api/blog', { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }

    const d = await res.json();
    if (!res.ok) { setError(d.error || 'Failed to save'); setSaving(false); return; }
    await loadPosts(user);
    setView('list');
    setSaving(false);
  };

  const deletePost = async (slug) => {
    if (!confirm('Delete this post?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/blog/${slug}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    await loadPosts(user);
  };

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ animation: 'spin .8s linear infinite', color: '#CDA434' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── EDITOR VIEW ── */
  if (view === 'editor') return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <button onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#64748b', padding: 0 }}><ArrowLeft size={15} /> Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => save('draft')} disabled={saving} style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving ? <Loader2 size={12} style={{ animation: 'spin .8s linear infinite' }} /> : <Save size={12} />} Save Draft
          </button>
          <button onClick={() => save('published')} disabled={saving} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#000', color: '#fff', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
            Publish →
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#ef4444', fontWeight: 700 }}>{error}</div>}

      {/* Title */}
      <textarea value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title..." rows={2}
        style={{ width: '100%', fontSize: 32, fontWeight: 950, letterSpacing: '-1px', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.2, marginBottom: 20, background: 'transparent', color: '#0f172a' }} />

      {/* Fields row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          ['Cover image URL', 'cover_image', Image],
          ['Tags (comma-separated)', 'tags', Tag],
          ['Link to event ID (optional)', 'event_id', ExternalLink],
          ['Excerpt (optional)', 'excerpt', PenLine],
        ].map(([label, key, Icon]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px' }}>
            <Icon size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={label}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#334155', flex: 1, fontFamily: 'inherit' }} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ background: '#f8fafc', padding: '8px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 10, fontWeight: 900, color: '#94a3b8', letterSpacing: '1.5px' }}>CONTENT (HTML supported)</div>
        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Write your post here. You can use HTML for formatting..."
          style={{ width: '100%', minHeight: 400, padding: '20px', border: 'none', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.7, color: '#334155' }} />
      </div>
    </div>
  );

  /* ── LIST VIEW ── */
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px 80px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950, margin: '0 0 4px', letterSpacing: '-1px' }}>Your Blog</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Write about your events and grow your audience</p>
        </div>
        <button onClick={startNew} style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={14} /> NEW POST
        </button>
      </div>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', border: '2px dashed #e2e8f0', borderRadius: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✍️</div>
          <h3 style={{ fontWeight: 900, margin: '0 0 8px', color: '#334155' }}>No posts yet</h3>
          <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: 14 }}>Share your event stories with the world</p>
          <button onClick={startNew} style={{ background: '#000', color: '#fff', border: 'none', padding: '12px 22px', borderRadius: 12, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>Write your first post →</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: '#fff', borderRadius: 18, padding: '16px 18px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14 }}>
              {post.cover_image && <img src={post.cover_image} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</h3>
                  <span style={{ background: post.status === 'published' ? '#dcfce7' : '#f1f5f9', color: post.status === 'published' ? '#16a34a' : '#64748b', fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 20, letterSpacing: '1px', flexShrink: 0 }}>
                    {post.status?.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                  {post.read_time_minutes}min read · {post.published_at ? new Date(post.published_at).toLocaleDateString() : 'Draft'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {post.status === 'published' && (
                  <button onClick={() => window.open(`/blog/${post.slug}`, '_blank')} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye size={14} color="#64748b" /></button>
                )}
                <button onClick={() => startEdit(post)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PenLine size={14} color="#64748b" /></button>
                <button onClick={() => deletePost(post.slug)} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #fecaca', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={14} color="#ef4444" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
