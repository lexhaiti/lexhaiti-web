'use client'

import { useCallback, useEffect, useState } from 'react'
import type { components } from '@/lib/api-types'
import {
  getEditorialTextBySlug,
  getTextBySlug,
} from '@/lib/api/endpoints'
import { useEditorMode } from '@/lib/hooks/useEditorMode'

type LegalTextRead = components['schemas']['LegalTextRead']

export function useLawDetail(
  slug: string,
  initialData?: LegalTextRead | null,
) {
  const { isEditor } = useEditorMode()
  const [data, setData] = useState<LegalTextRead | null>(initialData ?? null)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >(initialData ? 'success' : 'idle')
  const [error, setError] = useState<Error | null>(null)

  const fetchLaw = useCallback(async () => {
    if (!slug) return

    setStatus('loading')
    setError(null)

    try {
      // Editor mode hits the editorial endpoint so drafts are visible.
      const res = isEditor
        ? await getEditorialTextBySlug(slug, 'all')
        : await getTextBySlug(slug, 'all')
      setData(res)
      setStatus('success')
    } catch (e) {
      setStatus('error')
      setError(
        e instanceof Error ? e : new Error('Failed to fetch law details'),
      )
    }
  }, [slug, isEditor])

  useEffect(() => {
    // Public reads are SSR-seeded (the law text is in the server HTML for
    // SEO and renders with no skeleton flash); only fetch when there is no
    // seed, or when an editor needs drafts via the editorial endpoint.
    if (initialData == null || isEditor) fetchLaw()
  }, [fetchLaw, initialData, isEditor])

  return {
    data,
    status,
    error,
    isLoading: status === 'loading',
    isError: status === 'error',
    refetch: fetchLaw,
  }
}
