'use client'

/**
 * Compact tools bar that pins to the very top of the viewport while
 * the reader scrolls a law's body — taking the place of the global
 * header, which slides away (see ReaderChromeContext). It re-exposes
 * the page chrome the reader keeps reaching for: the view-mode
 * switcher (Tous / Par titre / Un article), a Sommaire toggle, and
 * the document actions (version à la date, version initiale, voir les
 * versions, masquer abrogés, tout fermer / ouvrir).
 *
 * Layout-only: the parent (LawDetail) builds the switcher + toolbar
 * elements with their handlers and passes them in, so this component
 * owns nothing but the pinned shell + the sommaire button + the
 * horizontal-scroll behaviour on narrow screens.
 */

import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Pinned + visible when true; slid up out of view otherwise. */
  active: boolean
  lang: 'fr' | 'ht'
  /** The ViewModeSwitcher element (or null when the law has no real
   *  choice of view). */
  switcher?: React.ReactNode
  /** A compact DocumentToolbar element (or null). */
  toolbar?: React.ReactNode
  /** When provided, render a Sommaire toggle between the switcher and
   *  the toolbar. */
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export function StickyReaderBar({
  active,
  lang,
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
        'fixed inset-x-0 top-0 z-50 border-b border-slate-200',
        'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85',
        'shadow-[0_2px_10px_-6px_rgba(15,23,42,0.25)]',
        'transition-transform duration-300 ease-out',
        active ? 'translate-y-0' : '-translate-y-full pointer-events-none',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-2',
          'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {switcher && <div className="flex-shrink-0">{switcher}</div>}

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

        {toolbar && <div className="flex-shrink-0">{toolbar}</div>}
      </div>
    </div>
  )
}
