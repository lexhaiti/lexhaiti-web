'use client'

/**
 * Prev / next chapter navigation for the "Par chapitre" view mode.
 * The chapter view shows one heading's articles at a time; this strip
 * lets the reader step to the adjacent chapter without going back to
 * the sommaire. Mirrors the prev/next chrome of the focused single-
 * article viewer.
 *
 * Renders nothing when there's only one chapter (nowhere to step).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  lang: 'fr' | 'ht'
  /** Label of the chapter currently shown, e.g. "Titre IX — …". */
  currentLabel: string
  /** Label of the previous / next chapter, for the button tooltip /
   *  sub-text. Null at the ends. */
  prevLabel: string | null
  nextLabel: string | null
  onPrev: () => void
  onNext: () => void
  /** Position indicator — "3 / 11". */
  index: number
  total: number
}

export function ChapterNav({
  lang,
  currentLabel,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
  index,
  total,
}: Props) {
  if (total < 2) return null
  const isFr = lang === 'fr'
  const hasPrev = prevLabel !== null
  const hasNext = nextLabel !== null

  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-semibold transition-colors min-w-0'
  const enabled =
    'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary'
  const disabled =
    'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed'

  return (
    <nav
      aria-label={isFr ? 'Navigation par chapitre' : 'Navigasyon pa chapit'}
      className="flex items-center justify-between gap-3 mb-4"
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        title={prevLabel ?? undefined}
        className={cn(btn, hasPrev ? enabled : disabled)}
      >
        <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden />
        <span className="truncate hidden sm:inline max-w-[16ch]">
          {hasPrev ? prevLabel : isFr ? 'Début' : 'Kòmansman'}
        </span>
        <span className="sm:hidden">{isFr ? 'Préc.' : 'Avan'}</span>
      </button>

      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 tabular-nums whitespace-nowrap">
        {index + 1} / {total}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        title={nextLabel ?? undefined}
        className={cn(btn, hasNext ? enabled : disabled, 'justify-end')}
      >
        <span className="truncate hidden sm:inline max-w-[16ch]">
          {hasNext ? nextLabel : isFr ? 'Fin' : 'Fen'}
        </span>
        <span className="sm:hidden">{isFr ? 'Suiv.' : 'Apre'}</span>
        <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden />
      </button>
    </nav>
  )
}
