// Single blog post — server component with rich SEO
import { notFound } from 'next/navigation';
import BlogPostClient from './BlogPostClient';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ousted.live';

async function getPost(slug) {
  try {
    const res = await fetch(`${SITE_URL}/api/blog/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const data = await getPost(params.slug);
  if (!data?.post) return { title: 'Post Not Found', robots: { index: false } };
  const { post } = data;
  const ogImage = post.cover_image || `${SITE_URL}/og-default.png`;
  return {
    title: post.title,
    description: post.excerpt,
    keywords: [...(post.tags || []), 'OUSTED blog', 'event', 'Ghana'],
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url: `${SITE_URL}/blog/${post.slug}`,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.published_at,
      authors: [post.author_name],
      tags: post.tags || [],
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.excerpt, images: [ogImage] },
  };
}

export default async function BlogPostPage({ params }) {
  const data = await getPost(params.slug);
  if (!data?.post) notFound();

  const { post, related } = data;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image ? [post.cover_image] : [],
    datePublished: post.published_at,
    author: { '@type': 'Person', name: post.author_name },
    publisher: { '@type': 'Organization', name: 'OUSTED', url: SITE_URL },
    url: `${SITE_URL}/blog/${post.slug}`,
    keywords: (post.tags || []).join(', '),
    wordCount: post.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0,
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}/blog/${post.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <BlogPostClient post={post} related={related} />
    </>
  );
}
