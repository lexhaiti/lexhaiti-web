'use client'

/**
 * Lazy fetch V1 of every article in a law that has version history,
 * keyed by article id. Powers the "Accéder à la version initiale"
 * toolbar mode without a new backend endpoint: each amended article
 * gets a single ``listArticleVersions(id)`` call (same endpoint the
 * Comparer button already hits) and the result is cached per
 * article for the rest of the session.
 *
 * Performance: requests for all amended articles fire in parallel
 * on first activation. For Constitution 1987 that's ~55 requests
 * which complete in well under a second on a local backend; on a
 * slow connection the UI shows a small loading state via
 * ``isLoading`` so the user knows V1 hasn't fully populated yet.
 *
 * The hook accepts the current ``articles`` array and a controlled
 * ``enabled`` flag. It only fetches when enabled flips to true the
 * first time. Toggle "off" doesn't clear the cache so re-toggle is
 * instant.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { listArticleVersions } from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type ArticleEmbed = components['schemas']['ArticleEmbed']
type ArticleVersionRead = components['schemas']['ArticleVersionRead']

export interface V1Body {
  articleId: number
  text_fr: string | null
  text_ht: string | null
  title_fr: string | null
  title_ht: string | null
  effective_from: string | null
}

export function useInitialVersions(
  articles: ArticleEmbed[],
  enabled: boolean,
): {
  /** Map: article.id → V1 body. Articles with only one version are
   *  NOT in the map — the caller should fall back to their current
   *  text (which IS V1 by definition). */
  v1ById: Map<number, V1Body>
  isLoading: boolean
  error: string | null
} {
  const [v1ById, setV1ById] = useState<Map<number, V1Body>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef<Set<number>>(new Set())

  // Stable list of ids that need V1 — only the ones with multiple
  // versions; v1-only articles are already showing their initial
  // text via ``content_fr / content_ht``.
  const amendedIds = articles
    .filter((a) => (a.version_number ?? 1) > 1)
    .map((a) => a.id)
    .filter((id): id is number => id != null)
  const amendedKey = amendedIds.join(',')

  const fetchAll = useCallback(async () => {
    const toFetch = amendedIds.filter((id) => !fetchedRef.current.has(id))
    if (toFetch.length === 0) return
    setIsLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        toFetch.map(async (id) => {
          try {
            const versions = await listArticleVersions(id)
            return { id, versions }
          } catch {
            return { id, versions: null as ArticleVersionRead[] | null }
          }
        }),
      )
      setV1ById((prev) => {
        const next = new Map(prev)
        for (const { id, versions } of results) {
          fetchedRef.current.add(id)
          if (!versions || versions.length === 0) continue
          // ``listArticleVersions`` returns the rows sorted by
          // version_number ascending — V1 is therefore versions[0].
          const v1 = versions.find((v) => v.version_number === 1)
          if (!v1) continue
          next.set(id, {
            articleId: id,
            text_fr: v1.text_fr ?? null,
            text_ht: v1.text_ht ?? null,
            title_fr: v1.title_fr ?? null,
            title_ht: v1.title_ht ?? null,
            effective_from: v1.effective_from ?? null,
          })
        }
        return next
      })
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amendedKey])

  useEffect(() => {
    if (!enabled) return
    void fetchAll()
  }, [enabled, fetchAll])

  return { v1ById, isLoading, error }
}
