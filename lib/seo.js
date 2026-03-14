// lib/seo.js — shared SEO utilities for all server components

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';
const SITE_NAME = 'OUSTED';
const DEFAULT_OG = `${SITE_URL}/og-default.png`;

/**
 * Build complete Open Graph metadata for an event
 */
export function buildEventMeta(event) {
  if (!event) return {};
  const url = `${SITE_URL}/events/${event.id}`;
  const ogImage = `${SITE_URL}/api/og?id=${event.id}`;
  const date = event.date
    ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const city = event.location?.split(',')[0]?.trim();
  const minPrice = event.ticket_tiers?.length
    ? Math.min(...event.ticket_tiers.map(t => Number(t.price)).filter(p => p > 0))
    : null;
  const organizer = event.organizers?.business_name || event.organizers?.name;

  const descParts = [
    date && `📅 ${date}`,
    event.location && `📍 ${event.location}`,
    minPrice && `🎟️ From GHS ${minPrice.toFixed(2)}`,
    organizer && `Hosted by ${organizer}`,
    event.description?.substring(0, 100),
  ].filter(Boolean);
  const description = descParts.join(' · ') || `Get tickets for ${event.title} on OUSTED.`;

  return {
    title: [event.title, city].filter(Boolean).join(' — '),
    description,
    keywords: [event.title, city, event.location, organizer, 'event tickets', 'buy tickets', SITE_NAME].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      type: 'website', url, siteName: SITE_NAME,
      title: `${event.title} — Get Tickets`,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${event.title} — ${event.location || 'Event'}` }],
    },
    twitter: {
      card: 'summary_large_image', site: '@oustedlive',
      title: `${event.title} — Get Tickets on OUSTED`,
      description, images: [ogImage],
    },
  };
}

/**
 * Build Event schema.org JSON-LD for a single event
 */
export function buildEventSchema(event) {
  if (!event) return null;
  const url = `${SITE_URL}/events/${event.id}`;
  const minPrice = event.ticket_tiers?.length
    ? Math.min(...event.ticket_tiers.map(t => Number(t.price)).filter(p => p > 0))
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || `Get tickets for ${event.title}`,
    url,
    image: [event.image_url, ...(event.images || [])].filter(Boolean),
    startDate: event.date ? `${event.date}${event.time ? 'T' + event.time : ''}` : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: event.location ? {
      '@type': 'Place',
      name: event.location,
      geo: event.lat && event.lng
        ? { '@type': 'GeoCoordinates', latitude: event.lat, longitude: event.lng }
        : undefined,
    } : undefined,
    organizer: { '@type': 'Organization', name: event.organizers?.business_name || SITE_NAME, url: SITE_URL },
    offers: event.ticket_tiers?.length ? {
      '@type': 'AggregateOffer',
      priceCurrency: 'GHS',
      lowPrice: minPrice?.toFixed(2) || '0',
      offerCount: event.ticket_tiers.length,
      offers: event.ticket_tiers.map(tier => ({
        '@type': 'Offer',
        name: tier.name, price: Number(tier.price).toFixed(2),
        priceCurrency: 'GHS',
        availability: 'https://schema.org/InStock',
        url, seller: { '@type': 'Organization', name: SITE_NAME },
      })),
    } : undefined,
  };
}

/**
 * Build BreadcrumbList schema
 */
export function buildBreadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.name,
        item: item.url,
      })),
    ],
  };
}

/**
 * Truncate and clean text for meta descriptions (≤155 chars optimal)
 */
export function metaDesc(text, max = 155) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.substring(0, max - 1) + '…';
}

export { SITE_URL, SITE_NAME, DEFAULT_OG };
