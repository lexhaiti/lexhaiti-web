'use client'

import React from 'react'
import { PanelLeft, PanelLeftClose, RotateCcw, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast-simple'

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
}

/**
 * Top search panel -- Legifrance-style scope radio + input.
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
}: SearchPanelProps) {
  const { toast } = useToast()
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
              onChange={() => {
                onScopeChange('code')
                toast(
                  currentLang === 'fr'
                    ? 'Recherche plein-texte bientôt disponible'
                    : 'Rechèch plen tèks talè konsa',
                )
              }}
              className="accent-primary"
            />
            <span>
              {currentLang === 'fr'
                ? 'Rechercher dans tout le code'
                : 'Chèche nan tout kòd la'}
            </span>
          </label>

          {/* Voir / Masquer le sommaire — right-aligned on the same
              row as the search-scope radios so the toggle sits at
              the level it controls (search-in-sommaire). Desktop
              only; mobile keeps the accordion toggle inside
              TocSidebar. */}
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-pressed={!!isSidebarOpen}
              className={cn(
                'ml-auto hidden lg:inline-flex items-center gap-2 rounded-full',
                'border border-slate-200 bg-white px-3.5 py-1.5',
                'text-xs font-semibold text-slate-600',
                'hover:border-primary hover:text-primary transition-colors',
              )}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeft className="w-3.5 h-3.5" />
              )}
              {currentLang === 'fr'
                ? isSidebarOpen
                  ? 'Masquer le sommaire'
                  : 'Voir le sommaire'
                : isSidebarOpen
                  ? 'Kache somè a'
                  : 'Wè somè a'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={pageSearchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={
                currentLang === 'fr' ? 'Rechercher' : 'Chèche'
              }
              className="w-full h-11 pl-4 pr-12 rounded-lg border border-gray-300 bg-gray-50 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white transition-colors"
            />
            <button
              type="button"
              aria-label={
                currentLang === 'fr' ? 'Rechercher' : 'Chèche'
              }
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          {pageSearchQuery && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <RotateCcw className="w-3 h-3" />
              {currentLang === 'fr' ? 'Réinitialiser' : 'Reinisyalize'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
