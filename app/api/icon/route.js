// Serves all PWA icons as SVG-rendered PNGs via the API
// This avoids needing binary PNG files committed to git
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const size = parseInt(searchParams.get('size') || '192');
  const bg = searchParams.get('bg') || '000000';
  const fg = searchParams.get('fg') || 'CDA434';

  return new ImageResponse(
    (
      <div style={{
        width: size, height: size,
        background: `#${bg}`,
        borderRadius: size * 0.16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'serif',
      }}>
        <span style={{
          fontSize: size * 0.62,
          fontWeight: 900,
          color: `#${fg}`,
          letterSpacing: -size * 0.04,
          lineHeight: 1,
        }}>O</span>
      </div>
    ),
    { width: size, height: size,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Type': 'image/png' } }
  );
}
