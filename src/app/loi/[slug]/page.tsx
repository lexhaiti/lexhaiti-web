import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LawDetailPage from '@/components/law-details/LawDetail'
import { getTextBySlug, type LegalTextRead } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/client'
import { breadcrumbJsonLd, legislationJsonLd } from '@/lib/harvest/jsonld'
import { JsonLd } from '@/components/seo/JsonLd'

const SITE = 'https://www.lexhaiti.org'

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
    // Transient/backend error → keep a self-referential canonical so the page
    // never inherits the site-root canonical. A genuine 404 is turned into a
    // real 404 by the route layout's existence gate (layout.tsx, which runs
    // above loading.tsx); this catch only needs to cover the canonical.
    return { alternates: { canonical: `${SITE}/loi/${slug}` } }
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  // Fetch the FULL text server-side (include=all → headings + articles) and
  // seed the client reader with it. This puts the actual legal text in the
  // server-rendered HTML so Google indexes the corpus body — not just the
  // title/metadata — and removes the skeleton flash. (ADR-004 Stage 1.)
  let text: LegalTextRead
  try {
    text = await getTextBySlug(slug, 'all')
  } catch (err) {
    // A genuine 404 → return a real Next 404 instead of a soft-404 (HTTP 200
    // with "Page introuvable" content, which Google flags and keeps crawling).
    // A transient/backend error must NOT 404 — rethrow so Next renders the
    // error boundary and Google doesn't de-index a real page over a hiccup.
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }
  const jsonLd = legislationJsonLd(text)
  const crumbs = breadcrumbJsonLd([
    { name: 'Accueil', url: SITE },
    { name: 'Lois', url: `${SITE}/lois` },
    { name: text.title_fr ?? slug, url: `${SITE}/loi/${slug}` },
  ])
  return (
    <>
      <JsonLd graph={jsonLd} />
      <JsonLd graph={crumbs} />
      <LawDetailPage key={slug} initialData={text} />
    </>
  )
}
