'use client'

/**
 * Document toolbar — small action strip at the top
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
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  LinkIcon,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast-simple'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ViewAsOfDate = 'today' | 'initial'

interface DocumentToolbarProps {
  lang: 'fr' | 'ht'
  /** Active "view-as-of-date" mode: 'today' renders the in-force
   *  state of every article (default on first load), 'initial'
   *  renders each amended article in its V1 form. The buttons share
   *  the same controlled state so the active button paints navy. */
  viewAsOfDate?: ViewAsOfDate
  onChangeViewAsOfDate?: (next: ViewAsOfDate) => void
  /** Opens the "Voir les versions dans le temps" accordion panel
   *  below the toolbar. The parent owns the open/closed state so
   *  the button can show the active highlight. */
  chronoOpen?: boolean
  onToggleChrono?: () => void
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
  viewAsOfDate,
  onChangeViewAsOfDate,
  chronoOpen,
  onToggleChrono,
  hideAbrogated,
  onToggleHideAbrogated,
  onCollapseAll,
  onExpandAll,
}: DocumentToolbarProps) {
  const { toast } = useToast()
  const isFr = lang === 'fr'

  const showViewAsOf = !!onChangeViewAsOfDate
  const showChrono = !!onToggleChrono
  const showAbrogatedToggle = onToggleHideAbrogated !== undefined
  const showCollapseAll = !!onCollapseAll && !!onExpandAll
  if (
    !showViewAsOf &&
    !showChrono &&
    !showAbrogatedToggle &&
    !showCollapseAll
  ) {
    return null
  }

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

  // Plain text + outline button — uniform across the row. Pill radius
  // (rounded-full) matches the article-viewer navigation / share
  // buttons so the whole reader chrome reads as one button family.
  const baseChip =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors whitespace-nowrap shrink-0'
  const idleChip =
    'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary'
  const activeChip =
    'bg-primary dark:bg-slate-700 text-white border-primary dark:border-slate-600 hover:bg-primary/90 dark:hover:bg-slate-600'

  // Mobile: collapse the 7-chip strip into a single "Outils" /
  // "Zouti" dropdown so the user doesn't have to swipe horizontally
  // through a one-line scroll buffet to find the right action. The
  // active states (Aujourd'hui vs Initiale, Masquer abrogés on/off)
  // are surfaced inline via a check icon on the active row.
  const abrogatedLabel = isFr
    ? hideAbrogated
      ? 'Afficher les articles abrogés'
      : 'Masquer les articles et sections abrogés'
    : hideAbrogated
      ? 'Afiche atik abwoje yo'
      : 'Kache atik ak seksyon abwoje yo'

  return (
    <>
      {/* Mobile (below sm): single dropdown trigger that opens the
          stacked action list. Removes the horizontal-scroll strip
          per user feedback — easier to find an action when each row
          is full-width and tap-sized. */}
      <div className="sm:hidden mt-3 mb-5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-2 rounded-full border h-9 px-4',
                'text-[12px] font-medium',
                'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                'hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-colors',
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
              {isFr ? 'Outils' : 'Zouti'}
              <ChevronDown className="w-3.5 h-3.5 opacity-60" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[260px]">
            {showViewAsOf && (
              <>
                <DropdownMenuItem
                  onClick={() => onChangeViewAsOfDate('today')}
                >
                  <CalendarDays className="w-4 h-4" aria-hidden />
                  <span className="flex-1">
                    {isFr
                      ? "Version à la date d'aujourd'hui"
                      : "Vèsyon nan dat jodi a"}
                  </span>
                  {viewAsOfDate === 'today' && (
                    <Check className="w-4 h-4 text-primary" aria-hidden />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onChangeViewAsOfDate('initial')}
                >
                  <LinkIcon className="w-4 h-4" aria-hidden />
                  <span className="flex-1">
                    {isFr
                      ? 'Accéder à la version initiale'
                      : 'Ale nan vèsyon orijinal la'}
                  </span>
                  {viewAsOfDate === 'initial' && (
                    <Check className="w-4 h-4 text-primary" aria-hidden />
                  )}
                </DropdownMenuItem>
                {(showChrono || showAbrogatedToggle || showCollapseAll) && (
                  <DropdownMenuSeparator />
                )}
              </>
            )}
            {showChrono && (
              <DropdownMenuItem onClick={onToggleChrono}>
                <CalendarClock className="w-4 h-4" aria-hidden />
                <span className="flex-1">
                  {isFr
                    ? 'Voir les versions dans le temps'
                    : 'Wè vèsyon yo nan tan'}
                </span>
                {chronoOpen && (
                  <Check className="w-4 h-4 text-primary" aria-hidden />
                )}
              </DropdownMenuItem>
            )}
            {showAbrogatedToggle && (
              <DropdownMenuItem onClick={onToggleHideAbrogated}>
                {hideAbrogated ? (
                  <Eye className="w-4 h-4" aria-hidden />
                ) : (
                  <EyeOff className="w-4 h-4" aria-hidden />
                )}
                <span className="flex-1">{abrogatedLabel}</span>
              </DropdownMenuItem>
            )}
            {showCollapseAll && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExpandAll}>
                  <Maximize2 className="w-4 h-4" aria-hidden />
                  <span className="flex-1">
                    {isFr ? 'Tout ouvrir' : 'Louvri tout'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCollapseAll}>
                  <Minimize2 className="w-4 h-4" aria-hidden />
                  <span className="flex-1">
                    {isFr ? 'Tout fermer' : 'Fèmen tout'}
                  </span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyLink}>
              <Copy className="w-4 h-4" aria-hidden />
              <span className="flex-1">
                {isFr ? 'Copier le lien' : 'Kopye lyen'}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tablet / desktop (sm+): existing chip strip. */}
      <div
        className={cn(
          'hidden sm:flex items-center gap-2 text-[12px]',
          'flex-wrap mt-3 mb-5',
        )}
      >
      {showViewAsOf && (
        <>
          <button
            type="button"
            onClick={() => onChangeViewAsOfDate('today')}
            aria-pressed={viewAsOfDate === 'today'}
            className={cn(
              baseChip,
              viewAsOfDate === 'today' ? activeChip : idleChip,
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" aria-hidden />
            {isFr
              ? "Version à la date d'aujourd'hui"
              : "Vèsyon nan dat jodi a"}
          </button>
          <button
            type="button"
            onClick={() => onChangeViewAsOfDate('initial')}
            aria-pressed={viewAsOfDate === 'initial'}
            className={cn(
              baseChip,
              viewAsOfDate === 'initial' ? activeChip : idleChip,
            )}
          >
            <LinkIcon className="w-3.5 h-3.5" aria-hidden />
            {isFr
              ? 'Accéder à la version initiale'
              : 'Ale nan vèsyon orijinal la'}
          </button>
        </>
      )}

      {showChrono && (
        <button
          type="button"
          onClick={onToggleChrono}
          aria-expanded={!!chronoOpen}
          className={cn(baseChip, chronoOpen ? activeChip : idleChip)}
        >
          <CalendarClock className="w-3.5 h-3.5" aria-hidden />
          {isFr
            ? 'Voir les versions dans le temps'
            : 'Wè vèsyon yo nan tan'}
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
        className={cn(baseChip, idleChip)}
      >
        <Copy className="w-3.5 h-3.5" aria-hidden />
        {isFr ? 'Copier le lien' : 'Kopye lyen'}
      </button>
    </div>
    </>
  )
}
