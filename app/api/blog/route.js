// Blog post API — organizers write event-related posts
// GET = list posts, POST = create (organizer/admin only)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 80);
}

// GET — list published posts (public)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get('tag');
  const author = searchParams.get('author_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  const supabase = db();
  let query = supabase
    .from('blog_posts')
    .select('id,slug,title,excerpt,cover_image,published_at,author_id,author_name,tags,event_id,read_time_minutes')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tag) query = query.contains('tags', [tag]);
  if (author) query = query.eq('author_id', author);

  const { data: posts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: posts || [] }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
  });
}

// POST — create a new post (organizer or admin)
export async function POST(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Must be organizer or admin
  const { data: profile } = await supabase.from('profiles').select('role,business_name').eq('id', user.id).maybeSingle();
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const canPost = ['organizer', 'admin'].includes(profile?.role) || adminEmails.includes(user.email?.toLowerCase());
  if (!canPost) return NextResponse.json({ error: 'Only organizers and admins can publish posts' }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, content, excerpt, cover_image, tags, event_id, status = 'draft' } = body;
  if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 });

  const baseSlug = slugify(title);
  // Ensure unique slug
  const { data: existing } = await supabase.from('blog_posts').select('slug').like('slug', `${baseSlug}%`);
  const slugExists = (existing || []).map(e => e.slug);
  let slug = baseSlug;
  let i = 1;
  while (slugExists.includes(slug)) { slug = `${baseSlug}-${i++}`; }

  // Estimate read time (avg 200 words/min)
  const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  const { data: post, error } = await supabase.from('blog_posts').insert({
    slug,
    title,
    content,
    excerpt: excerpt || content.replace(/<[^>]+>/g, '').substring(0, 160),
    cover_image: cover_image || null,
    tags: tags || [],
    event_id: event_id || null,
    author_id: user.id,
    author_name: profile?.business_name || user.email?.split('@')[0] || 'OUSTED',
    status,
    published_at: status === 'published' ? new Date().toISOString() : null,
    read_time_minutes: readTime,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post }, { status: 201 });
}
