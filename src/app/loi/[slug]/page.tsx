import type { Metadata } from 'next'
import LawDetailPage from '@/components/law-details/LawDetail'
import { getTextBySlug } from '@/lib/api/endpoints'

const SITE = 'https://lexhaiti.org'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const text = await getTextBySlug(slug)
    const title = text.title_fr ?? slug
    const description =
      text.description_fr ??
      `Texte juridique haïtien : ${title}`
    const url = `${SITE}/loi/${slug}`
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'article',
        title,
        description,
        url,
        siteName: 'LexHaiti',
        locale: 'fr_FR',
      },
      twitter: { card: 'summary_large_image', title, description },
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
