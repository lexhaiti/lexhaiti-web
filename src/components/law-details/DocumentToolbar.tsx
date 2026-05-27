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

import {
  Copy,
  Eye,
  EyeOff,
  LinkIcon,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast-simple'
import { cn } from '@/lib/utils'

interface DocumentToolbarProps {
  lang: 'fr' | 'ht'
  /** When set, renders the "Accéder à la version initiale" link.
   *  The parent decides what "initial version" means in context —
   *  usually the law's first article — and provides the click handler. */
  onJumpToInitial?: () => void
  /** Controlled toggle. When both this + onToggleHideAbrogated are
   *  set the toolbar renders an "Afficher / Masquer les articles et
   *  sections abrogés" pair (label flips based on the current state). */
  hideAbrogated?: boolean
  onToggleHideAbrogated?: () => void
  /** Bulk collapse / expand of the law's heading tree — wired by
   *  the parent into the shared ``useHeadingCollapse`` hook so the
   *  buttons and the per-row chevrons share one source of truth.
   *  Both callbacks must be provided to render the pair. */
  onCollapseAll?: () => void
  onExpandAll?: () => void
}

export function DocumentToolbar({
  lang,
  onJumpToInitial,
  hideAbrogated,
  onToggleHideAbrogated,
  onCollapseAll,
  onExpandAll,
}: DocumentToolbarProps) {
  const { toast } = useToast()
  const isFr = lang === 'fr'

  const showInitial = !!onJumpToInitial
  const showAbrogatedToggle = onToggleHideAbrogated !== undefined
  const showCollapseAll = !!onCollapseAll && !!onExpandAll
  if (!showInitial && !showAbrogatedToggle && !showCollapseAll) return null

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

  // Plain text + outline button — uniform across the row.
  const baseChip =
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium transition-colors'
  const idleChip =
    'border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary'
  const activeChip =
    'bg-primary text-white border-primary hover:bg-primary/90'

  return (
    <div className="flex items-center flex-wrap gap-2 mb-4 text-[12px]">
      {showInitial && (
        <button
          type="button"
          onClick={onJumpToInitial}
          className={cn(baseChip, idleChip)}
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
          className={cn(baseChip, hideAbrogated ? activeChip : idleChip)}
        >
          {hideAbrogated ? (
            <Eye className="w-3.5 h-3.5" aria-hidden />
          ) : (
            <EyeOff className="w-3.5 h-3.5" aria-hidden />
          )}
          {isFr
            ? hideAbrogated
              ? 'Afficher les articles abrogés'
              : 'Masquer les articles et sections abrogés'
            : hideAbrogated
              ? 'Afiche atik abwoje yo'
              : 'Kache atik ak seksyon abwoje yo'}
        </button>
      )}

      {showCollapseAll && (
        <>
          <button
            type="button"
            onClick={onCollapseAll}
            className={cn(baseChip, idleChip)}
          >
            <Minimize2 className="w-3.5 h-3.5" aria-hidden />
            {isFr ? 'Tout fermer' : 'Fèmen tout'}
          </button>
          <button
            type="button"
            onClick={onExpandAll}
            className={cn(baseChip, idleChip)}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden />
            {isFr ? 'Tout ouvrir' : 'Louvri tout'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={copyLink}
        className={cn(baseChip, idleChip, 'ml-auto')}
      >
        <Copy className="w-3.5 h-3.5" aria-hidden />
        {isFr ? 'Copier le lien' : 'Kopye lyen'}
      </button>
    </div>
  )
}
