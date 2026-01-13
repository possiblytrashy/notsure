// FILE: app/api/reseller/create-my-link/route.js
// NEW FILE - Allows resellers to create their own links

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return NextResponse.json({ 
        error: 'Event ID required' 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get reseller profile
    const { data: reseller, error: resellerError } = await supabase
      .from('resellers')
      .select('id, is_active')
      .eq('user_id', user.id)
      .single();

    if (resellerError || !reseller) {
      return NextResponse.json({ 
        error: 'Reseller profile not found. Please complete onboarding first.' 
      }, { status: 404 });
    }

    if (!reseller.is_active) {
      return NextResponse.json({ 
        error: 'Your reseller account is inactive' 
      }, { status: 403 });
    }

    // Verify event exists and allows resellers
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, allows_resellers')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ 
        error: 'Event not found' 
      }, { status: 404 });
    }

    if (!event.allows_resellers) {
      return NextResponse.json({ 
        error: 'This event does not allow reseller links' 
      }, { status: 400 });
    }

    // Check if link already exists for this reseller-event combo
    const { data: existing } = await supabase
      .from('event_resellers')
      .select('id, unique_code')
      .eq('reseller_id', reseller.id)
      .eq('event_id', event_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ 
        error: 'You already have a link for this event',
        link: existing 
      }, { status: 400 });
    }

    // Generate unique code
    const uniqueCode = `${event_id.split('-')[0]}-${crypto.randomBytes(4).toString('hex')}`;

    // Create event_reseller link
    const { data: link, error: linkError } = await supabase
      .from('event_resellers')
      .insert({
        reseller_id: reseller.id,
        event_id: event_id,
        unique_code: uniqueCode,
        commission_rate: 0.10
      })
      .select()
      .single();

    if (linkError) {
      console.error('Link creation error:', linkError);
      return NextResponse.json({ 
        error: 'Failed to create link' 
      }, { status: 500 });
    }

    console.log('✅ Reseller link created:', uniqueCode);

    return NextResponse.json({ 
      success: true,
      link: {
        id: link.id,
        unique_code: uniqueCode,
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/events/${event_id}?ref=${uniqueCode}`
      }
    });

  } catch (err) {
    console.error('Create link error:', err);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
