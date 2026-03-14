// /api/og?id={eventId} — generates a beautiful 1200×630 OG image for each event
// Used by og:image tags so every shared link gets a custom preview card
// Works on Vercel Edge runtime (no Node dependencies)

import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('id');

  let event = null;

  if (eventId) {
    try {
      // Edge-compatible Supabase fetch (no SDK, raw REST)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=title,date,location,image_url,description&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        }
      });
      const data = await res.json();
      event = data?.[0] || null;
    } catch {}
  }

  const title = event?.title || 'Discover Amazing Events';
  const date = event?.date
    ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const location = event?.location || null;
  const hasImage = !!event?.image_url;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: '#050505',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background image blurred if available */}
        {hasImage && (
          <img
            src={event.image_url}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 0.25, filter: 'blur(4px)',
            }}
          />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: hasImage
            ? 'linear-gradient(160deg, rgba(5,5,5,0.5) 0%, rgba(5,5,5,0.95) 60%)'
            : 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        }} />

        {/* Gold accent line top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'linear-gradient(90deg,#CDA434,#ffd700,#CDA434)' }} />

        {/* Content */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', padding: '60px 72px' }}>

          {/* Logo + badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', letterSpacing: '-2px' }}>OUSTED</span>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#CDA434' }}>.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(205,164,52,0.15)', border: '1px solid rgba(205,164,52,0.4)', borderRadius: 40, padding: '8px 20px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#CDA434', letterSpacing: '2px' }}>GET TICKETS</span>
            </div>
          </div>

          {/* Main event image (right side, if available) */}
          {hasImage && (
            <img
              src={event.image_url}
              style={{
                position: 'absolute', right: 60, top: '50%',
                transform: 'translateY(-50%)',
                width: 380, height: 380,
                objectFit: 'cover',
                borderRadius: 28,
                boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
                border: '2px solid rgba(205,164,52,0.3)',
              }}
            />
          )}

          {/* Event details */}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: hasImage ? 620 : 900 }}>
            {/* Tier/type badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ background: 'rgba(205,164,52,0.15)', border: '1px solid rgba(205,164,52,0.3)', borderRadius: 8, padding: '4px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#CDA434', letterSpacing: '2px' }}>🎟 LIVE EVENT</span>
              </div>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: title.length > 40 ? 52 : title.length > 25 ? 64 : 76,
              fontWeight: 900,
              color: '#ffffff',
              margin: '0 0 24px',
              lineHeight: 1.05,
              letterSpacing: '-2px',
            }}>
              {title}
            </h1>

            {/* Meta info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📅</span>
                  <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{date}</span>
                </div>
              )}
              {location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>📍</span>
                  <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>{location}</span>
                </div>
              )}
            </div>

            {/* CTA bar */}
            <div style={{
              marginTop: 36, display: 'flex', alignItems: 'center', gap: 16,
              background: 'linear-gradient(135deg,#CDA434,#a07820)',
              borderRadius: 18, padding: '18px 28px', width: 'fit-content'
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#000', letterSpacing: '-0.5px' }}>Buy Tickets Now</span>
              <span style={{ fontSize: 20, color: '#000' }}>→</span>
            </div>
          </div>

          {/* Domain watermark */}
          <div style={{ position: 'absolute', bottom: 32, right: 72, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '1px' }}>ousted.live</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' },
    }
  );
}
