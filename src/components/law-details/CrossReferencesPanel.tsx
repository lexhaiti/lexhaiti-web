'use client'

/**
 * Cross-references panel à la Légifrance — two columns:
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

import Link from 'next/link'
import { ArrowUpRight, Gavel, LinkIcon, Scroll } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CrossRef {
  title: string
  href: string
  kind?: 'decision' | 'law' | 'decree' | 'article'
  note?: string | null
}

interface Props {
  citedBy?: CrossRef[] | null
  cites?: CrossRef[] | null
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

export function CrossReferencesPanel({
  citedBy,
  cites,
  lang,
  className,
}: Props) {
  const hasCitedBy = (citedBy?.length ?? 0) > 0
  const hasCites = (cites?.length ?? 0) > 0
  if (!hasCitedBy && !hasCites) return null

  const isFr = lang === 'fr'

  return (
    <section
      className={cn(
        'mt-5 rounded-xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5',
        className,
      )}
      aria-label={isFr ? 'Références croisées' : 'Referans kwaze'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {hasCitedBy && (
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              {isFr ? 'Cité par' : 'Site pa'}
            </h4>
            <ul className="space-y-1.5">
              {citedBy!.map((ref, i) => {
                const Icon = refIcon(ref.kind)
                return (
                  <li key={`cb-${i}`}>
                    <Link
                      href={ref.href}
                      className="group inline-flex items-start gap-1.5 text-[13px] text-slate-700 hover:text-primary"
                    >
                      <Icon
                        className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary flex-shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <span className="underline-offset-2 group-hover:underline">
                        {ref.title}
                      </span>
                      {ref.note && (
                        <span className="ml-1 text-[11px] italic text-slate-500">
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
            <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-2">
              {isFr ? 'Cite' : 'Site'}
            </h4>
            <ul className="space-y-1.5">
              {cites!.map((ref, i) => {
                const Icon = refIcon(ref.kind)
                return (
                  <li key={`ct-${i}`}>
                    <Link
                      href={ref.href}
                      className="group inline-flex items-start gap-1.5 text-[13px] text-slate-700 hover:text-primary"
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
