'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import {
  BackToListLink,
  DecisionJsonEditor,
} from '@/components/jurisprudence/DecisionJsonEditor'
import { useT } from '@/i18n/useT'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { ApiError } from '@/lib/api/client'
import {
  getDecisionBySlug,
  getEditorialDecisionBySlug,
  type DecisionDetail,
} from '@/lib/api/endpoints'

interface Props {
  slug: string
}

/**
 * Edit an existing decision by pasting / tweaking its JSON. Re-uses
 * the same DecisionJsonEditor as the create flow — the only thing it
 * passes through is the existingSlug (which flips the save target
 * from POST to PATCH) and the seeded JSON body.
 */
export default function EditorialJsonEditClient({ slug }: Props) {
  const { isEditor, status: authStatus } = useEditorMode()
  const { t, language } = useT()
  const isFr = language !== 'ht'
  const [json, setJson] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    const load = async () => {
      try {
        let d: DecisionDetail
        try {
          d = await getEditorialDecisionBySlug(slug)
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            d = await getDecisionBySlug(slug)
          } else {
            throw e
          }
        }
        if (!cancelled) setJson(JSON.stringify(d, null, 2))
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isEditor, slug])

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
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-6 max-w-3xl">
          <p className="text-sm text-slate-700 dark:text-slate-200">
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

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="relative bg-primary dark:bg-slate-900 text-white overflow-hidden border-b border-white/5 dark:border-slate-800">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8 lg:py-10 pt-28 lg:pt-32">
          <Breadcrumb
            className="mb-5"
            items={[
              { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
              { label: isFr ? 'Éditorial' : 'Editoryal', href: '/editorial' },
              {
                label: t('jurisprudence.breadcrumb'),
                href: '/editorial/jurisprudence',
              },
              { label: slug, href: `/editorial/jurisprudence/${slug}` },
              { label: 'JSON' },
            ]}
          />
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {t('decisionEditor.json.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300 leading-relaxed font-mono">
            {slug}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6 lg:py-8 space-y-4">
        <BackToListLink />
        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-900 dark:text-red-300">
            {error}
          </div>
        )}
        {json === null && !error && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            {t('decisionEditor.list.loading')}
          </div>
        )}
        {json !== null && (
          <DecisionJsonEditor initialJson={json} existingSlug={slug} />
        )}
      </div>
    </div>
  )
}
