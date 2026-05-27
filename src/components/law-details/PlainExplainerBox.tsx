'use client'

/**
 * Plain-language explainer slot — rendered beneath the formal article
 * text when the editorial team has filled an ``explainer_fr`` or
 * ``explainer_ht`` field on the article. The slot is OPTIONAL: an
 * article without an explainer simply doesn't show this box.
 *
 * The point is access-to-justice. The formal legal text stays intact,
 * but a citizen who lands on Article 1382 of the Code Civil can read
 * "Sa li vle di · En clair" — a one-paragraph plain-Kreyòl / plain-
 * French summary of what the article actually does.
 *
 * Visual: warm parchment surface with a thin gold left rail to mark
 * it as editorial commentary, NOT part of the formal law. The
 * heading is in the user's current language but the body is bilingual
 * (both shown when available) since plain-language access matters
 * regardless of the page language toggle.
 *
 * Backend field shape (when wired): ``explainer_fr: string | null``
 * and ``explainer_ht: string | null`` on the article row. Until those
 * exist, the component just returns ``null``.
 */

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  explainerFr?: string | null
  explainerHt?: string | null
  /** ``fr`` / ``ht`` — drives heading wording. */
  lang: 'fr' | 'ht'
  className?: string
}

export function PlainExplainerBox({
  explainerFr,
  explainerHt,
  lang,
  className,
}: Props) {
  const hasFr = !!explainerFr && explainerFr.trim().length > 0
  const hasHt = !!explainerHt && explainerHt.trim().length > 0
  if (!hasFr && !hasHt) return null

  const isFr = lang === 'fr'

  return (
    <aside
      className={cn(
        'mt-5 relative rounded-r-lg border-l-[3px] border-l-amber-400 bg-amber-50/50 p-5',
        'before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-amber-300/60',
        className,
      )}
      aria-label={isFr ? 'Explication en clair' : 'Eksplikasyon klè'}
    >
      <header className="flex items-center gap-2 mb-3">
        <Sparkles
          className="w-4 h-4 text-amber-600 flex-shrink-0"
          aria-hidden
        />
        <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">
          {isFr ? 'En clair' : 'Sa li vle di'}
        </h4>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70">
          ·
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70">
          {isFr ? 'Note de la rédaction' : 'Nòt redaksyon an'}
        </span>
      </header>

      {/* Both languages shown when available — plain-language access
          should not depend on the language toggle. The user's active
          language goes first, the other second (smaller, italic). */}
      <div className="space-y-3">
        {(isFr ? hasFr : hasHt) && (
          <p className="text-sm leading-relaxed text-slate-800">
            {isFr ? explainerFr : explainerHt}
          </p>
        )}
        {(isFr ? hasHt : hasFr) && (
          <p className="text-[13px] leading-relaxed italic text-slate-600">
            {isFr ? explainerHt : explainerFr}
          </p>
        )}
      </div>
    </aside>
  )
}
