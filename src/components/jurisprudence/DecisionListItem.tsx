'use client'

import Link from 'next/link'
import { ArrowUpRight, BookText, Gavel, Landmark, Scale } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import { formatLongDate } from '@/lib/format/date'
import type { DecisionListItemRich } from '@/lib/api/endpoints'

import {
  courtLabel,
  decisionTitle,
  outcomeBadgeClass,
  outcomeLabel,
} from './_labels'

interface Props {
  decision: DecisionListItemRich
}

/**
 * Row card for one decision on the `/jurisprudence` index page. The
 * whole card is a link to `/jurisprudence/<slug>`. Layout follows
 * the spec: court · date right-aligned, title, subject chips,
 * outcome pill, stat strip (moyens · cited articles).
 */
export function DecisionListItem({ decision }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'
  const title = decisionTitle(
    decision,
    lang,
    `${t('jurisprudence.decisionOf').replace(
      '{date}',
      formatLongDate(decision.decision_date, lang, decision.decision_date),
    )}`,
  )
  const dateStr = formatLongDate(
    decision.decision_date,
    lang,
    decision.decision_date,
  )
  const court = courtLabel(t, decision.court)
  const outcome = outcomeLabel(t, decision.outcome)
  const subjects = decision.subject_tags ?? []

  return (
    <Link
      href={`/jurisprudence/${decision.slug}`}
      className="group block outline-none"
    >
      <article
        className={cn(
          'relative overflow-hidden rounded-2xl border border-slate-200 bg-white',
          'transition-all duration-300',
          'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5',
        )}
      >
        {/* Left accent rail — scales in from the top on hover. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 origin-top scale-y-0 bg-primary transition-transform duration-300 group-hover:scale-y-100"
        />

        <div className="p-5 sm:p-6">
          {/* Top row: court + chamber / date */}
          <header className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-primary">
                <Landmark className="h-3.5 w-3.5" />
                {court}
              </span>
              {decision.chamber && (
                <span className="text-slate-500">· {decision.chamber}</span>
              )}
              {decision.case_number && (
                <span className="text-slate-400">· N° {decision.case_number}</span>
              )}
            </div>
            <time
              dateTime={decision.decision_date}
              className="text-xs font-semibold text-slate-500 tabular-nums"
            >
              {dateStr}
            </time>
          </header>

          {/* Title */}
          <h3 className="mb-3 text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Subject chips + outcome badge */}
          {(subjects.length > 0 || decision.outcome) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {decision.outcome && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                    outcomeBadgeClass(decision.outcome),
                  )}
                >
                  <Scale className="h-3 w-3" />
                  {outcome}
                </span>
              )}
              {subjects.slice(0, 4).map((s) => {
                const label =
                  (lang === 'ht' && s.label_ht) || s.label_fr || s.key
                return (
                  <span
                    key={s.key}
                    className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {label}
                  </span>
                )
              })}
              {subjects.length > 4 && (
                <span className="text-[11px] font-semibold text-slate-400">
                  +{subjects.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Footer: stat strip + arrow affordance */}
          <footer className="flex items-end justify-between border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
              {typeof decision.moyens_count === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <Gavel className="h-3.5 w-3.5 text-slate-400" />
                  <span className="tabular-nums font-bold text-slate-700">
                    {decision.moyens_count}
                  </span>{' '}
                  {t('jurisprudence.rowStats.moyens')}
                </span>
              )}
              {typeof decision.cited_articles_count === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <BookText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="tabular-nums font-bold text-slate-700">
                    {decision.cited_articles_count}
                  </span>{' '}
                  {t('jurisprudence.rowStats.citedArticles')}
                </span>
              )}
            </div>
            <span
              aria-hidden
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full bg-primary/5 text-primary',
                'transition-all duration-200',
                'group-hover:bg-primary group-hover:text-white group-hover:scale-110',
              )}
            >
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
            </span>
          </footer>
        </div>
      </article>
    </Link>
  )
}
