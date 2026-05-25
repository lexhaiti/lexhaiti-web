'use client'

/**
 * Editor-only list of court decisions. Shows every editorial status
 * (draft / pending_review / published / rejected) — the public
 * /jurisprudence index hides drafts. Filters by status, free-text
 * filter on title / case number / court, paginated.
 *
 * Row actions: open in editorial-mode detail, edit (opens the same
 * detail page with the sheet auto-open is overkill — we just link to
 * the page), publish (one-click for drafts that don't need review),
 * delete (drafts only). Mirrors the dashboard cards from
 * /editorial/page.tsx for visual consistency.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Gavel,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast-simple'
import { useT } from '@/i18n/useT'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { ApiError } from '@/lib/api/client'
import {
  deleteDecision,
  listEditorialDecisions,
  publishDecision,
  type EditorialDecisionListItem,
  type EditorialStatus,
} from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'
import { formatLongDate } from '@/lib/format/date'

const PAGE_SIZE = 25

const STATUS_TONE: Record<EditorialStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 border-amber-200',
  pending_review: 'bg-blue-100 text-blue-900 border-blue-200',
  published: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-red-100 text-red-900 border-red-200',
}

const STATUS_FILTERS: Array<{ value: 'all' | EditorialStatus; labelKey: string }> = [
  { value: 'all', labelKey: 'decisionEditor.list.statusAll' },
  { value: 'draft', labelKey: 'decisionEditor.list.statusDraft' },
  { value: 'pending_review', labelKey: 'decisionEditor.list.statusPending' },
  { value: 'published', labelKey: 'decisionEditor.list.statusPublished' },
  { value: 'rejected', labelKey: 'decisionEditor.list.statusRejected' },
]

export default function EditorialJurisprudencePage() {
  const { isEditor, status: authStatus } = useEditorMode()
  const { t, language } = useT()
  const isFr = language !== 'ht'
  const { toast } = useToast()

  const [statusFilter, setStatusFilter] = useState<'all' | EditorialStatus>('all')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<EditorialDecisionListItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<EditorialDecisionListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refetchToken, setRefetchToken] = useState(0)

  // Refetch when filters change.
  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    setItems(null)
    setError(null)
    listEditorialDecisions({
      editorial_status:
        statusFilter === 'all' ? undefined : statusFilter,
      q: query.trim() || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        setItems(res.items ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setError(t('decisionEditor.bar.apiUnavailable'))
        } else {
          setError(
            err instanceof Error
              ? err.message
              : String(err) || t('decisionEditor.list.empty'),
          )
        }
        setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [isEditor, statusFilter, query, page, refetchToken, t])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const filterCounts = useMemo(() => {
    // Cheap client-side computation off the *current* page only; gives
    // the editor a feel for "any drafts?" without a separate counts API.
    if (!items) return null
    const counts: Record<EditorialStatus, number> = {
      draft: 0,
      pending_review: 0,
      published: 0,
      rejected: 0,
    }
    for (const d of items) {
      const s = (d.editorial_status as EditorialStatus | undefined) ?? 'draft'
      counts[s] += 1
    }
    return counts
  }, [items])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDecision(deleteTarget.slug)
      toast(t('decisionEditor.bar.deleteSuccess'))
      setDeleteTarget(null)
      setRefetchToken((x) => x + 1)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast(t('decisionEditor.bar.apiUnavailable'))
      } else {
        const detail =
          e instanceof ApiError
            ? String(
                (e.body as { detail?: unknown } | undefined)?.detail ??
                  e.message,
              )
            : e instanceof Error
              ? e.message
              : String(e)
        toast(detail)
      }
    } finally {
      setDeleting(false)
    }
  }

  async function publishRow(slug: string) {
    try {
      await publishDecision(slug)
      toast(t('decisionEditor.bar.publishedToast'))
      setRefetchToken((x) => x + 1)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast(t('decisionEditor.bar.apiUnavailable'))
        return
      }
      const code = e instanceof ApiError ? ` (${e.status})` : ''
      toast(`${t('decisionEditor.bar.failed')}${code}`)
    }
  }

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

  return (
    <div className="min-h-screen bg-white">
      <div className="relative bg-primary text-white overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10 lg:py-14 pt-28 lg:pt-32">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
              { label: isFr ? 'Éditorial' : 'Editoryal', href: '/editorial' },
              { label: t('jurisprudence.breadcrumb') },
            ]}
          />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <Gavel className="w-7 h-7 lg:w-8 lg:h-8 text-amber-300" />
                {t('decisionEditor.list.title')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 leading-relaxed">
                {t('decisionEditor.list.subtitle')}
              </p>
            </div>
            <Link
              href="/editorial/jurisprudence/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-primary px-4 py-2 text-sm font-bold hover:bg-amber-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('decisionEditor.list.newDecision')}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8 lg:py-10 space-y-6">
        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === 'all'
                ? items?.length ?? 0
                : filterCounts?.[f.value as EditorialStatus] ?? 0
            const active = statusFilter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value)
                  setPage(1)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                )}
              >
                {t(f.labelKey)}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full text-[10px] px-1.5 py-0.5 tabular-nums',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-600',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t('decisionEditor.list.searchPlaceholder')}
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setPage(1)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Error / loading / empty */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {items === null && !error && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            {t('decisionEditor.list.loading')}
          </div>
        )}

        {items !== null && items.length === 0 && !error && (
          <p className="text-sm text-slate-400 italic px-1">
            {t('decisionEditor.list.empty')}
          </p>
        )}

        {/* Rows */}
        {items && items.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {items.map((d) => {
              const status =
                (d.editorial_status as EditorialStatus | undefined) ?? 'draft'
              const dateStr = formatLongDate(
                d.decision_date,
                isFr ? 'fr' : 'ht',
                d.decision_date,
              )
              const courtLabel = t(`jurisprudence.courts.${d.court}`, {
                fallback: d.court,
              })
              const title =
                (isFr ? d.title_fr : d.title_ht || d.title_fr) ||
                d.summary_fr ||
                d.summary_ht ||
                d.slug
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0',
                      STATUS_TONE[status],
                    )}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {t(
                      status === 'draft'
                        ? 'decisionEditor.bar.statusDraft'
                        : status === 'pending_review'
                          ? 'decisionEditor.bar.statusPending'
                          : status === 'published'
                            ? 'decisionEditor.bar.statusPublished'
                            : 'decisionEditor.bar.statusRejected',
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {courtLabel} · {dateStr}
                      {d.case_number ? ` · N° ${d.case_number}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/editorial/jurisprudence/${d.slug}`}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      title={t('decisionEditor.list.edit')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {t('decisionEditor.list.edit')}
                      </span>
                    </Link>
                    {status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => publishRow(d.slug)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {t('decisionEditor.list.publish')}
                        </span>
                      </button>
                    )}
                    {status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(d)}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        title={t('decisionEditor.list.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination + total */}
        {items && items.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <p className="text-xs text-slate-500">
              {t('decisionEditor.list.total').replace('{n}', String(total))}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('jurisprudence.previous')}
                </Button>
                <span className="text-xs text-slate-500 tabular-nums">
                  {t('jurisprudence.page')} {page} {t('jurisprudence.of')}{' '}
                  {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('jurisprudence.next')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
        title={t('decisionEditor.bar.deleteTitle')}
        description={
          <>
            {t('decisionEditor.bar.deleteBody')}
            {deleteTarget && (
              <>
                <br />
                <br />
                <span className="font-semibold text-slate-900 font-mono text-xs">
                  {deleteTarget.slug}
                </span>
              </>
            )}
          </>
        }
        confirmLabel={t('decisionEditor.list.delete')}
        cancelLabel={t('decisionEditor.bar.cancel')}
        destructive
        loading={deleting}
      />
    </div>
  )
}

