'use client'

/**
 * Per-row disclosure for showing an article's version timeline inline
 * in the ArticleListView (Tous / Par chapitre views).
 *
 * Why lazy-fetch? The list view can render hundreds of articles. We
 * can't pre-fetch versions for all of them — that's N+1 requests on
 * the cold load. Instead, each row shows a small "N versions" button
 * (only when the article actually has history, i.e. ``version_number
 * > 1``); the request fires on first expand and the result is cached
 * per-row for the rest of the session.
 *
 * Renders the existing ``VersionsPanel`` once data is in. That panel
 * already handles the dot-and-line timeline, the "Modifié par" link,
 * and the editor-only delete-version affordance. We just pass the
 * mapped ``VersionEntry[]``.
 */

import { useState } from 'react'
import { ChevronDown, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listArticleVersions } from '@/lib/api/endpoints'
import {
  VersionsPanel,
  type VersionEntry,
} from './_panels/VersionsPanel'

interface Props {
  articleId: number
  versionCount: number
  /** Date fallback for v1 rows that don't carry their own
   *  effective_from. Matches the existing VersionsPanel contract. */
  defaultFromDate?: string | null
  lang: 'fr' | 'ht'
}

export function InlineVersionsDisclosure({
  articleId,
  versionCount,
  defaultFromDate,
  lang,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<VersionEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const isFr = lang === 'fr'

  async function ensureLoaded() {
    if (loaded || loading) return
    setLoading(true)
    setError(null)
    try {
      const rows = await listArticleVersions(articleId)
      const mapped: VersionEntry[] = [...rows]
        .sort((a, b) => a.version_number - b.version_number)
        .map<VersionEntry>((v) => {
          const amendingSlug = v.source_amendment_slug ?? null
          const amendingTitle =
            (lang === 'ht' && (v as any).source_amendment_title_ht
              ? (v as any).source_amendment_title_ht
              : v.source_amendment_title_fr) ?? null
          return {
            id: v.id,
            version: v.version_number,
            status: v.status,
            effective_from: v.effective_from ?? '',
            effective_to: v.effective_to ?? null,
            amended_by: amendingTitle,
            href: amendingSlug ? `/loi/${amendingSlug}` : null,
          }
        })
        .reverse() // newest first
      setEntries(mapped)
      setLoaded(true)
    } catch (e) {
      setError(
        isFr
          ? 'Impossible de charger les versions.'
          : 'Pa kapab chaje vèsyon yo.',
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
    <div className="mt-4 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-semibold transition-colors',
          'text-slate-600 hover:text-primary hover:bg-slate-100',
        )}
      >
        <Clock className="w-3.5 h-3.5" aria-hidden />
        {isFr
          ? `${versionCount} version${versionCount > 1 ? 's' : ''}`
          : `${versionCount} vèsyon`}
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {isFr ? 'Chargement de l’historique…' : 'Chajman istwa…'}
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 py-2">{error}</p>
          )}
          {!loading && !error && loaded && (
            <VersionsPanel
              versions={entries}
              currentLang={lang}
              defaultFromDate={defaultFromDate ?? null}
            />
          )}
        </div>
      )}
    </div>
  )
}
