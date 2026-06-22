import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getTextBySlug } from '@/lib/api/endpoints'
import { ApiError } from '@/lib/api/client'

interface Props {
  children: ReactNode
  params: Promise<{ slug: string }>
}

/**
 * Existence gate for the law-detail route.
 *
 * This runs ABOVE the page's `loading.tsx` Suspense boundary. A layout's async
 * work is buffered (Next streams no fallback for it), so a `notFound()` here
 * produces a real HTTP 404. The same check inside the page — behind
 * `loading.tsx` — streams a 200 shell first and pins the status at 200 (a
 * soft-404 that Google flags). So the existence decision lives here; the page
 * keeps its skeleton.
 *
 * The light read (`include` omitted) is deduplicated with the identical fetch
 * in `generateMetadata`, so this adds no extra round-trip. The page then loads
 * the FULL text (`include=all`) inside the Suspense boundary, where
 * `loading.tsx` shows the skeleton for real laws.
 */
export default async function LoiSlugLayout({ children, params }: Props) {
  const { slug } = await params
  try {
    await getTextBySlug(slug)
  } catch (err) {
    // Genuine 404 → real 404. A transient/backend error is NOT a 404: fall
    // through and let the page (and its error boundary) handle it, so a healthy
    // law is never de-indexed over a hiccup.
    if (err instanceof ApiError && err.status === 404) notFound()
  }
  return children
}
