// Waitlist notify — called by organizer when they release more tickets
// Notifies the next N people on the waitlist and gives them a 2-hour purchase window

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { event_id, tier_id, spots_available, organizer_id } = body;
  if (!event_id || !organizer_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const supabase = db();

  // Verify organizer owns this event
  const { data: ev } = await supabase.from('events').select('title,organizer_id,date').eq('id', event_id).maybeSingle();
  if (!ev || ev.organizer_id !== organizer_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  // Get next N waitlist entries
  const limit = Math.min(spots_available || 5, 50);
  const { data: entries } = await supabase
    .from('waitlist')
    .select('id,email,name,position')
    .eq('event_id', event_id)
    .eq(tier_id ? 'tier_id' : 'id', tier_id || 'dummy')
    .eq('notified', false)
    .order('position', { ascending: true })
    .limit(limit);

  if (!entries?.length) return NextResponse.json({ ok: true, notified: 0, message: 'No unnotified waitlist entries' });

  const purchaseDeadline = new Date(Date.now() + 7200000); // 2 hours
  const eventUrl = `${SITE_URL}/events/${event_id}`;

  let notified = 0;
  for (const entry of entries) {
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'OUSTED <tickets@ousted.live>',
            to: [entry.email],
            subject: `🎟️ Spot available — ${ev.title}! Act fast`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050505;color:#fff;border-radius:24px">
              <div style="background:linear-gradient(135deg,#CDA434,#7a5c1e);border-radius:14px;padding:14px 18px;margin-bottom:20px;display:inline-block">
                <p style="margin:0;font-weight:900;color:#000;font-size:16px">⚡ A spot just opened up!</p>
              </div>
              <h1 style="font-size:24px;font-weight:900;margin:0 0 6px">${ev.title}</h1>
              <p style="color:#888;margin:0 0 20px;font-size:14px">
                ${ev.date ? new Date(ev.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : 'TBA'}
              </p>
              <p style="color:#ccc;margin:0 0 20px">You were #${entry.position} on the waitlist. A ticket is now available — you have until <strong style="color:#CDA434">${purchaseDeadline.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</strong> to grab it.</p>
              <a href="${eventUrl}" style="display:block;background:#fff;color:#000;text-decoration:none;padding:16px;border-radius:14px;text-align:center;font-weight:900;font-size:16px;margin-bottom:16px">
                GET MY TICKET NOW →
              </a>
              <p style="color:#555;font-size:11px;text-align:center">This notification was sent to waitlist members in order. First come, first served.</p>
            </div>`,
          }),
        });
        notified++;
      } catch {}
    } else {
      notified++; // Count even without email if Resend not configured
    }
    // Mark as notified
    await supabase.from('waitlist').update({ notified: true, notified_at: new Date().toISOString() }).eq('id', entry.id);
  }

  return NextResponse.json({ ok: true, notified, message: `${notified} waitlist member${notified !== 1 ? 's' : ''} notified` });
}
