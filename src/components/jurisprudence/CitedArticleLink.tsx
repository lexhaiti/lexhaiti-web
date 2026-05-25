'use client'

import Link from 'next/link'
import { ArrowUpRight, BookText } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useT } from '@/i18n/useT'
import type { DecisionCitedArticle } from '@/lib/api/endpoints'

interface Props {
  citation: DecisionCitedArticle
  className?: string
}

/**
 * Compact link card for a decision's cited articles. When the cited
 * article's parent text is in the corpus (``text_slug`` populated),
 * the card becomes a `<Link>` to `/loi/<slug>?article=<n>`. Otherwise
 * it renders as a static row so the UI still shows the citation.
 */
export function CitedArticleLink({ citation, className }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'

  const textTitle =
    (lang === 'ht' && citation.text_title_ht) ||
    citation.text_title_fr ||
    citation.text_slug ||
    ''
  const context =
    (lang === 'ht' && citation.context_ht) || citation.context_fr || null

  const isLinked = Boolean(citation.text_slug)
  const href = isLinked
    ? `/loi/${citation.text_slug}?article=${encodeURIComponent(
        citation.article_number,
      )}`
    : null

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
              'bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors',
            )}
            aria-hidden
          >
            <BookText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
              Article {citation.article_number}
            </p>
            {textTitle && (
              <p className="text-xs text-slate-500 line-clamp-1">
                {textTitle}
              </p>
            )}
            {context && (
              <p className="mt-1 text-xs italic text-slate-400 line-clamp-2">
                « {context} »
              </p>
            )}
          </div>
        </div>
        {isLinked && (
          <span className="inline-flex items-center gap-1 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            {t('jurisprudence.viewLaw')}
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </>
  )

  const baseCls = cn(
    'group block rounded-xl border border-slate-200 bg-white p-4',
    'transition-all duration-200',
    isLinked && 'hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5',
    className,
  )

  return isLinked && href ? (
    <Link href={href} className={baseCls}>
      {inner}
    </Link>
  ) : (
    <div className={baseCls}>{inner}</div>
  )
}
