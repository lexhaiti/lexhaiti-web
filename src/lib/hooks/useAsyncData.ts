'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* ---------- types ---------- */

interface UseAsyncDataReturn<T> {
  /** Fetched data (`undefined` until the first successful load). */
  data: T | undefined
  /** `true` during both the initial fetch and subsequent refetches. */
  loading: boolean
  /** Last error (reset on next successful fetch). */
  error: unknown
  /** Call to manually trigger a re-fetch. */
  refetch: () => void
}

interface UseAsyncDataOptions {
  /**
   * When `false`, skip the initial fetch (useful for conditional loading).
   * Default: `true`.
   */
  enabled?: boolean
}

/**
 * Declarative data-fetching hook with loading / error states.
 *
 * Replaces the common pattern:
 * ```ts
 * const [data, setData] = useState()
 * const [loading, setLoading] = useState(false)
 * useEffect(() => { setLoading(true); fetch().then(setData).finally(() => setLoading(false)) }, [deps])
 * ```
 *
 * @param fetchFn — Async function returning the data. Called on mount and when
 *                  `deps` change.
 * @param deps    — React dependency array (like `useEffect` deps). When any
 *                  value changes, `fetchFn` is re-invoked.
 * @param options — `{ enabled }` to conditionally skip fetching.
 *
 * @example
 * ```tsx
 * const { data: texts, loading } = useAsyncData(
 *   () => listTexts({ limit: 50 }),
 *   [page],
 * )
 * ```
 */
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncDataOptions = {},
): UseAsyncDataReturn<T> {
  const { enabled = true } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)

  // Keep fetchFn in a ref so identity changes don't re-trigger.
  const fnRef = useRef(fetchFn)
  fnRef.current = fetchFn

  // Track the latest request to avoid stale-data races.
  const seqRef = useRef(0)

  const execute = useCallback(() => {
    if (!enabled) return

    const seq = ++seqRef.current
    setLoading(true)
    setError(null)

    fnRef
      .current()
      .then((result) => {
        if (seq === seqRef.current) setData(result)
      })
      .catch((e) => {
        if (seq === seqRef.current) setError(e)
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps])

  useEffect(() => {
    execute()
  }, [execute])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, refetch }
}
