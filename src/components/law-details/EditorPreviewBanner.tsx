'use client'

import React from 'react'
import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface EditorPreviewBannerProps {
  isPublicPreview: boolean
  currentLang: 'fr' | 'ht'
  searchParams: URLSearchParams | null
}

/**
 * Sticky banner for signed-in editors showing current view mode
 * (editor vs public preview). Lets the editor preview the page
 * exactly as anonymous visitors see it by flipping a ``?view=public``
 * URL flag. Bookmarkable + survives refresh.
 */
export function EditorPreviewBanner({
  isPublicPreview,
  currentLang,
  searchParams,
}: EditorPreviewBannerProps) {
  return (
    <div
      className={cn(
        'sticky top-20 z-30 border-b backdrop-blur-md',
        isPublicPreview
          ? 'bg-amber-50/95 border-amber-200'
          : 'bg-emerald-50/95 border-emerald-200',
      )}
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-2 flex items-center justify-between gap-3">
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2',
            isPublicPreview ? 'text-amber-800' : 'text-emerald-800',
          )}
        >
          {isPublicPreview ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              {currentLang === 'fr'
                ? 'Aperçu public — édition désactivée'
                : 'Apèsi piblik — edisyon dezaktive'}
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5" />
              {currentLang === 'fr' ? 'Vue éditeur' : 'Vi editè'}
            </>
          )}
        </span>
        <Link
          href={
            isPublicPreview
              ? `?` +
                new URLSearchParams(
                  Object.fromEntries(
                    Array.from(searchParams?.entries() ?? []).filter(
                      ([k]) => k !== 'view',
                    ),
                  ),
                ).toString()
              : `?${new URLSearchParams({
                  ...Object.fromEntries(searchParams?.entries() ?? []),
                  view: 'public',
                }).toString()}`
          }
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            isPublicPreview
              ? 'bg-amber-900 text-white hover:bg-amber-950'
              : 'bg-emerald-900 text-white hover:bg-emerald-950',
          )}
        >
          {isPublicPreview ? (
            <>
              <Pencil className="w-3 h-3" />
              {currentLang === 'fr'
                ? 'Revenir à l’édition'
                : 'Retounen nan edisyon'}
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              {currentLang === 'fr'
                ? 'Aperçu public'
                : 'Apèsi piblik'}
            </>
          )}
        </Link>
      </div>
    </div>
  )
}
