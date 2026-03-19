// GET /api/afterglow/[eventId] — fetch all afterglow drops for an event
// Called by the user's ticket card to display memories

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req, { params }) {
  const eventId = params.eventId;
  if (!eventId) return NextResponse.json({ drops: [] });

  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email'); // optional — verify attendee

  const supabase = db();

  // If email provided, verify they attended
  if (email) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .eq('event_id', eventId)
      .eq('guest_email', email.toLowerCase())
      .eq('status', 'valid')
      .limit(1);
    if (!ticket?.length) return NextResponse.json({ drops: [], error: 'Not an attendee' });
  }

  const { data: drops } = await supabase
    .from('afterglow_drops')
    .select('id,type,content,caption,thumbnail_url,created_at')
    .eq('event_id', eventId)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  return NextResponse.json({ drops: drops || [] }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
  });
}
