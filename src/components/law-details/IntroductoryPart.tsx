'use client'

/**
 * Continuous "partie introductive" — the Légifrance-style rendering of
 * a legal text's introductory part (visas, considérants, mentions
 * procédurales, and the enacting formula) as ONE flowing block rather
 * than separate per-kind cards.
 *
 * Takes the already-resolved display strings (in reading order) from
 * the parent, which pulls them from the flat ``visas_* /
 * considerants_* / mentions_procedurales_* / enacting_formula_*``
 * columns. Read-only — editors still edit the underlying fields via
 * FormalBlocksSection's per-field cards. Préambule keeps its own block.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { looksLikeHtml } from './_editor/utils'

interface Props {
  /** Already-resolved (current-language) text parts, in reading order.
   *  Empty / blank entries are dropped. */
  parts: (string | null | undefined)[]
  lang: 'fr' | 'ht'
  /** Expanded on first render. Default false to match the other
   *  pre-article blocks (keeps the article list prominent). */
  defaultExpanded?: boolean
}

/** Plain-text preview for the collapsed header — strips tags from the
 *  first part so the reader can scan without expanding. */
function previewSnippet(raw: string, limit = 90): string {
  const plain = raw
    .replace(/<\/(p|li|blockquote|h[1-6])>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= limit ? plain : plain.slice(0, limit).trimEnd() + '…'
}

export function IntroductoryPart({ parts, lang, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isFr = lang === 'fr'

  const visible = parts
    .map((p) => (p ?? '').trim())
    .filter((t) => t.length > 0)
  if (visible.length === 0) return null

  const title = isFr ? 'Partie introductive' : 'Pati entwodiktif'
  const snippet = previewSnippet(visible[0])

  return (
    <div
      className={cn(
        'group rounded-xl border bg-white transition-all duration-200 overflow-hidden',
        expanded
          ? 'border-slate-200 shadow-sm'
          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          expanded
            ? 'bg-gradient-to-r from-primary/5 via-white to-white'
            : 'bg-white hover:bg-slate-50/60',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-0 bottom-0 w-[3px] transition-colors',
            expanded ? 'bg-primary' : 'bg-transparent group-hover:bg-slate-200',
          )}
        />
        <ChevronDown
          className={cn(
            'w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200',
            expanded ? 'rotate-0 text-primary' : '-rotate-90',
          )}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700 flex-shrink-0">
          {title}
        </span>
        {!expanded && (
          <span className="text-sm text-slate-500 italic truncate min-w-0 flex-1">
            {snippet}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1">
          {/* Continuous flow — each part in reading order, no per-kind
              labels (mirrors Légifrance, which doesn't visually separate
              visas / considérants / mentions / formule). */}
          <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
            {visible.map((text, i) =>
              looksLikeHtml(text) ? (
                <div
                  key={i}
                  className="formal-block-html"
                  dangerouslySetInnerHTML={{ __html: text }}
                />
              ) : (
                <div key={i} className="whitespace-pre-wrap">
                  {text}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
