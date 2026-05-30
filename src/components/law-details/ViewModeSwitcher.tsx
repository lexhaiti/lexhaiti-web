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
  /** ``fr`` / ``ht`` — labels translate. */
  lang: 'fr' | 'ht'
  /** Override for the "Par chapitre" segment label, derived from the
   *  law's highest heading level (e.g. "Par titre", "Par livre"). When
   *  omitted, falls back to the generic "Par chapitre". */
  chapitreLabel?: { fr: string; ht: string }
  className?: string
}

const LABELS: Record<ViewMode, { fr: string; ht: string; Icon: typeof Layers }> = {
  tous: { fr: 'Tous', ht: 'Tout', Icon: Layers },
  // ``chapitre`` label is almost always overridden by ``chapitreLabel``
  // (resolved from the law's highest heading level — Titre, Livre,
  // Loi, …). The defaults here only kick in for texts with no headings
  // at all. Stripped of the "Par " preposition to match the
  // single-noun rhythm of "Tous" and "Article".
  chapitre: { fr: 'Chapitre', ht: 'Chapit', Icon: BookOpen },
  article: { fr: 'Article', ht: 'Atik', Icon: FileText },
}

export function ViewModeSwitcher({
  mode,
  available,
  onChange,
  lang,
  chapitreLabel,
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
        'inline-flex items-center h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 p-1 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      {available.map((m) => {
        const { fr, ht, Icon } = LABELS[m]
        // The chapitre segment label follows the law's highest heading
        // level ("Par titre" / "Par livre" / …) when the parent passes
        // an override; otherwise the generic "Par chapitre".
        const segFr = m === 'chapitre' && chapitreLabel ? chapitreLabel.fr : fr
        const segHt = m === 'chapitre' && chapitreLabel ? chapitreLabel.ht : ht
        const label = lang === 'fr' ? segFr : segHt
        const isActive = m === mode
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(m)}
            className={cn(
              // px-4 on mobile / px-3 at sm+ — mobile segments breathe
              // a bit more so the switcher fills more of the row
              // alongside the Sommaire pill without squashing labels.
              'group inline-flex items-center gap-1.5 rounded-full px-4 sm:px-3 py-1.5 text-[12px] font-semibold transition-all',
              isActive
                ? 'bg-primary dark:bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100',
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
