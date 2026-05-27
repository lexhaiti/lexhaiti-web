'use client'

/**
 * 3-segment toggle for the law-detail page: Tous / Par chapitre / Un
 * article. Renders only the segments listed in ``available`` — flat
 * legal texts get just Tous + Article, fully-chaptered texts get all
 * three.
 *
 * Visual: a single rounded pill with internal segment dividers, sized
 * to match the existing TocSidebar's filter pills. The active segment
 * has a navy fill; inactive ones are slate-on-cream with hover lift.
 * Icons are deliberately quiet glyphs (Layers / BookOpen / FileText)
 * — the labels carry the load.
 */

import { BookOpen, FileText, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/lib/legal/shape'

interface Props {
  mode: ViewMode
  available: ViewMode[]
  onChange: (next: ViewMode) => void
  /** Number of articles currently visible — surfaced as a small count
   *  on the active segment so the user always knows how much they're
   *  about to read. */
  visibleCount?: number
  /** ``fr`` / ``ht`` — labels translate. */
  lang: 'fr' | 'ht'
  className?: string
}

const LABELS: Record<ViewMode, { fr: string; ht: string; Icon: typeof Layers }> = {
  tous: { fr: 'Tous', ht: 'Tout', Icon: Layers },
  chapitre: { fr: 'Par chapitre', ht: 'Pa chapit', Icon: BookOpen },
  article: { fr: 'Un article', ht: 'Yon atik', Icon: FileText },
}

export function ViewModeSwitcher({
  mode,
  available,
  onChange,
  visibleCount,
  lang,
  className,
}: Props) {
  if (available.length < 2) return null
  return (
    <div
      role="tablist"
      aria-label={
        lang === 'fr' ? 'Mode de lecture' : 'Mòd lekti'
      }
      className={cn(
        'inline-flex items-center rounded-full border border-slate-200 bg-white/80 p-1 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {available.map((m) => {
        const { fr, ht, Icon } = LABELS[m]
        const label = lang === 'fr' ? fr : ht
        const isActive = m === mode
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(m)}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {label}
            {isActive && typeof visibleCount === 'number' && visibleCount > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums',
                  'bg-white/20 text-white',
                )}
              >
                {visibleCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
