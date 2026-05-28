'use client'

/**
 * Continuous "partie introductive" — the Légifrance-style rendering of
 * a legal text's ordered introductory blocks (visas, considérants,
 * mentions procédurales, author / report mention). Unlike the legacy
 * per-kind accordion cards, these flow together as ONE block in their
 * stored order, so a text that interleaves them (visa → considérant →
 * visa again) reads exactly as drafted.
 *
 * Data comes from ``LegalTextRead.intro_blocks`` (the ordered
 * ``legal_text_intro_blocks`` rows). When that list is empty the
 * parent falls back to the flat-column FormalBlocksSection, so
 * un-migrated texts keep rendering.
 *
 * Read-only: editing the ordered blocks happens in the dedicated
 * editor (separate component). Préambule + formule d'adoption keep
 * their own treatment outside this block.
 */

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { components } from '@/lib/api-types'
import { looksLikeHtml } from './_editor/utils'

type IntroBlock = components['schemas']['IntroBlockRead']

interface Props {
  blocks: IntroBlock[]
  lang: 'fr' | 'ht'
  /** Expanded on first render. Default false to match the other
   *  pre-article blocks (keeps the article list prominent). */
  defaultExpanded?: boolean
}

/** Plain-text preview for the collapsed header — strips tags from the
 *  first block so the reader can scan without expanding. */
function previewSnippet(blocks: IntroBlock[], lang: 'fr' | 'ht', limit = 90): string {
  const first = blocks.find((b) =>
    (lang === 'ht' ? b.text_ht : null) ?? b.text_fr,
  )
  const raw = (lang === 'ht' ? first?.text_ht : null) ?? first?.text_fr ?? ''
  const plain = raw
    .replace(/<\/(p|li|blockquote|h[1-6])>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= limit ? plain : plain.slice(0, limit).trimEnd() + '…'
}

export function IntroductoryPart({ blocks, lang, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const isFr = lang === 'fr'

  // Keep only blocks that actually carry text in the active language
  // (or French as fallback). Empty rows would render as blank gaps.
  const visible = blocks.filter(
    (b) => ((lang === 'ht' ? b.text_ht : null) ?? b.text_fr ?? '').trim(),
  )
  if (visible.length === 0) return null

  const title = isFr ? 'Visas et considérants' : 'Viza ak konsideran'
  const snippet = previewSnippet(visible, lang)

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
          {/* Continuous flow — each block's text in stored order, no
              per-kind labels (mirrors Légifrance, which doesn't visually
              separate visas / considérants / mentions). The
              ``formal-block-html`` rhythm gives each "Vu le …" line room
              to breathe; ``space-y`` separates successive blocks. */}
          <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
            {visible.map((b) => {
              const text = (lang === 'ht' ? b.text_ht : null) ?? b.text_fr ?? ''
              return looksLikeHtml(text) ? (
                <div
                  key={b.id}
                  className="formal-block-html"
                  dangerouslySetInnerHTML={{ __html: text }}
                />
              ) : (
                <div key={b.id} className="whitespace-pre-wrap">
                  {text}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
