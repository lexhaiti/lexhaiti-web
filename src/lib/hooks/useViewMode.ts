'use client'

/**
 * Stateful hook for the law-detail page's "view mode" — which slice of
 * the law the user wants to read at any given moment.
 *
 * Resolution priority (highest first):
 *   1. URL ``?view=tous|chapitre|article`` query param. If present and
 *      currently available (e.g. ``chapitre`` only available when the
 *      law has chapters), it wins. This makes shared links survive.
 *   2. localStorage ``lexhaiti.viewMode`` — power-user preference.
 *   3. Smart default based on whether the user arrived with a
 *      ``?article=N`` deep link: deep link ⇒ ``article``, otherwise
 *      ``tous`` (matches today's behavior).
 *
 * Setting a mode writes both URL (replaceState — no history entry per
 * click) and localStorage. Returns ``[mode, setMode, available]``.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import type { ViewMode } from '@/lib/legal/shape'

const STORAGE_KEY = 'lexhaiti.viewMode'

function isValidMode(v: string | null | undefined): v is ViewMode {
  return v === 'tous' || v === 'chapitre' || v === 'article'
}

function readStored(): ViewMode | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return isValidMode(v) ? v : null
  } catch {
    // ``localStorage`` access can throw in private modes or sandboxed
    // contexts — swallow and fall back to the smart default.
    return null
  }
}

function writeStored(mode: ViewMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export interface UseViewModeOptions {
  /** Which modes are valid for this particular legal text — depends on
   *  the shape (e.g. flat texts can't pick ``chapitre``). */
  available: ViewMode[]
  /** ``true`` when the user landed with ``?article=N`` — used to bias
   *  the smart default toward ``article`` mode. */
  hasDeepLink: boolean
}

export function useViewMode({
  available,
  hasDeepLink,
}: UseViewModeOptions): [ViewMode, (next: ViewMode) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlValue = searchParams?.get('view') ?? null

  // Initial resolution — runs once on mount; SSR-safe because we don't
  // touch ``localStorage`` until ``useEffect`` fires below.
  const initial = useMemo<ViewMode>(() => {
    if (isValidMode(urlValue) && available.includes(urlValue)) {
      return urlValue
    }
    return hasDeepLink && available.includes('article') ? 'article' : 'tous'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [mode, setModeState] = useState<ViewMode>(initial)

  // After hydration, upgrade from the initial guess to the stored
  // value if (and only if) the URL didn't override.
  useEffect(() => {
    if (isValidMode(urlValue) && available.includes(urlValue)) return
    const stored = readStored()
    if (stored && available.includes(stored) && stored !== mode) {
      setModeState(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep mode in sync with URL changes (back/forward buttons).
  useEffect(() => {
    if (isValidMode(urlValue) && available.includes(urlValue) && urlValue !== mode) {
      setModeState(urlValue)
    }
  }, [urlValue, available, mode])

  // Drop the URL ``view`` param if the chosen mode isn't available
  // for this law (e.g. the user lands with ``?view=chapitre`` on a
  // flat décret without chapters). Skip when ``available`` is empty
  // — that means the law is still loading; we'd otherwise strip a
  // valid ``view=article`` before the shape settles and the param
  // would be lost forever.
  useEffect(() => {
    if (available.length === 0) return
    if (urlValue && !available.includes(urlValue as ViewMode)) {
      const next = new URLSearchParams(searchParams?.toString() ?? '')
      next.delete('view')
      router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, {
        scroll: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue, available])

  const setMode = useCallback(
    (next: ViewMode) => {
      if (!available.includes(next)) return
      setModeState(next)
      writeStored(next)
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('view', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [available, pathname, router, searchParams],
  )

  return [mode, setMode]
}
