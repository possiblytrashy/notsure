// SERVER COMPONENT — voting page SEO wrapper
import { createClient } from '@supabase/supabase-js';
import VotingClient from './VotingClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export const metadata = {
  title: 'Vote Now — OUSTED Competitions',
  description: 'Cast your votes for your favourite candidates in live competitions. Real-time leaderboards, transparent results, secured by Paystack.',
  keywords: ['online voting', 'vote for candidates', 'competition voting', 'vote Ghana', 'live voting', 'real-time leaderboard', 'talent competition voting'],
  alternates: { canonical: `${SITE_URL}/voting` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/voting`,
    title: 'Vote Now — OUSTED Competitions',
    description: 'Live competitions with real-time leaderboards. Vote for your favourite and watch the results update instantly.',
    images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: 'OUSTED Live Voting' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vote Now — OUSTED Competitions',
    description: 'Live competitions. Real-time leaderboards. Cast your vote now.',
    images: [`${SITE_URL}/og-default.png`],
  },
};

async function getCompetitions() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('competitions')
      .select('id,title,description,contests(id,title,candidates(id,name,vote_count))')
      .eq('is_active', true)
      .limit(10);
    return data || [];
  } catch { return []; }
}

export default async function VotingPage() {
  const competitions = await getCompetitions();

  // ── ItemList — competitions listed for Google ─────────────────
  const competitionListSchema = competitions.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Live Competitions on OUSTED',
    url: `${SITE_URL}/voting`,
    numberOfItems: competitions.length,
    itemListElement: competitions.map((comp, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: comp.title,
      url: `${SITE_URL}/voting`,
    })),
  } : null;

  // ── For each competition, output a standalone event schema ────
  const competitionSchemas = competitions.map(comp => {
    // Find total votes across all contests
    const allCandidates = comp.contests?.flatMap(c => c.candidates || []) || [];
    const totalVotes = allCandidates.reduce((sum, c) => sum + (c.vote_count || 0), 0);
    const leaders = [...allCandidates].sort((a, b) => b.vote_count - a.vote_count).slice(0, 3);

    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: comp.title,
      description: comp.description || `Vote for your favourite in ${comp.title}`,
      url: `${SITE_URL}/voting`,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: { '@type': 'VirtualLocation', url: `${SITE_URL}/voting` },
      organizer: { '@type': 'Organization', name: 'OUSTED', url: SITE_URL },
      ...(leaders.length > 0 && {
        about: leaders.map(l => ({ '@type': 'Person', name: l.name })),
      }),
    };
  });

  // ── BreadcrumbList ────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Voting', item: `${SITE_URL}/voting` },
    ],
  };

  return (
    <>
      {competitionListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(competitionListSchema) }}
        />
      )}
      {competitionSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <VotingClient />
    </>
  );
}
