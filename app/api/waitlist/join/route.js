// Waitlist — join and notification system
// POST /api/waitlist/join — add to waitlist for a sold-out tier
// GET /api/waitlist/join?event_id=&tier_id= — check position

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const { event_id, tier_id, email, name } = body;
  if (!event_id || !email) return NextResponse.json({ error: 'event_id and email required' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });

  const supabase = db();

  // Check if they already have a ticket
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('event_id', event_id)
    .eq('guest_email', email.toLowerCase())
    .eq('status', 'valid')
    .limit(1);
  if (existingTicket?.length) return NextResponse.json({ error: 'You already have a ticket for this event' }, { status: 409 });

  // Check if already on waitlist
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id,position')
    .eq('event_id', event_id)
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, position: existing.position, already_joined: true, message: `You're already on the waitlist at position #${existing.position}` });

  // Get next position
  const { count } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id)
    .eq(tier_id ? 'tier_id' : 'id', tier_id || 'dummy');

  // Get overall position for this event
  const { count: totalCount } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event_id);

  const position = (totalCount || 0) + 1;

  const { error } = await supabase.from('waitlist').insert({
    event_id,
    tier_id: tier_id || null,
    email: email.toLowerCase(),
    name: name || null,
    position,
    notified: false,
  });

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already on waitlist' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send confirmation email
  if (process.env.RESEND_API_KEY) {
    const { data: ev } = await supabase.from('events').select('title,date,location').eq('id', event_id).maybeSingle();
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OUSTED <tickets@ousted.live>',
        to: [email],
        subject: `You're on the waitlist for ${ev?.title || 'the event'} — #${position}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050505;color:#fff;border-radius:24px">
          <h1 style="font-size:24px;font-weight:900;margin:0 0 8px">You're on the waitlist! ⏳</h1>
          <p style="color:#999;margin:0 0 20px">We'll email you immediately if a spot opens up.</p>
          <div style="background:#111;border-radius:16px;padding:20px;margin-bottom:20px;border:1px solid rgba(255,255,255,.08)">
            <p style="margin:0 0 6px;font-size:18px;font-weight:900">${ev?.title || 'Event'}</p>
            <p style="margin:0;color:#888;font-size:13px">Your position: <strong style="color:#CDA434">#${position}</strong></p>
          </div>
          <p style="color:#555;font-size:12px">We'll notify you by email if tickets become available. Spots are first-come-first-served.</p>
        </div>`,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, position, message: `You're #${position} on the waitlist. We'll email you if a spot opens up.` });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get('event_id');
  const email = searchParams.get('email');
  if (!event_id || !email) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const supabase = db();
  const { data } = await supabase
    .from('waitlist')
    .select('position,notified,created_at')
    .eq('event_id', event_id)
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!data) return NextResponse.json({ on_waitlist: false });
  return NextResponse.json({ on_waitlist: true, position: data.position, notified: data.notified });
}
