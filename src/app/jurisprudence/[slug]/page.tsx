// RSC route file for a single decision. Fetches the detail server-
// side so the metadata + JSON-LD path stays clean, then hands the
// payload to the client component for the interactive bits (TOC
// scroll-spy, moyens accordion, full-text reveal). ISR-enabled so
// the second hit after a backend edit gets a coherent stale read.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getDecisionBySlug } from '@/lib/api/endpoints'
import { breadcrumbJsonLd, decisionJsonLd } from '@/lib/harvest/jsonld'
import { formatLongDate } from '@/lib/format/date'
import { getServerLanguage, getT } from '@/i18n/server'

import DecisionDetailClient from './_components/DecisionDetailClient'

const SITE = 'https://www.lexhaiti.org'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const decision = await getDecisionBySlug(slug)
    const language = await getServerLanguage()
    const t = await getT(language)
    const dateStr = formatLongDate(
      decision.decision_date,
      language,
      decision.decision_date,
    )
    const courtLabel = t(`jurisprudence.courts.${decision.court}`, {
      fallback: decision.court,
    })
    const title = `${courtLabel} — ${dateStr}`
    const description =
      (language === 'ht' ? decision.summary_ht : decision.summary_fr) ??
      decision.headnotes_fr ??
      `${courtLabel}, ${dateStr}.`
    const url = `${SITE}/jurisprudence/${slug}`
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
        locale: language === 'fr' ? 'fr_FR' : 'ht_HT',
      },
      twitter: { card: 'summary_large_image', title, description },
    }
  } catch {
    return {}
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params

  let decision
  try {
    decision = await getDecisionBySlug(slug)
  } catch {
    notFound()
  }

  // Rich schema.org + ELI JSON-LD (ADR-004 Stage 1).
  const jsonLd = decisionJsonLd(decision)
  const crumbs = breadcrumbJsonLd([
    { name: 'Accueil', url: SITE },
    { name: 'Jurisprudence', url: `${SITE}/jurisprudence` },
    { name: `${decision.court} — ${decision.decision_date}`, url: `${SITE}/jurisprudence/${slug}` },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <DecisionDetailClient decision={decision} />
    </>
  )
}
