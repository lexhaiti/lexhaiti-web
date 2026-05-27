import type { Metadata } from 'next'
import LawDetailPage from '@/components/law-details/LawDetail'
import { getTextBySlug } from '@/lib/api/endpoints'

const SITE = 'https://lexhaiti.org'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ article?: string; view?: string }>
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const { article: articleNumber } = await searchParams
  try {
    const text = await getTextBySlug(slug)
    const lawTitle = text.title_fr ?? slug
    const isArticleDeepLink = !!articleNumber

    // When the URL carries ``?article=N``, advertise the per-article
    // OG image (rendered server-side under /api/og/article/...). When
    // it doesn't, the static ``opengraph-image.tsx`` next to this
    // file is used automatically by Next.js.
    let title = lawTitle
    let description =
      text.description_fr ?? `Texte juridique haïtien : ${lawTitle}`
    let ogImageUrl: string | undefined
    let canonical = `${SITE}/loi/${slug}`

    if (isArticleDeepLink) {
      const numDisplay =
        articleNumber.toLowerCase() === 'premier' ? '1ᵉʳ' : articleNumber
      title = `Art. ${numDisplay} — ${lawTitle}`
      const article = (text.articles ?? []).find(
        (a) => String(a.number) === articleNumber,
      )
      if (article) {
        // Strip HTML for the description.
        const body = (article.content_fr ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (body) description = body.slice(0, 240).trim() + (body.length > 240 ? '…' : '')
      }
      ogImageUrl = `${SITE}/api/og/article/${slug}/${encodeURIComponent(articleNumber)}`
      // Keep the per-article URL as the canonical when someone shares a
      // deep link — preserves the share-card → page consistency.
      canonical = `${SITE}/loi/${slug}?article=${encodeURIComponent(articleNumber)}`
    }

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: 'article',
        title,
        description,
        url: canonical,
        siteName: 'LexHaiti',
        locale: 'fr_FR',
        ...(ogImageUrl
          ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] }
          : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
      },
    }
  } catch {
    return {}
  }
}

function LawJsonLd({ slug, title }: { slug: string; title: string }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: title,
    url: `${SITE}/loi/${slug}`,
    inLanguage: 'fr',
    legislationJurisdiction: 'HT',
    isPartOf: {
      '@type': 'WebSite',
      name: 'LexHaiti',
      url: SITE,
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  let title = slug.replace(/-/g, ' ')
  try {
    const text = await getTextBySlug(slug)
    title = text.title_fr ?? title
  } catch {
    // Soft fail — JSON-LD will use the slug-derived name.
  }
  return (
    <>
      <LawJsonLd slug={slug} title={title} />
      <LawDetailPage />
    </>
  )
}
