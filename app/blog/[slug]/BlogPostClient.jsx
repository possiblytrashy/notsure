"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, User, Share2, Check, ExternalLink } from 'lucide-react';

export default function BlogPostClient({ post, related = [] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: post.title, text: post.excerpt, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Back */}
      <button onClick={() => router.push('/blog')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32, padding: 0, letterSpacing: '.5px' }}>
        <ArrowLeft size={14} /> BACK TO BLOG
      </button>

      {/* Cover */}
      {post.cover_image && (
        <div style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 36, maxHeight: 420 }}>
          <img src={post.cover_image} alt={post.title} style={{ width: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ background: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, letterSpacing: '.5px' }}>{tag.toUpperCase()}</span>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 style={{ fontSize: 36, fontWeight: 950, margin: '0 0 16px', letterSpacing: '-1.5px', lineHeight: 1.1, color: '#0f172a' }}>{post.title}</h1>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36, paddingBottom: 28, borderBottom: '2px solid #f1f5f9', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', fontWeight: 700 }}>
          <User size={13} />{post.author_name}
        </span>
        {post.read_time_minutes && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', fontWeight: 700 }}>
            <Clock size={13} />{post.read_time_minutes} min read
          </span>
        )}
        {date && <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{date}</span>}
        <button onClick={share} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, background: '#f1f5f9', border: 'none', borderRadius: 20, padding: '7px 14px', cursor: 'pointer', color: '#334155' }}>
          {copied ? <><Check size={12} color="#22c55e" /> Copied!</> : <><Share2 size={12} /> Share</>}
        </button>
      </div>

      {/* Content */}
      <div
        style={{ fontSize: 16, lineHeight: 1.8, color: '#334155' }}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <style>{`
        article img { max-width: 100%; border-radius: 16px; margin: 24px 0; }
        article h2 { font-size: 24px; font-weight: 900; margin: 36px 0 12px; color: #0f172a; letter-spacing: -.5px; }
        article h3 { font-size: 20px; font-weight: 800; margin: 28px 0 10px; color: #0f172a; }
        article p { margin: 0 0 20px; }
        article ul, article ol { padding-left: 24px; margin: 0 0 20px; }
        article li { margin-bottom: 8px; }
        article blockquote { border-left: 4px solid #CDA434; padding-left: 20px; margin: 24px 0; color: #64748b; font-style: italic; }
        article a { color: #000; font-weight: 800; }
      `}</style>

      {/* Related posts */}
      {related.length > 0 && (
        <div style={{ marginTop: 60, paddingTop: 40, borderTop: '2px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 18, fontWeight: 950, margin: '0 0 24px', color: '#0f172a' }}>More from the blog</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
            {related.map(r => (
              <div key={r.id} onClick={() => router.push(`/blog/${r.slug}`)} style={{ background: '#f8fafc', borderRadius: 18, padding: '16px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'transform .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <h4 style={{ fontSize: 14, fontWeight: 900, margin: '0 0 6px', color: '#0f172a', lineHeight: 1.3 }}>{r.title}</h4>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>{r.author_name} · {r.read_time_minutes}min</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked event */}
      {post.event_id && (
        <div style={{ marginTop: 36, background: '#0f172a', borderRadius: 20, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: 10, color: '#475569', fontWeight: 900, letterSpacing: '1.5px' }}>FEATURED EVENT</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#fff' }}>Get your tickets</p>
          </div>
          <button onClick={() => router.push(`/events/${post.event_id}`)} style={{ background: 'linear-gradient(135deg,#CDA434,#7a5c1e)', color: '#000', border: 'none', padding: '11px 18px', borderRadius: 12, fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ExternalLink size={13} /> VIEW EVENT
          </button>
        </div>
      )}
    </div>
  );
}
