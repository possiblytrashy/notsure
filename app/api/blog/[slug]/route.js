import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req, { params }) {
  const { slug } = params;
  const supabase = db();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  // Increment view count
  await supabase.from('blog_posts').update({ view_count: (post.view_count || 0) + 1 }).eq('id', post.id);

  // Related posts (same tags or same event)
  const { data: related } = await supabase
    .from('blog_posts')
    .select('id,slug,title,excerpt,cover_image,published_at,author_name,read_time_minutes')
    .eq('status', 'published')
    .neq('id', post.id)
    .limit(3);

  return NextResponse.json({ post, related: related || [] }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' }
  });
}

export async function PATCH(req, { params }) {
  const { slug } = params;
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: post } = await supabase.from('blog_posts').select('author_id').eq('slug', slug).maybeSingle();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  if (post.author_id !== user.id && !adminEmails.includes(user.email?.toLowerCase())) {
    return NextResponse.json({ error: 'Not your post' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const allowed = ['title', 'content', 'excerpt', 'cover_image', 'tags', 'status'];
  const updates = {};
  for (const key of allowed) { if (body[key] !== undefined) updates[key] = body[key]; }
  if (updates.status === 'published') updates.published_at = new Date().toISOString();

  const { data: updated, error } = await supabase.from('blog_posts').update(updates).eq('slug', slug).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: updated });
}

export async function DELETE(req, { params }) {
  const { slug } = params;
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: post } = await supabase.from('blog_posts').select('author_id').eq('slug', slug).maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  if (post.author_id !== user.id && !adminEmails.includes(user.email?.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await supabase.from('blog_posts').delete().eq('slug', slug);
  return NextResponse.json({ ok: true });
}
