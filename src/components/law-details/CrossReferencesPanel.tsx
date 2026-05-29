'use client'

/**
 * Cross-references panel — two columns:
 *
 *   Cité par   Decisions, decrees, or other articles that REFERENCE
 *              this article (incoming).
 *   Cite       Articles or texts that THIS article references
 *              (outgoing). Common in codified texts that cross-link
 *              to other code articles.
 *
 * The component reads two optional arrays attached to the article:
 *   - ``cited_by``: ``{ title, href, kind?: 'decision' | 'law' | 'decree' }[]``
 *   - ``cites``:    ``{ title, href }[]``
 *
 * Both default to empty, so the panel gracefully renders nothing
 * until the backend exposes a reverse-index endpoint. When wired,
 * the kind drives a small icon (Gavel for decisions, Scroll for
 * laws/decrees) for fast visual triage.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronDown,
  Gavel,
  LinkIcon,
  Loader2,
  Scroll,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getArticleReferences,
  type ArticleRefItem,
} from '@/lib/api/endpoints'

export interface CrossRef {
  title: string
  href: string
  kind?: 'decision' | 'law' | 'decree' | 'article'
  note?: string | null
}

interface Props {
  /** Pre-resolved citations (e.g. inlined by the parent fetch). When
   *  not provided, the panel can lazy-fetch via ``articleId`` below. */
  citedBy?: CrossRef[] | null
  cites?: CrossRef[] | null
  /** When set, the panel renders a disclosure button and lazy-fetches
   *  references from ``/articles/{id}/references`` on first expand.
   *  Used by the article list view to avoid N+1 fetches across the
   *  whole law on page load. */
  articleId?: number
  lang: 'fr' | 'ht'
  className?: string
}

function refIcon(kind?: CrossRef['kind']) {
  switch (kind) {
    case 'decision':
      return Gavel
    case 'law':
    case 'decree':
      return Scroll
    default:
      return LinkIcon
  }
}

function adaptItem(ref: ArticleRefItem | CrossRef): CrossRef {
  // ArticleRefItem -> CrossRef shape. They're nearly identical; just
  // map ``decision_date`` into ``note`` when ``note`` is empty so the
  // panel can show "12 mars 2024" beside a decision title.
  return {
    title: ref.title,
    href: ref.href,
    kind: ref.kind as CrossRef['kind'],
    note:
      ref.note ??
      (('decision_date' in ref ? ref.decision_date : null) || null),
  }
}

export function CrossReferencesPanel({
  citedBy,
  cites,
  articleId,
  lang,
  className,
}: Props) {
  const isFr = lang === 'fr'

  // Lazy-fetch path — used when ``articleId`` is set and no
  // pre-supplied data was passed.
  const lazy = articleId != null && citedBy == null && cites == null
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchedCitedBy, setFetchedCitedBy] = useState<CrossRef[]>([])
  const [fetchedCites, setFetchedCites] = useState<CrossRef[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lazy || !open || loaded || loading) return
    setLoading(true)
    setError(null)
    void getArticleReferences(articleId!)
      .then((r) => {
        setFetchedCitedBy((r.cited_by ?? []).map(adaptItem))
        setFetchedCites((r.cites ?? []).map(adaptItem))
        setLoaded(true)
      })
      .catch(() => {
        setError(
          isFr
            ? 'Impossible de charger les références.'
            : 'Pa kapab chaje referans yo.',
        )
      })
      .finally(() => setLoading(false))
  }, [lazy, open, loaded, loading, articleId, isFr])

  // Resolve the data source: pre-supplied wins over lazy-fetched.
  const resolvedCitedBy: CrossRef[] = (citedBy ?? fetchedCitedBy) ?? []
  const resolvedCites: CrossRef[] = (cites ?? fetchedCites) ?? []
  const hasCitedBy = resolvedCitedBy.length > 0
  const hasCites = resolvedCites.length > 0

  // Lazy mode: render a disclosure button. Eager mode: render
  // immediately if there's anything; otherwise nothing.
  if (lazy) {
    return (
      <div className={cn('mt-2', className)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-semibold transition-colors',
            'text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
        >
          <LinkIcon className="w-3.5 h-3.5" aria-hidden />
          {isFr ? 'Références croisées' : 'Referans kwaze'}
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
        {open && loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-3 px-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {isFr ? 'Chargement…' : 'Chajman…'}
          </div>
        )}
        {open && error && (
          <p className="text-xs text-red-600 py-2 px-2">{error}</p>
        )}
        {open && loaded && !hasCitedBy && !hasCites && (
          <p className="text-xs italic text-slate-400 py-2 px-2">
            {isFr
              ? 'Aucune référence connue pour cet article.'
              : 'Pa gen referans pou atik sa a.'}
          </p>
        )}
        {open &&
          loaded &&
          (hasCitedBy || hasCites) &&
          renderBody({
            citedBy: resolvedCitedBy,
            cites: resolvedCites,
            isFr,
            className,
          })}
      </div>
    )
  }

  // Eager mode (legacy / explicit data).
  if (!hasCitedBy && !hasCites) return null
  return renderBody({
    citedBy: resolvedCitedBy,
    cites: resolvedCites,
    isFr,
    className,
  })
}

function renderBody({
  citedBy,
  cites,
  isFr,
  className,
}: {
  citedBy: CrossRef[]
  cites: CrossRef[]
  isFr: boolean
  className?: string
}) {
  const hasCitedBy = citedBy.length > 0
  const hasCites = cites.length > 0
  return (
    <section
      className={cn(
        'mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-4 sm:p-5',
        className,
      )}
      aria-label={isFr ? 'Références croisées' : 'Referans kwaze'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {hasCitedBy && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-2">
              {isFr ? 'Cité par' : 'Site pa'}
            </h4>
            <ul className="space-y-1.5">
              {citedBy!.map((ref, i) => {
                const Icon = refIcon(ref.kind)
                return (
                  <li key={`cb-${i}`}>
                    <Link
                      href={ref.href}
                      className="group inline-flex items-start gap-1.5 text-[13px] text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary"
                    >
                      <Icon
                        className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary flex-shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <span className="underline-offset-2 group-hover:underline">
                        {ref.title}
                      </span>
                      {ref.note && (
                        <span className="ml-1 text-[11px] italic text-slate-500 dark:text-slate-400">
                          {ref.note}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {hasCites && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-2">
              {isFr ? 'Cite' : 'Site'}
            </h4>
            <ul className="space-y-1.5">
              {cites!.map((ref, i) => {
                const Icon = refIcon(ref.kind)
                return (
                  <li key={`ct-${i}`}>
                    <Link
                      href={ref.href}
                      className="group inline-flex items-start gap-1.5 text-[13px] text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary"
                    >
                      <Icon
                        className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary flex-shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <span className="underline-offset-2 group-hover:underline">
                        {ref.title}
                      </span>
                      <ArrowUpRight
                        className="w-3 h-3 text-slate-300 group-hover:text-primary flex-shrink-0 mt-1"
                        aria-hidden
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
