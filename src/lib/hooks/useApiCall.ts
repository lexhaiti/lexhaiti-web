'use client'

import { useCallback, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/client'
import { useToast } from '@/components/ui/toast-simple'

/* ---------- types ---------- */

type ErrorFormatter = (error: unknown) => string

/**
 * Default error message extractor.
 *
 * Priority: ApiError.body.detail → Error.message → generic string.
 * Appends `(status)` for ApiError instances.
 */
function defaultFormat(err: unknown): string {
  if (err instanceof ApiError) {
    const detail =
      typeof (err.body as Record<string, unknown>)?.detail === 'string'
        ? ((err.body as Record<string, unknown>).detail as string)
        : err.message
    return `${detail} (${err.status})`
  }
  if (err instanceof Error) return err.message
  return String(err)
}

/* ---------- hook ---------- */

interface UseApiCallOptions {
  /** Custom function to format error messages for the toast. */
  formatError?: ErrorFormatter

  /** Toast message shown on success (optional — no toast if omitted). */
  successMessage?: string

  /**
   * If `true`, swallows the error after toasting instead of re-throwing.
   * Default: `true` (most UI mutations don't propagate further).
   */
  swallow?: boolean
}

interface UseApiCallReturn<TArgs extends unknown[], TResult> {
  /** Wrapped async function — call it like the original, errors are handled. */
  run: (...args: TArgs) => Promise<TResult | undefined>
  /** `true` while the call is in-flight. */
  loading: boolean
  /** Last error instance (reset on next successful run). */
  error: unknown
}

/**
 * Wraps an async API mutation with automatic loading state + error-to-toast.
 *
 * @example
 * ```tsx
 * const { run: deleteText, loading } = useApiCall(
 *   (slug: string) => deleteEditorialText(slug),
 *   { successMessage: 'Supprimé' }
 * )
 *
 * <button onClick={() => deleteText('some-slug')} disabled={loading}>
 *   Supprimer
 * </button>
 * ```
 */
export function useApiCall<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: UseApiCallOptions = {},
): UseApiCallReturn<TArgs, TResult> {
  const { formatError = defaultFormat, successMessage, swallow = true } = options
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // Stable ref so the hook doesn't depend on `fn` identity.
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setLoading(true)
      setError(null)
      try {
        const result = await fnRef.current(...args)
        if (successMessage) toast(successMessage)
        return result
      } catch (e) {
        setError(e)
        toast(formatError(e))
        if (!swallow) throw e
        return undefined
      } finally {
        setLoading(false)
      }
    },
    [toast, formatError, successMessage, swallow],
  )

  return { run, loading, error }
}
