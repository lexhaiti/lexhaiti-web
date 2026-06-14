// RSC route file. Emits per-issue metadata so the browser tab + share
// previews carry the actual issue number ("Le Moniteur N° 47 — 4 juin
// 2014" instead of the default site title). The interactive viewer
// lives in the client component below.

import type { Metadata } from 'next'
import {
  getMoniteurIssue,
  getMoniteurIssueBySlug,
  type MoniteurIssueWithEntries,
} from '@/lib/api/endpoints'
import { breadcrumbJsonLd, moniteurIssueJsonLd } from '@/lib/harvest/jsonld'
import { formatLongDate } from '@/lib/format/date'
import { smartIssueNumber } from '@/lib/format/moniteur'
import { getServerLanguage } from '@/i18n/server'
import MoniteurDetailClient from './_components/MoniteurDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const numericId = Number(id)
  if (Number.isNaN(numericId)) return {}

  try {
    const issue = await getMoniteurIssue(numericId)
    const language = await getServerLanguage()
    const number = smartIssueNumber(issue.number)
    const date = formatLongDate(issue.publication_date, language)
    const title = date ? `Le Moniteur ${number} — ${date}` : `Le Moniteur ${number}`
    return {
      title,
      description: issue.edition_label
        ? `${issue.edition_label} · ${title}`
        : title,
    }
  } catch {
    // Detail page surfaces a not-found state itself; fall back to default.
    return {}
  }
}

const SITE = 'https://www.lexhaiti.org'

export default async function Page({ params }: PageProps) {
  const { id } = await params
  // Fetch the issue WITH its sommaire entries server-side and seed the
  // reader, so the Moniteur content is in the server-rendered HTML for SEO —
  // not just the title. Accepts a numeric id or a date slug, mirroring the
  // client. (ADR-004 Stage 1.)
  const raw = decodeURIComponent(id)
  const isNumeric = /^\d+$/.test(raw)
  let issue: MoniteurIssueWithEntries | null = null
  let jsonLd: Record<string, unknown> | null = null
  let crumbs: Record<string, unknown> | null = null
  try {
    issue = isNumeric
      ? await getMoniteurIssue(Number(raw))
      : await getMoniteurIssueBySlug(raw)
    jsonLd = moniteurIssueJsonLd(issue)
    crumbs = breadcrumbJsonLd([
      { name: 'Accueil', url: SITE },
      { name: 'Le Moniteur', url: `${SITE}/moniteur` },
      { name: `N° ${issue.number}`, url: `${SITE}/moniteur/${id}` },
    ])
  } catch {
    // Soft fail — the reader fetches client-side and shows its not-found state.
  }
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {crumbs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
        />
      )}
      <MoniteurDetailClient key={id} initialData={issue} />
    </>
  )
}
