// app/feed.xml/route.js — serves /feed.xml RSS for events
// Helps Google News, aggregators, and RSS readers discover events
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let events = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('events')
      .select('id,title,description,date,time,location,image_url,created_at,ticket_tiers(name,price)')
      .eq('status', 'active')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);
    events = data || [];
  } catch {}

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>OUSTED — Upcoming Events</title>
    <link>${SITE_URL}</link>
    <description>Buy tickets for the best events. Concerts, parties, competitions — secured by Paystack.</description>
    <language>en-gh</language>
    <copyright>© ${new Date().getFullYear()} OUSTED</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/icon-512.png</url>
      <title>OUSTED</title>
      <link>${SITE_URL}</link>
    </image>
    ${events.map(ev => {
      const eventUrl = `${SITE_URL}/events/${ev.id}`;
      const minPrice = ev.ticket_tiers?.length
        ? Math.min(...ev.ticket_tiers.map(t => Number(t.price)).filter(p => p > 0))
        : null;
      const description = [
        ev.description?.substring(0, 200),
        ev.date ? `📅 ${new Date(ev.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}` : null,
        ev.location ? `📍 ${ev.location}` : null,
        minPrice ? `🎟️ From GHS ${minPrice.toFixed(2)}` : null,
      ].filter(Boolean).join(' · ');

      return `
    <item>
      <title>${escapeXml(ev.title)}</title>
      <link>${eventUrl}</link>
      <guid isPermaLink="true">${eventUrl}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${new Date(ev.created_at || Date.now()).toUTCString()}</pubDate>
      ${ev.image_url ? `<media:content url="${escapeXml(ev.image_url)}" medium="image"/>` : ''}
      ${ev.image_url ? `<media:thumbnail url="${escapeXml(ev.image_url)}"/>` : ''}
      <content:encoded><![CDATA[
        <h2>${escapeXml(ev.title)}</h2>
        ${ev.image_url ? `<img src="${ev.image_url}" alt="${escapeXml(ev.title)}" style="max-width:100%">` : ''}
        <p>${escapeXml(description)}</p>
        <p><a href="${eventUrl}">Get tickets on OUSTED →</a></p>
      ]]></content:encoded>
    </item>`;
    }).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
