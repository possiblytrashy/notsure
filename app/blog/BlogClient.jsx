"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, User, Tag, ArrowRight, PenLine } from 'lucide-react';

function PostCard({ post }) {
  const router = useRouter();
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <article
      onClick={() => router.push(`/blog/${post.slug}`)}
      style={{ background: '#fff', borderRadius: 24, overflow: 'hidden', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'transform .2s, box-shadow .2s', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.04)'; }}
    >
      {/* Cover image */}
      {post.cover_image && (
        <div style={{ height: 200, overflow: 'hidden', background: '#f1f5f9' }}>
          <img src={post.cover_image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        </div>
      )}
      {!post.cover_image && (
        <div style={{ height: 120, background: 'linear-gradient(135deg,#0f0c29,#302b63)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎟️</div>
      )}

      <div style={{ padding: '20px 20px 22px' }}>
        {/* Tags */}
        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: '.5px' }}>{tag.toUpperCase()}</span>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 8px', color: '#0f172a', letterSpacing: '-.3px', lineHeight: 1.25 }}>{post.title}</h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} />{post.author_name}</span>
          {post.read_time_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{post.read_time_minutes} min read</span>}
          {date && <span style={{ marginLeft: 'auto' }}>{date}</span>}
        </div>
      </div>
    </article>
  );
}

export default function BlogClient({ initialPosts = [] }) {
  const [posts] = useState(initialPosts);
  const [activeTag, setActiveTag] = useState(null);
  const router = useRouter();

  // Collect all unique tags
  const allTags = [...new Set(posts.flatMap(p => p.tags || []))];

  const filtered = activeTag ? posts.filter(p => p.tags?.includes(activeTag)) : posts;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'inline-block', background: '#000', color: '#CDA434', fontSize: 9, fontWeight: 900, padding: '4px 12px', borderRadius: 20, letterSpacing: '2px', marginBottom: 14 }}>
          OUSTED BLOG
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 950, letterSpacing: '-2px', margin: '0 0 12px', lineHeight: 1.05 }}>Stories from the scene.</h1>
        <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 24px', maxWidth: 520 }}>Event recaps, artist spotlights, and tips from the people putting on the best events.</p>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTag(null)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', background: !activeTag ? '#000' : '#f1f5f9', color: !activeTag ? '#fff' : '#64748b', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>All</button>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)} style={{ padding: '7px 16px', borderRadius: 20, border: 'none', background: activeTag === tag ? '#000' : '#f1f5f9', color: activeTag === tag ? '#fff' : '#64748b', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>{tag}</button>
            ))}
          </div>
        )}
      </div>

      {/* Posts grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✍️</div>
          <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: '#334155' }}>No posts yet</p>
          <p style={{ margin: 0, fontSize: 14 }}>Check back soon — organizers are writing.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
          {filtered.map(post => <PostCard key={post.id} post={post} />)}
        </div>
      )}

      {/* CTA for organizers */}
      <div style={{ marginTop: 60, background: '#0f172a', borderRadius: 28, padding: '36px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: 22, fontWeight: 950, margin: '0 0 6px', letterSpacing: '-.5px' }}>Are you an organizer?</h3>
          <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Share your event stories and grow your audience.</p>
        </div>
        <button onClick={() => router.push('/dashboard/organizer/blog')} style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', border: 'none', padding: '14px 24px', borderRadius: 14, fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PenLine size={15} /> WRITE A POST
        </button>
      </div>
    </div>
  );
}
