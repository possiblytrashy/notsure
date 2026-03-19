// Event Afterglow — the unique feature
// After an event, organizers "drop" photos, videos, messages into every attendee's ticket.
// The ticket in the user's vault transforms into a living memory artifact.
// This is the world's first ticketing platform with built-in event memory drops.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

// POST /api/afterglow/drop — organizer drops content
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { event_id, organizer_id, type, content, caption, thumbnail_url } = body;
  // type: 'photo' | 'video' | 'message' | 'highlight_reel'

  if (!event_id || !organizer_id || !type || !content) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = db();

  // Verify organizer owns this event
  const { data: ev } = await supabase
    .from('events')
    .select('title,organizer_id,date')
    .eq('id', event_id)
    .maybeSingle();

  if (!ev || ev.organizer_id !== organizer_id) {
    return NextResponse.json({ error: 'Unauthorized — not your event' }, { status: 403 });
  }

  // Insert afterglow drop
  const { data: drop, error } = await supabase
    .from('afterglow_drops')
    .insert({
      event_id,
      organizer_id,
      type,           // 'photo' | 'video' | 'message' | 'highlight_reel'
      content,        // URL for media, text for messages
      caption: caption || null,
      thumbnail_url: thumbnail_url || null,
      is_published: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count attendees who will receive this drop
  const { count: attendeeCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id)
    .eq('status', 'valid');

  // Notify attendees by email (first drop only, to announce the feature)
  if (process.env.RESEND_API_KEY) {
    const { count: dropCount } = await supabase
      .from('afterglow_drops')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id);

    // Only send notification email for the very first drop per event
    if (dropCount === 1) {
      const { data: attendees } = await supabase
        .from('tickets')
        .select('guest_email,guest_name')
        .eq('event_id', event_id)
        .eq('status', 'valid');

      const uniqueEmails = [...new Map((attendees || []).map(a => [a.guest_email, a])).values()];

      // Send in batches of 10 to avoid rate limits
      for (let i = 0; i < Math.min(uniqueEmails.length, 500); i += 10) {
        const batch = uniqueEmails.slice(i, i + 10);
        await Promise.all(batch.map(a =>
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'OUSTED <afterglow@ousted.live>',
              to: [a.guest_email],
              subject: `✨ ${ev.title} — your event memories have arrived`,
              html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050505;color:#fff;border-radius:24px">
                <h1 style="font-size:26px;font-weight:900;margin:0 0 6px;letter-spacing:-1px">Your memories are here ✨</h1>
                <p style="color:#888;margin:0 0 20px;font-size:14px">The organizer of <strong style="color:#fff">${ev.title}</strong> dropped post-event memories into your ticket.</p>
                <div style="background:linear-gradient(135deg,#1a1200,#2a1e00);border:1px solid rgba(205,164,52,.25);border-radius:18px;padding:20px;margin-bottom:24px">
                  <p style="margin:0 0 6px;font-size:13px;color:#CDA434;font-weight:700;letter-spacing:1px">EVENT AFTERGLOW</p>
                  <p style="margin:0;font-size:15px;color:#fff">Open your ticket vault to relive the night — photos, videos, and a message from the team.</p>
                </div>
                <a href="${SITE_URL}/dashboard/user" style="display:block;background:linear-gradient(135deg,#CDA434,#7a5c1e);color:#000;text-decoration:none;padding:16px;border-radius:14px;text-align:center;font-weight:900;font-size:15px">
                  VIEW MY MEMORIES →
                </a>
              </div>`,
            }),
          }).catch(() => {})
        ));
        if (i + 10 < uniqueEmails.length) await new Promise(r => setTimeout(r, 200)); // rate limit buffer
      }
    }
  }

  return NextResponse.json({ ok: true, drop_id: drop.id, attendees_reached: attendeeCount || 0 });
}
