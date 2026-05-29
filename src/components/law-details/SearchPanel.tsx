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
    <div className="mb-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-6 text-sm text-slate-700 flex-wrap">
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
              toggle share the row's right edge so the page-level
              chrome (which slice to read, sommaire on/off) lives
              alongside the scope radios it complements. Desktop
              only; mobile keeps the accordion toggle inside
              TocSidebar. */}
          {(rightControls || showSidebarToggle) && (
            <div className="ml-auto hidden lg:flex items-center gap-3">
              {rightControls}
              {showSidebarToggle && (
                // Static label, but the icon flips on open/close so it
                // still signals state at a glance (panel-open vs panel-
                // closed glyph). ``h-9`` + ``text-[12px]`` match the
                // ViewModeSwitcher pill so the two read as a set.
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  aria-pressed={!!isSidebarOpen}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full h-9',
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
              'w-full h-11 pl-4 rounded-lg border border-gray-300 bg-gray-50 text-sm text-slate-800',
              'placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-colors',
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
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
