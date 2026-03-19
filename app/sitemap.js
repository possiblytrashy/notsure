// app/sitemap.js — dynamically generated sitemap.xml
// Google will fetch this at /sitemap.xml

import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export default async function sitemap() {
  // Static pages
  const staticPages = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/voting`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/tickets/find`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/legal/user-agreement`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ];

  // Dynamic event pages
  let eventPages = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: events } = await supabase
      .from('events')
      .select('id,updated_at,date')
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('date', { ascending: true })
      .limit(1000);

    eventPages = (events || []).map(ev => {
      const eventDate = ev.date ? new Date(ev.date) : new Date();
      const isPast = eventDate < new Date();
      return {
        url: `${SITE_URL}/events/${ev.id}`,
        lastModified: ev.updated_at ? new Date(ev.updated_at) : new Date(),
        changeFrequency: isPast ? 'yearly' : 'daily',
        priority: isPast ? 0.4 : 0.8,
      };
    });
  } catch {}

  // Blog post pages
  let blogPages = [];
  try {
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug,updated_at,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(500);
    blogPages = (posts || []).map(p => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }));
  } catch {}

  return [...staticPages, ...eventPages, ...blogPages];
}
