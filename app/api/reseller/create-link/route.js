// FILE: app/api/reseller/create-link/route.js
// NEW FILE - Allows organizers to create reseller links for their events

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const { event_id, reseller_email } = await req.json();

    if (!event_id || !reseller_email) {
      return NextResponse.json({ 
        error: 'Event ID and reseller email required' 
      }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Get current user (organizer)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify event belongs to organizer and allows resellers
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, allows_resellers, organizer_profile_id')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ 
        error: 'Event not found' 
      }, { status: 404 });
    }

    if (!event.allows_resellers) {
      return NextResponse.json({ 
        error: 'This event does not allow resellers' 
      }, { status: 400 });
    }

    // 3. Find reseller by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const resellerUser = users?.users?.find(u => u.email === reseller_email);

    if (!resellerUser) {
      return NextResponse.json({ 
        error: 'No user found with that email' 
      }, { status: 404 });
    }

    // 4. Get or create reseller profile
    let { data: reseller } = await supabase
      .from('resellers')
      .select('id')
      .eq('user_id', resellerUser.id)
      .single();

    if (!reseller) {
      // Create reseller profile if doesn't exist
      const { data: newReseller, error: createError } = await supabase
        .from('resellers')
        .insert({
          user_id: resellerUser.id,
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ 
          error: 'Failed to create reseller profile' 
        }, { status: 500 });
      }

      reseller = newReseller;
    }

    // 5. Generate unique code
    const uniqueCode = `${event_id.split('-')[0]}-${crypto.randomBytes(4).toString('hex')}`;

    // 6. Create event_reseller link
    const { data: link, error: linkError } = await supabase
      .from('event_resellers')
      .insert({
        reseller_id: reseller.id,
        event_id: event_id,
        unique_code: uniqueCode,
        commission_rate: 0.10 // 10%
      })
      .select()
      .single();

    if (linkError) {
      console.error('Link creation error:', linkError);
      return NextResponse.json({ 
        error: 'Failed to create reseller link' 
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
    console.error('Create reseller link error:', err);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
