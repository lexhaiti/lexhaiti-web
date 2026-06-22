// RSC route file. Emits per-issue metadata so the browser tab + share
// previews carry the actual issue number ("Le Moniteur N° 47 — 4 juin
// 2014" instead of the default site title). The interactive viewer
// lives in the client component below.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getMoniteurIssue,
  getMoniteurIssueBySlug,
  type MoniteurIssueWithEntries,
} from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/client'
import { breadcrumbJsonLd, moniteurIssueJsonLd } from '@/lib/harvest/jsonld'
import { formatLongDate } from '@/lib/format/date'
import { smartIssueNumber } from '@/lib/format/moniteur'
import { getServerLanguage } from '@/i18n/server'
import MoniteurDetailClient from './_components/MoniteurDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

const SITE = 'https://www.lexhaiti.org'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const raw = decodeURIComponent(id)
  const isNumeric = /^\d+$/.test(raw)

  try {
    const issue = isNumeric
      ? await getMoniteurIssue(Number(raw))
      : await getMoniteurIssueBySlug(raw)
    // Canonicalise every issue onto its numeric-id URL (the form the sitemap
    // exposes), so a slug-accessed view doesn't become a duplicate of it.
    const canonical = `${SITE}/moniteur/${issue.id}`
    const language = await getServerLanguage()
    const number = smartIssueNumber(issue.number)
    const date = formatLongDate(issue.publication_date, language)
    const title = date ? `Le Moniteur ${number} — ${date}` : `Le Moniteur ${number}`
    return {
      title,
      description: issue.edition_label
        ? `${issue.edition_label} · ${title}`
        : title,
      alternates: { canonical },
      openGraph: {
        type: 'article',
        title,
        url: canonical,
        siteName: 'LexHaiti',
        locale: 'fr_FR',
      },
    }
  } catch {
    // Even on fetch failure, keep a self-referential canonical so the page
    // never inherits the site-root canonical from the layout.
    return { alternates: { canonical: `${SITE}/moniteur/${raw}` } }
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  // Fetch the issue WITH its sommaire entries server-side and seed the
  // reader, so the Moniteur content is in the server-rendered HTML for SEO —
  // not just the title. Accepts a numeric id or a date slug, mirroring the
  // client. (ADR-004 Stage 1.)
  const raw = decodeURIComponent(id)
  const isNumeric = /^\d+$/.test(raw)
  let issue: MoniteurIssueWithEntries
  try {
    issue = isNumeric
      ? await getMoniteurIssue(Number(raw))
      : await getMoniteurIssueBySlug(raw)
  } catch (err) {
    // Genuine 404 → real Next 404 instead of a soft-404 (HTTP 200 with a
    // not-found body). A transient/backend error must NOT 404 — rethrow so a
    // healthy issue isn't de-indexed over a hiccup.
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }
  const jsonLd = moniteurIssueJsonLd(issue)
  const crumbs = breadcrumbJsonLd([
    { name: 'Accueil', url: SITE },
    { name: 'Le Moniteur', url: `${SITE}/moniteur` },
    { name: `N° ${issue.number}`, url: `${SITE}/moniteur/${id}` },
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
      <MoniteurDetailClient key={id} initialData={issue} />
    </>
  )
}
