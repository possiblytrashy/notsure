// FILE: app/api/social-proof/route.js
// Real-time social proof signals for psychological conversion
// Returns: viewer counts, recent purchases, scarcity data

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// In-memory viewer tracking (use Redis for multi-instance production)
const viewerMap = new Map(); // eventId -> Set of session tokens
const VIEWER_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Cleanup old sessions periodically
function cleanupViewers() {
  const now = Date.now();
  for (const [eventId, sessions] of viewerMap) {
    for (const [token, timestamp] of sessions) {
      if (now - timestamp > VIEWER_TIMEOUT) sessions.delete(token);
    }
    if (sessions.size === 0) viewerMap.delete(eventId);
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('event_id');
  const sessionToken = url.searchParams.get('session');

  if (!eventId) {
    return NextResponse.json({ error: 'event_id required' }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Track this viewer
    if (sessionToken) {
      if (!viewerMap.has(eventId)) viewerMap.set(eventId, new Map());
      viewerMap.get(eventId).set(sessionToken, Date.now());
    }
    cleanupViewers();
    const liveViewers = viewerMap.get(eventId)?.size || 1;

    // Add slight randomization for better psychology (within ±20%)
    const displayViewers = Math.max(1, liveViewers + Math.floor(Math.random() * Math.ceil(liveViewers * 0.2)));

    // Fetch recent ticket purchases (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentTickets } = await supabase
      .from('tickets')
      .select('guest_name, tier_name, created_at')
      .eq('event_id', eventId)
      .eq('status', 'valid')
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    // Fetch total sold vs capacity per tier
    const { data: tiers } = await supabase
      .from('ticket_tiers')
      .select('id, name, max_quantity, price')
      .eq('event_id', eventId);

    const { data: soldCounts } = await supabase
      .from('tickets')
      .select('tier_id')
      .eq('event_id', eventId)
      .eq('status', 'valid');

    const soldByTier = {};
    soldCounts?.forEach(t => {
      soldByTier[t.tier_id] = (soldByTier[t.tier_id] || 0) + 1;
    });

    const tierScarcity = tiers?.map(t => ({
      id: t.id,
      name: t.name,
      sold: soldByTier[t.id] || 0,
      max: t.max_quantity,
      remaining: t.max_quantity > 0 ? Math.max(0, t.max_quantity - (soldByTier[t.id] || 0)) : null,
      percentSold: t.max_quantity > 0 ? Math.round(((soldByTier[t.id] || 0) / t.max_quantity) * 100) : 0
    }));

    // Anonymize names for privacy (show "John B." style)
    const anonymizeRecent = (tickets) => tickets?.map(t => {
      const nameParts = (t.guest_name || 'Someone').trim().split(' ');
      const first = nameParts[0];
      const lastInitial = nameParts.length > 1 ? ` ${nameParts[nameParts.length - 1][0]}.` : '';
      const minutesAgo = Math.round((Date.now() - new Date(t.created_at).getTime()) / 60000);
      return {
        name: `${first}${lastInitial}`,
        tier: t.tier_name,
        minutesAgo: Math.max(1, minutesAgo)
      };
    }) || [];

    // Total purchases in last hour (for urgency)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .gte('created_at', oneHourAgo);

    return NextResponse.json({
      liveViewers: displayViewers,
      recentPurchases: anonymizeRecent(recentTickets),
      tierScarcity: tierScarcity || [],
      hourlyPurchases: hourlyCount || 0,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });

  } catch (err) {
    console.error('Social proof error:', err);
    return NextResponse.json({ liveViewers: 1, recentPurchases: [], tierScarcity: [], hourlyPurchases: 0 });
  }
}
