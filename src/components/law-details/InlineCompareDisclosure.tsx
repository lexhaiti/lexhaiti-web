'use client'

/**
 * Inline word-diff "Comparer" disclosure for ArticleListView rows.
 *
 * Same lazy-fetch pattern as InlineVersionsDisclosure — only renders
 * the button when the article actually has comparable history
 * (``version_number > 1``); the version rows + their bodies are
 * fetched on first expand and handed to ComparePanel (which already
 * does the word-level diff between any two selected versions).
 *
 * Kept separate from the versions disclosure on purpose: the user
 * might want to see the timeline without firing up the diff
 * machinery, and vice versa. Each pulls its own data when opened.
 */

import { useState } from 'react'
import { ChevronDown, GitCompare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  listArticleVersions,
  type ArticleVersionRead,
} from '@/lib/api/endpoints'
import { ComparePanel } from './_panels/ComparePanel'

interface Props {
  articleId: number
  versionCount: number
  lang: 'fr' | 'ht'
}

export function InlineCompareDisclosure({
  articleId,
  versionCount,
  lang,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ArticleVersionRead[]>([])
  const [error, setError] = useState<string | null>(null)

  const isFr = lang === 'fr'

  async function ensureLoaded() {
    if (loaded || loading) return
    setLoading(true)
    setError(null)
    try {
      const fetched = await listArticleVersions(articleId)
      // Newest-first — matches the convention used by the focused
      // ArticleViewer so the dropdowns inside ComparePanel default
      // to the same ordering across surfaces.
      setRows([...fetched].reverse())
      setLoaded(true)
    } catch {
      setError(
        isFr
          ? 'Impossible de charger les versions à comparer.'
          : 'Pa kapab chaje vèsyon pou konpare.',
      )
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) void ensureLoaded()
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-semibold transition-colors',
          'text-slate-600 hover:text-primary hover:bg-slate-100',
        )}
      >
        <GitCompare className="w-3.5 h-3.5" aria-hidden />
        {isFr ? 'Comparer les versions' : 'Konpare vèsyon yo'}
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {isFr ? 'Chargement…' : 'Chajman…'}
            </div>
          )}
          {error && <p className="text-xs text-red-600 py-2">{error}</p>}
          {!loading && !error && loaded && rows.length >= 2 && (
            <ComparePanel versions={rows} currentLang={lang} />
          )}
          {!loading && !error && loaded && rows.length < 2 && (
            <p className="text-xs italic text-slate-400 py-2">
              {isFr
                ? 'Au moins deux versions sont nécessaires pour comparer.'
                : 'Pou konpare, ou bezwen omwen de vèsyon.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
