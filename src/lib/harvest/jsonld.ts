/**
 * Structured-data (JSON-LD) builders for the public corpus — ADR-004 Stage 1.
 *
 * Each builder turns a read-model object into one JSON-LD graph that carries
 * BOTH vocabularies at once:
 *   - schema.org `Legislation` / `PublicationIssue` — for search engines and
 *     general crawlers (Google legislation rich results, LLM indexers).
 *   - ELI (European Legislation Identifier ontology) — for legal harvesters
 *     and the free-access-to-law network. EU-originated but jurisdiction-
 *     agnostic and the de-facto model for machine-readable legislation.
 *
 * The block is embedded in the page (see the three detail routes), so it is
 * crawlable without hitting the API. No new request — every field below is
 * already loaded for `generateMetadata`.
 */
import type { LegalTextRead, MoniteurIssueRead } from '@/lib/api/endpoints'

/** Structural subset of the decision read model — only the fields the
 *  builder reads. Decoupled from the exact API type because the detail
 *  endpoint returns an enriched shape that re-declares some fields. */
type DecisionInput = {
  slug: string
  court: string
  decision_date: string
  case_number?: string | null
  summary_fr?: string | null
  summary_ht?: string | null
  headnotes_fr?: string | null
  full_text_ht?: string | null
  subject_matter?: string[] | null
}

const SITE = 'https://lexhaiti.org'

// schema.org + ELI in one context. ELI terms are namespaced `eli:`.
const CONTEXT = ['https://schema.org', { eli: 'http://data.europa.eu/eli/ontology#' }]

// LegalStatus → schema.org LegislationLegalForce enumeration.
const LEGAL_FORCE: Record<string, string> = {
  in_force: 'InForce',
  ratified: 'InForce',
  signed: 'InForce',
  partially_abrogated: 'PartiallyInForce',
  abrogated: 'NotInForce',
  denounced: 'NotInForce',
  historique: 'NotInForce',
}

type JsonLd = Record<string, unknown>

function compact(obj: JsonLd): JsonLd {
  // Drop null / undefined / empty-array keys so the emitted graph is tidy.
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => {
      if (v === null || v === undefined || v === '') return false
      if (Array.isArray(v) && v.length === 0) return false
      return true
    }),
  )
}

/** A `BreadcrumbList` so Google can render the breadcrumb trail in results
 *  (improves CTR and tells the crawler the site hierarchy). */
export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

/** A Haitian-law `Legislation` node (codes, laws, decrees, …). */
export function legislationJsonLd(text: LegalTextRead): JsonLd {
  const url = `${SITE}/loi/${text.slug}`
  const languages = ['fr', ...(text.title_ht || text.document_body_ht ? ['ht'] : [])]
  const keywords = (text.theme_tags ?? []).map((t) => t.theme)
  const force = LEGAL_FORCE[text.status as string]

  // Inbound graph edges from the citation graph (who repealed / amended us).
  const repealedBy = text.abrogated_by
    ? `${SITE}/loi/${text.abrogated_by.slug}`
    : undefined
  const changedBy = (text.amended_by ?? []).map((a) => `${SITE}/loi/${a.slug}`)

  // Le Moniteur issue this text was published in.
  const isPartOf = text.moniteur_issue_number
    ? {
        '@type': 'PublicationIssue',
        issueNumber: text.moniteur_issue_number,
        datePublished: text.moniteur_issue_publication_date ?? undefined,
        isPartOf: { '@type': 'Periodical', name: 'Le Moniteur' },
      }
    : undefined

  return compact({
    '@context': CONTEXT,
    '@type': 'Legislation',
    '@id': url,
    url,
    name: text.title_fr,
    alternateName: text.title_ht ?? undefined,
    description: text.description_fr ?? undefined,
    inLanguage: languages,
    legislationJurisdiction: 'Haiti',
    legislationType: text.category,
    legislationIdentifier: text.official_number ?? undefined,
    legislationDate: text.promulgation_date ?? undefined,
    datePublished: text.publication_date ?? undefined,
    legislationLegalForce: force ? `https://schema.org/${force}` : undefined,
    keywords: keywords.length ? keywords : undefined,
    legislationPassedBy: text.issuing_authority
      ? { '@type': 'GovernmentOrganization', name: text.issuing_authority }
      : undefined,
    isPartOf,
    publisher: {
      '@type': 'GovernmentOrganization',
      name: "République d'Haïti — Le Moniteur",
    },
    // ELI projection of the same facts.
    'eli:jurisdiction': 'http://publications.europa.eu/resource/authority/country/HTI',
    'eli:type_document': text.category,
    'eli:date_publication': text.publication_date ?? undefined,
    'eli:date_document': text.promulgation_date ?? undefined,
    'eli:id_local': text.official_number ?? undefined,
    'eli:is_about': keywords.length ? keywords : undefined,
    'eli:repealed_by': repealedBy ? { '@id': repealedBy } : undefined,
    'eli:changed_by': changedBy.length ? changedBy.map((id) => ({ '@id': id })) : undefined,
  })
}

/** A court decision (jurisprudence). schema.org has no caselaw type, so we
 *  use `Legislation` with `legislationType: caselaw` + an `Article` view. */
export function decisionJsonLd(decision: DecisionInput): JsonLd {
  const url = `${SITE}/jurisprudence/${decision.slug}`
  const court = decision.court
  const languages = ['fr', ...(decision.summary_ht || decision.full_text_ht ? ['ht'] : [])]
  const subjects = decision.subject_matter ?? []

  return compact({
    '@context': CONTEXT,
    '@type': ['Legislation', 'Article'],
    '@id': url,
    url,
    name: `${court} — ${decision.decision_date}`,
    headline: `${court} — ${decision.decision_date}`,
    description: decision.summary_fr ?? decision.headnotes_fr ?? undefined,
    inLanguage: languages,
    datePublished: decision.decision_date,
    legislationJurisdiction: 'Haiti',
    legislationType: 'caselaw',
    legislationIdentifier: decision.case_number ?? undefined,
    keywords: subjects.length ? subjects : undefined,
    about: subjects.length ? subjects.map((s) => ({ '@type': 'Thing', name: s })) : undefined,
    author: { '@type': 'GovernmentOrganization', name: court },
    publisher: {
      '@type': 'GovernmentOrganization',
      name: "Pouvoir judiciaire — République d'Haïti",
    },
    'eli:jurisdiction': 'http://publications.europa.eu/resource/authority/country/HTI',
    'eli:type_document': 'caselaw',
    'eli:date_document': decision.decision_date,
  })
}

/** One issue of Le Moniteur (the official journal). */
export function moniteurIssueJsonLd(issue: MoniteurIssueRead): JsonLd {
  const url = `${SITE}/moniteur/${issue.id}`
  return compact({
    '@context': CONTEXT,
    '@type': 'PublicationIssue',
    '@id': url,
    url,
    name: `Le Moniteur n° ${issue.number}`,
    issueNumber: issue.number,
    datePublished: issue.publication_date ?? undefined,
    inLanguage: 'fr',
    editor: issue.director
      ? { '@type': 'Person', name: issue.director }
      : undefined,
    associatedMedia: issue.file_url
      ? { '@type': 'MediaObject', contentUrl: issue.file_url, encodingFormat: 'application/pdf' }
      : undefined,
    isPartOf: {
      '@type': 'Periodical',
      name: 'Le Moniteur',
      publisher: {
        '@type': 'GovernmentOrganization',
        name: "Imprimerie Nationale d'Haïti",
      },
    },
  })
}
