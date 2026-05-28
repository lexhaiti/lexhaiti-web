'use client'

/**
 * Compact tools bar that pins to the top of the viewport while the
 * reader scrolls a law's body — taking the place of the global header,
 * which slides away (see ReaderChromeContext).
 *
 * Two-row layout (Légifrance-style):
 *   Row 1 — the law's title (left) and, right-aligned, the view-mode
 *           switcher (Tous / Par titre / Un article) plus the Sommaire
 *           toggle.
 *   Row 2 — the DocumentToolbar actions (version à la date, version
 *           initiale, versions dans le temps, masquer abrogés, tout
 *           fermer / ouvrir).
 *
 * Layout-only: the parent (LawDetail) builds the switcher + toolbar
 * elements with their handlers and passes them in. On narrow screens
 * each row scrolls horizontally rather than wrapping, so the bar stays
 * short; the title is dropped under `sm` where the controls already
 * fill the row.
 */

import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Pinned + visible when true; slid up out of view otherwise. */
  active: boolean
  lang: 'fr' | 'ht'
  /** Law title shown left-aligned on the first row (sm+ only). */
  title?: string
  /** Dynamic status label (e.g. « En vigueur », « Abrogée »), rendered
   *  as a pill next to the title. Driven by the law's own status. */
  statusText?: string
  /** Tailwind classes for the status pill (light-surface bg/text/border
   *  — see TEXT_STATUS_PILL_LIGHT). */
  statusClassName?: string
  /** The ViewModeSwitcher element (or null when the law has no real
   *  choice of view). */
  switcher?: React.ReactNode
  /** A compact DocumentToolbar element (or null). */
  toolbar?: React.ReactNode
  /** When provided, render a Sommaire toggle on the first row. */
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function StickyReaderBar({
  active,
  lang,
  title,
  statusText,
  statusClassName,
  switcher,
  toolbar,
  isSidebarOpen,
  onToggleSidebar,
}: Props) {
  const isFr = lang === 'fr'
  return (
    <div
      aria-hidden={!active}
      className={cn(
        // Subtle gray surface (+ border + soft shadow) so the bar reads
        // as a distinct toolbar lifted off the white reading column.
        'fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-slate-100',
        'shadow-[0_2px_10px_-6px_rgba(15,23,42,0.25)]',
        // Sequenced handoff with the global header: when activating, wait
        // (delay) for the header to slide up first; when deactivating,
        // leave immediately so the header can return after.
        'transition-transform duration-200 ease-out',
        active
          ? 'translate-y-0 delay-200'
          : '-translate-y-full delay-0 pointer-events-none',
      )}
    >
      <div className="px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        {/* Row 1 — title (left) · switcher + sommaire (right). */}
        <div
          className={cn(
            'flex items-center gap-3 py-2',
            'overflow-x-auto sm:overflow-visible',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {title && (
            <p className="hidden sm:block min-w-0 max-w-[40%] truncate text-sm font-semibold text-slate-800">
              {title}
            </p>
          )}

          {statusText && (
            <span
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                'text-xs font-semibold whitespace-nowrap',
                statusClassName,
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
                aria-hidden
              />
              {statusText}
            </span>
          )}

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            {switcher}

            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-pressed={!!isSidebarOpen}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full h-9 flex-shrink-0',
                  'border border-slate-200 bg-white px-3.5',
                  'text-[12px] font-semibold text-slate-600',
                  'hover:border-primary hover:text-primary transition-colors',
                )}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose className="w-3.5 h-3.5" />
                ) : (
                  <PanelLeft className="w-3.5 h-3.5" />
                )}
                {isFr ? 'Voir le sommaire' : 'Wè somè'}
              </button>
            )}
          </div>
        </div>

        {/* Row 2 — document actions. Hairline divider echoes the
            two-line structure; scrolls horizontally on narrow screens. */}
        {toolbar && (
          <div
            className={cn(
              'flex items-center',
              'border-t border-slate-200 pt-2 pb-2',
              'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            {/* ml-auto right-aligns the actions when they fit; when they
                overflow (narrow screens) it collapses to 0 so the strip
                still scrolls from the start rather than clipping the
                left-most chips (the justify-end + overflow pitfall). */}
            <div className="ml-auto flex items-center">{toolbar}</div>
          </div>
        )}
      </div>
    </div>
  )
}
