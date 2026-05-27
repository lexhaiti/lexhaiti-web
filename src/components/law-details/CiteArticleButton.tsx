'use client'

/**
 * Per-article "Cite" button — copies a formatted legal citation to
 * the clipboard. Two formats; the menu lets the user pick:
 *
 *   • Short — ``Art. 1382, C. civ. (Haïti)`` — for inline footnotes.
 *   • Long  — ``Art. 1382 du Code civil haïtien (version du
 *               19 juin 2012), https://lexhaiti.org/loi/...`` —
 *             for bibliographies + memos.
 *
 * The component is intentionally low-chrome (small ghost button on the
 * row, popover with the two options) so it never competes with the
 * article body. On unsupported browsers it falls back to ``execCommand``
 * but most modern ones support the Clipboard API.
 */

import { useState } from 'react'
import { Check, Copy, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  /** Article number as the backend stores it (e.g. ``1382``, ``premier``). */
  articleNumber: string | number
  /** Bilingual short name of the parent law, used in the citation
   *  (e.g. ``Code civil``). Pass the FR label — the citation idiom is
   *  French-legal across both UI languages. */
  lawShortTitle: string
  /** ``yyyy-mm-dd`` effective-from date of the displayed version, or
   *  null if the article carries no per-version date. */
  versionDate?: string | null
  /** Canonical absolute URL of this article — used only in the long
   *  form. Computed by the caller so we don't depend on
   *  ``window.location`` (SSR safety). */
  url?: string
  /** ``fr`` / ``ht`` — button label only; citation text stays in the
   *  French legal idiom either way. */
  lang: 'fr' | 'ht'
  className?: string
}

function formatShort(number: string | number, lawShortTitle: string): string {
  const num = String(number).trim()
  const isPremier = num.toLowerCase() === 'premier'
  const display = isPremier ? '1er' : num
  return `Art. ${display}, ${lawShortTitle} (Haïti)`
}

function formatLong(
  number: string | number,
  lawShortTitle: string,
  versionDate: string | null | undefined,
  url: string | undefined,
): string {
  const num = String(number).trim()
  const display = num.toLowerCase() === 'premier' ? '1er' : num
  const pieces: string[] = [`Art. ${display} du ${lawShortTitle} (Haïti)`]
  if (versionDate) {
    // Format yyyy-mm-dd → 19 juin 2012
    try {
      const d = new Date(versionDate)
      if (!Number.isNaN(d.getTime())) {
        const f = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        pieces.push(`version du ${f.format(d)}`)
      }
    } catch {
      /* swallow — date pieces are optional */
    }
  }
  if (url) pieces.push(url)
  return pieces.join(', ')
}

async function writeClipboard(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* fall through to execCommand */
    }
  }
  // Legacy fallback — works in older Safari + locked-down environments.
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function CiteArticleButton({
  articleNumber,
  lawShortTitle,
  versionDate,
  url,
  lang,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  // Track which format just got copied so we can show the tick for a
  // beat; resets after a couple of seconds.
  const [copied, setCopied] = useState<'short' | 'long' | null>(null)

  const handleCopy = async (kind: 'short' | 'long') => {
    const text =
      kind === 'short'
        ? formatShort(articleNumber, lawShortTitle)
        : formatLong(articleNumber, lawShortTitle, versionDate, url)
    const ok = await writeClipboard(text)
    if (!ok) return
    setCopied(kind)
    setTimeout(() => {
      setCopied(null)
      setOpen(false)
    }, 1500)
  }

  const isFr = lang === 'fr'

  return (
    <div className={cn('relative inline-block', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={isFr ? 'Citer cet article' : 'Site atik sa a'}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1',
              'text-[11px] font-semibold text-slate-500 hover:text-primary hover:bg-slate-100',
              'transition-colors',
            )}
          >
            <Quote className="w-3 h-3" aria-hidden />
            {isFr ? 'Citer' : 'Site'}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isFr
            ? 'Copier une citation formatée'
            : 'Kopye yon sitasyon ki fòmate'}
        </TooltipContent>
      </Tooltip>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-20 top-full right-0 mt-1',
            'w-72 rounded-lg border border-slate-200 bg-white shadow-lg',
            'overflow-hidden',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleCopy('short')}
            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start justify-between gap-3 group"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                {isFr ? 'Citation courte' : 'Sitasyon kout'}
              </p>
              <p className="text-xs text-slate-700 font-mono truncate">
                {formatShort(articleNumber, lawShortTitle)}
              </p>
            </div>
            {copied === 'short' ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 group-hover:text-primary flex-shrink-0" />
            )}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleCopy('long')}
            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start justify-between gap-3 border-t border-slate-100 group"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                {isFr ? 'Citation longue' : 'Sitasyon long'}
              </p>
              <p className="text-xs text-slate-700 font-mono break-all">
                {formatLong(articleNumber, lawShortTitle, versionDate, url)}
              </p>
            </div>
            {copied === 'long' ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 group-hover:text-primary flex-shrink-0 mt-1" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
