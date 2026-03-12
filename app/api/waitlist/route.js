// FILE: app/api/waitlist/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { event_id, tier_id, email, name } = body;

    if (!event_id || !tier_id || !email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Valid event_id, tier_id, and email are required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Check if already on waitlist
    const { data: existing } = await supabase
      .from('waitlist')
      .select('id, position')
      .eq('event_id', event_id)
      .eq('tier_id', tier_id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        position: existing.position,
        message: 'Already on waitlist',
        alreadyOnList: true
      });
    }

    // Get current waitlist count for position
    const { count } = await supabase
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .eq('tier_id', tier_id);

    const position = (count || 0) + 1;

    const { error } = await supabase.from('waitlist').insert({
      event_id, tier_id,
      email: normalizedEmail,
      name: (name || 'Guest').substring(0, 100),
      position,
      created_at: new Date().toISOString()
    });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      position,
      message: `You're #${position} on the waitlist. We'll email you if a spot opens.`
    });

  } catch (err) {
    console.error('Waitlist error:', err);
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const event_id = url.searchParams.get('event_id');
  const tier_id = url.searchParams.get('tier_id');
  const email = url.searchParams.get('email');

  if (!event_id || !email) {
    return NextResponse.json({ error: 'event_id and email required' }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const query = supabase
      .from('waitlist')
      .select('position, created_at')
      .eq('event_id', event_id)
      .eq('email', email.toLowerCase().trim());

    if (tier_id) query.eq('tier_id', tier_id);

    const { data } = await query.maybeSingle();

    return NextResponse.json({ 
      onWaitlist: !!data, 
      position: data?.position || null 
    });

  } catch (err) {
    return NextResponse.json({ onWaitlist: false });
  }
}
