import CompareClient from './CompareClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export const metadata = {
  title: 'How OUSTED Compares to Other Ticketing Platforms',
  description: 'See how OUSTED stacks up against other event ticketing platforms — revenue, fees, security, features, and more.',
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title: 'OUSTED vs Other Ticketing Platforms',
    description: 'Organizers keep 100% of their set price. Built-in reseller network. Cryptographically signed tickets. See the full comparison.',
    url: `${SITE_URL}/compare`,
  },
};

export default function ComparePage() {
  return <CompareClient />;
}
