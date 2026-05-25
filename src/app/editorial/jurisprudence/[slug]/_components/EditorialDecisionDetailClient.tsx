'use client'

/**
 * Editor-only wrapper around the public DecisionDetailClient. Fetches
 * via the editorial endpoint (so drafts come back), gates on the
 * useEditorMode hook, and overlays the DecisionEditorBar with the edit
 * sheet + publish/delete affordances.
 *
 * The route lives at /editorial/jurisprudence/[slug] so the public
 * /jurisprudence/[slug] stays public-only (drafts 404 there).
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import DecisionDetailClient from '@/app/jurisprudence/[slug]/_components/DecisionDetailClient'
import { DecisionEditorBar } from '@/components/jurisprudence/DecisionEditorBar'
import { useT } from '@/i18n/useT'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { ApiError } from '@/lib/api/client'
import {
  getDecisionBySlug,
  getEditorialDecisionBySlug,
  type DecisionDetail,
} from '@/lib/api/endpoints'
import Link from 'next/link'

interface Props {
  slug: string
}

export default function EditorialDecisionDetailClient({ slug }: Props) {
  const { isEditor, user, status: authStatus } = useEditorMode()
  const { t } = useT()
  const router = useRouter()
  const [decision, setDecision] = useState<DecisionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Editorial route first (sees drafts). If the editorial endpoint
      // 404s — backend not yet deployed — fall back to the public read
      // so the page at least renders the published draft.
      try {
        const d = await getEditorialDecisionBySlug(slug)
        setDecision(d)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          const d = await getDecisionBySlug(slug)
          setDecision(d)
        } else {
          throw e
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (!isEditor) return
    void refetch()
  }, [isEditor, refetch])

  if (authStatus === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isEditor) {
    return (
      <div className="container py-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-3xl">
          <p className="text-sm text-slate-700">
            {t('decisionEditor.list.requiresEditor')}
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {t('decisionEditor.list.signIn')} →
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !decision) {
    return (
      <div className="container py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-3xl">
          <p className="text-sm text-red-900">{error ?? t('jurisprudence.notFound.title')}</p>
          <Link
            href="/editorial/jurisprudence"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            ← {t('decisionEditor.bar.backToList')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <DecisionDetailClient decision={decision} />
      <DecisionEditorBar
        decision={decision}
        editorEmail={user?.email ?? null}
        onChanged={(updated) => {
          if (updated) {
            setDecision(updated)
          } else {
            void refetch()
          }
          // Also nudge the cache so the public detail re-fetches if the
          // editor flips between the two views.
          router.refresh()
        }}
      />
    </div>
  )
}
