// SERVER COMPONENT — home page SEO wrapper
import { createClient } from '@supabase/supabase-js';
import HomeClient from './HomeClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export const metadata = {
  title: 'OUSTED — Buy Event Tickets Online',
  description: 'Discover and buy tickets for concerts, parties, festivals and competitions near you. Instant delivery, secured by Paystack. Earn 10% as a reseller.',
  keywords: ['event tickets', 'buy tickets online', 'concerts', 'parties', 'festivals', 'Ghana events', 'Paystack tickets', 'event ticketing platform', 'sell tickets', 'reseller tickets'],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'OUSTED — Buy Event Tickets Online',
    description: 'Discover concerts, parties & competitions. Buy tickets instantly, secured by Paystack.',
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: 'OUSTED — Event Ticketing' }],
  },
};

async function getUpcomingEvents() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('events')
      .select('id,title,date,location,image_url,ticket_tiers(price)')
      .eq('status', 'active')
      .eq('is_deleted', false)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(20);
    return data || [];
  } catch { return []; }
}

export default async function HomePage() {
  const events = await getUpcomingEvents();

  // ItemList schema — helps Google show event cards in search results
  const itemListSchema = events.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Upcoming Events on OUSTED',
    description: 'Buy tickets for the best upcoming events',
    url: SITE_URL,
    numberOfItems: events.length,
    itemListElement: events.map((ev, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/events/${ev.id}`,
      name: ev.title,
    })),
  } : null;

  // FAQ schema — drives rich FAQ results in Google
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I buy event tickets on OUSTED?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Browse events on the OUSTED homepage, select your ticket tier, enter your name and email, and pay securely via Paystack. Your ticket arrives instantly by email.'
        }
      },
      {
        '@type': 'Question',
        name: 'Is OUSTED secure?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All payments are processed by Paystack, a leading African payment gateway. Tickets use cryptographically signed QR codes that cannot be forged.'
        }
      },
      {
        '@type': 'Question',
        name: 'Can I resell tickets on OUSTED?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Sign up as a reseller, generate your unique link for any event, and earn 10% commission on every ticket sold through your link. No cap.'
        }
      },
      {
        '@type': 'Question',
        name: 'How do I get my ticket after purchase?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Tickets appear instantly in your OUSTED dashboard under My Tickets. You can also look up your ticket by email using the Find My Ticket feature.'
        }
      },
      {
        '@type': 'Question',
        name: 'How do I host an event on OUSTED?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Create an account, complete organizer onboarding with your mobile money or bank account, then create your event and set your own ticket prices. OUSTED adds a 5% platform fee on top — you keep 100% of your set price.'
        }
      }
    ]
  };

  return (
    <>
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomeClient />
    </>
  );
}
