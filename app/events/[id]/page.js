// SERVER COMPONENT — generates per-event SEO metadata
// Fetches event data at request time for accurate og:image, title, description
import { createClient } from '@supabase/supabase-js';
import EventPageClient from './EventPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

async function getEvent(id) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('events')
      .select('id,title,description,date,time,location,lat,lng,image_url,images,tickets_sold,organizer_id,organizers:organizer_profile_id(name,business_name),ticket_tiers(id,name,price,max_quantity)')
      .eq('id', id)
      .single();
    return data;
  } catch { return null; }
}

function formatEventDate(dateStr) {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return null; }
}

function getMinPrice(tiers) {
  if (!tiers?.length) return null;
  const prices = tiers.map(t => Number(t.price)).filter(p => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

export async function generateMetadata({ params }) {
  const event = await getEvent(params.id);
  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'This event could not be found on OUSTED.',
      robots: { index: false },
    };
  }

  const eventUrl = `${SITE_URL}/events/${event.id}`;
  const formattedDate = formatEventDate(event.date);
  const minPrice = getMinPrice(event.ticket_tiers);
  const organizer = event.organizers?.business_name || event.organizers?.name;

  // Rich title: "Event Name — City | OUSTED"
  const city = event.location?.split(',')[0]?.trim();
  const titleParts = [event.title, city].filter(Boolean);
  const pageTitle = titleParts.join(' — ');

  // Rich description with structured info
  const descParts = [];
  if (formattedDate) descParts.push(`📅 ${formattedDate}`);
  if (event.location) descParts.push(`📍 ${event.location}`);
  if (minPrice) descParts.push(`🎟️ From GHS ${minPrice.toFixed(2)}`);
  if (organizer) descParts.push(`Hosted by ${organizer}`);
  const rawDesc = event.description?.substring(0, 120) || '';
  const description = descParts.join(' · ') + (rawDesc ? ` — ${rawDesc}` : ' — Get your tickets on OUSTED.');

  // OG image: use event image or fallback to our OG default
  const ogImage = event.image_url || event.images?.[0] || `${SITE_URL}/og-default.png`;

  // Keywords
  const keywords = [
    event.title,
    city,
    event.location,
    'event tickets',
    'buy tickets',
    formattedDate,
    organizer,
    'OUSTED tickets',
  ].filter(Boolean);

  return {
    title: pageTitle,
    description,
    keywords,
    alternates: { canonical: eventUrl },
    openGraph: {
      type: 'website',
      url: eventUrl,
      siteName: 'OUSTED',
      title: `${event.title} — Get Tickets`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${event.title} — ${event.location || 'Event'}`,
          type: 'image/jpeg',
        }
      ],
      locale: 'en_GH',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@oustedlive',
      title: `${event.title} — Get Tickets on OUSTED`,
      description,
      images: [ogImage],
    },
    other: {
      // WhatsApp / iMessage use these
      'og:price:amount': minPrice ? minPrice.toFixed(2) : undefined,
      'og:price:currency': 'GHS',
    }
  };
}

export default async function EventPage({ params }) {
  const event = await getEvent(params.id);
  const eventUrl = `${SITE_URL}/events/${params.id}`;
  const minPrice = getMinPrice(event?.ticket_tiers);
  const formattedDate = formatEventDate(event?.date);
  const organizer = event?.organizers?.business_name || event?.organizers?.name || 'OUSTED';

  // ── JSON-LD: Event Schema ─────────────────────────────────────
  const eventSchema = event ? {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || `Get tickets for ${event.title}`,
    url: eventUrl,
    image: [event.image_url || event.images?.[0]].filter(Boolean),
    startDate: event.date ? `${event.date}${event.time ? 'T' + event.time : ''}` : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: event.location ? {
      '@type': 'Place',
      name: event.location,
      geo: event.lat && event.lng ? {
        '@type': 'GeoCoordinates',
        latitude: event.lat,
        longitude: event.lng,
      } : undefined,
    } : undefined,
    organizer: {
      '@type': 'Organization',
      name: organizer,
      url: SITE_URL,
    },
    offers: event.ticket_tiers?.length ? {
      '@type': 'AggregateOffer',
      priceCurrency: 'GHS',
      lowPrice: minPrice?.toFixed(2),
      offerCount: event.ticket_tiers.length,
      offers: event.ticket_tiers.map(tier => ({
        '@type': 'Offer',
        name: tier.name,
        price: Number(tier.price).toFixed(2),
        priceCurrency: 'GHS',
        availability: 'https://schema.org/InStock',
        url: eventUrl,
        seller: { '@type': 'Organization', name: 'OUSTED' },
      })),
    } : {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'GHS',
      availability: 'https://schema.org/InStock',
      url: eventUrl,
    },
  } : null;

  // ── JSON-LD: BreadcrumbList ───────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Events', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 3, name: event?.title || 'Event', item: eventUrl },
    ],
  };

  return (
    <>
      {/* Per-page structured data */}
      {eventSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <EventPageClient />
    </>
  );
}
