'use client'

/**
 * Légifrance-style document toolbar — small action strip at the top
 * of the law content area, just under the SearchPanel row.
 *
 * Three actions:
 *   - "Accéder à la version initiale" → jumps to the very first
 *     article of the law (or article v1 if a single article is in
 *     focus). Optional callback; hidden when not relevant.
 *   - "Masquer les articles et sections abrogés" toggle → controlled
 *     toggle exposed via ``hideAbrogated`` + ``onToggleHideAbrogated``.
 *     When the parent doesn't wire it, the toggle is hidden.
 *   - "Copier le lien" → writes ``window.location.href`` to the
 *     clipboard and shows a toast.
 *
 * The previous "Imprimer" button is gone — the law-detail hero
 * already has a PDF download tile which covers that need.
 *
 * The toolbar prints nothing when none of the actions are relevant,
 * so it gracefully disappears on simple flat decrees.
 */

import { Copy, EyeOff, LinkIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast-simple'
import { cn } from '@/lib/utils'

interface DocumentToolbarProps {
  lang: 'fr' | 'ht'
  /** When set, renders the "Accéder à la version initiale" link.
   *  The parent decides what "initial version" means in context —
   *  usually the law's first article — and provides the click handler. */
  onJumpToInitial?: () => void
  /** Controlled toggle. When both this + onToggleHideAbrogated are
   *  set the toolbar renders the "Masquer les articles et sections
   *  abrogés" toggle. */
  hideAbrogated?: boolean
  onToggleHideAbrogated?: () => void
}

export function DocumentToolbar({
  lang,
  onJumpToInitial,
  hideAbrogated,
  onToggleHideAbrogated,
}: DocumentToolbarProps) {
  const { toast } = useToast()
  const isFr = lang === 'fr'

  const showInitial = !!onJumpToInitial
  const showAbrogatedToggle = onToggleHideAbrogated !== undefined
  if (!showInitial && !showAbrogatedToggle) return null

  const copyLink = async () => {
    if (typeof window === 'undefined') return
    const href = window.location.href
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href)
      } else {
        // Legacy fallback — locked-down environments only.
        const ta = document.createElement('textarea')
        ta.value = href
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast(isFr ? 'Lien copié.' : 'Lyen kopye.')
    } catch {
      toast(isFr ? 'Impossible de copier le lien.' : 'Pa kapab kopye lyen an.')
    }
  }

  return (
    <div className="flex items-center flex-wrap gap-2 mb-4 text-[12px]">
      {showInitial && (
        <button
          type="button"
          onClick={onJumpToInitial}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:border-primary hover:text-primary transition-colors"
        >
          <LinkIcon className="w-3.5 h-3.5" aria-hidden />
          {isFr
            ? 'Accéder à la version initiale'
            : 'Ale nan vèsyon orijinal la'}
        </button>
      )}

      {showAbrogatedToggle && (
        <button
          type="button"
          onClick={onToggleHideAbrogated}
          aria-pressed={!!hideAbrogated}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium transition-colors',
            hideAbrogated
              ? 'bg-primary text-white border-primary hover:bg-primary/90'
              : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary',
          )}
        >
          <EyeOff className="w-3.5 h-3.5" aria-hidden />
          {isFr
            ? 'Masquer les articles et sections abrogés'
            : 'Kache atik ak seksyon abwoje yo'}
        </button>
      )}

      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:border-primary hover:text-primary transition-colors ml-auto"
      >
        <Copy className="w-3.5 h-3.5" aria-hidden />
        {isFr ? 'Copier le lien' : 'Kopye lyen'}
      </button>
    </div>
  )
}
