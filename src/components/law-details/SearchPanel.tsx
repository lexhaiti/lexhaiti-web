'use client'

import React from 'react'
import { PanelLeft, PanelLeftClose, RotateCcw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchPanelProps {
  currentLang: 'fr' | 'ht'
  pageSearchScope: 'sommaire' | 'code'
  pageSearchQuery: string
  onScopeChange: (scope: 'sommaire' | 'code') => void
  onQueryChange: (query: string) => void
  /** Optional sommaire toggle — when both are passed the panel
   *  renders a Voir/Masquer le sommaire chip at the right end of the
   *  search-scope radio row. Desktop only. */
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
  /** Extra content (e.g. the view-mode switcher) rendered inline on
   *  the right end of the radio row, immediately before the sommaire
   *  toggle. Desktop only. */
  rightControls?: React.ReactNode
}

/**
 * Top search panel — scope radio + input.
 * Allows searching within the TOC (sommaire) or the full code.
 */
export function SearchPanel({
  currentLang,
  pageSearchScope,
  pageSearchQuery,
  onScopeChange,
  onQueryChange,
  isSidebarOpen,
  onToggleSidebar,
  rightControls,
}: SearchPanelProps) {
  const showSidebarToggle = onToggleSidebar !== undefined

  return (
    // Top padding on mobile separates this panel from the law hero's
    // bottom edge — the screenshot showed them visually colliding.
    <div className="mb-6 pt-4 lg:pt-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-6 text-sm text-slate-700 dark:text-slate-300 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchScope"
              checked={pageSearchScope === 'sommaire'}
              onChange={() => onScopeChange('sommaire')}
              className="accent-primary"
            />
            <span>
              {currentLang === 'fr'
                ? 'Rechercher dans le sommaire'
                : 'Chèche nan tab matyè'}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchScope"
              checked={pageSearchScope === 'code'}
              onChange={() => onScopeChange('code')}
              className="accent-primary"
            />
            <span>
              {currentLang === 'fr'
                ? 'Rechercher dans tout le code'
                : 'Chèche nan tout kòd la'}
            </span>
          </label>

          {/* Right-side controls — view-mode switcher and sommaire
              toggle. On desktop (lg+) they share the same row as the
              scope radios on the right. Below lg they break onto
              their own row directly under the radios so the
              switcher + sommaire toggle stay reachable on mobile.
              The mobile sommaire toggle here doubles up with the
              floating FAB further down (see TocSidebar) — both lead
              to the same drawer; users with thumbs reach the FAB,
              users at the top of the page reach this inline one. */}
          {(rightControls || showSidebarToggle) && (
            <div className="hidden lg:flex ml-auto items-center gap-3">
              {rightControls}
              {showSidebarToggle && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  aria-pressed={!!isSidebarOpen}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full h-9',
                    'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5',
                    'text-[12px] font-semibold text-slate-600 dark:text-slate-300',
                    'hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-colors',
                  )}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  ) : (
                    <PanelLeft className="w-3.5 h-3.5" />
                  )}
                  {currentLang === 'fr' ? ' Sommaire' : 'Somè'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <input
            type="text"
            value={pageSearchQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={currentLang === 'fr' ? 'Rechercher' : 'Chèche'}
            className={cn(
              'w-full h-11 pl-4 rounded-lg border border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-colors',
              // Right padding grows when the Réinitialiser pill is
              // visible so the pill never overlaps user text.
              pageSearchQuery ? 'pr-[10.5rem]' : 'pr-12',
            )}
          />
          {pageSearchQuery && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className={cn(
                'absolute right-12 top-1/2 -translate-y-1/2',
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1',
                'text-xs font-medium text-primary hover:bg-primary/10',
                'transition-colors',
              )}
              aria-label={
                currentLang === 'fr' ? 'Réinitialiser' : 'Reinisyalize'
              }
            >
              <RotateCcw className="w-3 h-3" />
              {currentLang === 'fr' ? 'Réinitialiser' : 'Reinisyalize'}
            </button>
          )}
          <button
            type="button"
            aria-label={currentLang === 'fr' ? 'Rechercher' : 'Chèche'}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-md bg-primary dark:bg-slate-700 text-white hover:bg-primary/90 dark:hover:bg-slate-600"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile / tablet — view-mode switcher on its own full-width
            row below the search bar. The radios + search bar belong
            visually together (one search affordance), so the switcher
            sits beneath them as a separate control. Hidden at lg+
            because the desktop right-cluster above already carries
            it. The Sommaire toggle moved out of here — on mobile it
            shares a row with the Outils dropdown inside
            DocumentToolbar so the two reader controls cluster. */}
        {rightControls && (
          <div className="lg:hidden">{rightControls}</div>
        )}
      </div>
    </div>
  )
}
