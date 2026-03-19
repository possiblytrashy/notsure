// Blog listing — server component with metadata
import BlogClient from './BlogClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

export const metadata = {
  title: 'Blog — Events, Stories & Insights',
  description: 'Stories from OUSTED organizers — event recaps, artist spotlights, tips for hosting unforgettable events, and more.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'OUSTED Blog',
    description: 'Stories, insights and event recaps from Ghana\'s premier event platform.',
    url: `${SITE_URL}/blog`,
  },
};

async function getPosts() {
  try {
    const res = await fetch(`${SITE_URL}/api/blog?limit=20`, { next: { revalidate: 60 } });
    const data = await res.json();
    return data.posts || [];
  } catch { return []; }
}

export default async function BlogPage() {
  const posts = await getPosts();

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
    ],
  };

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'OUSTED Blog',
    url: `${SITE_URL}/blog`,
    description: 'Event stories and insights from OUSTED organizers',
    blogPost: posts.slice(0, 10).map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.published_at,
      author: { '@type': 'Person', name: p.author_name },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <BlogClient initialPosts={posts} />
    </>
  );
}
