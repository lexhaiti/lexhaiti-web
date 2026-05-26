'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Filter, RotateCcw, Search, ShieldCheck } from 'lucide-react'

import { useT } from '@/i18n/useT'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { StandardPageHeader } from '@/components/shared/StandardPageHeader'
import { DecisionListItem } from '@/components/jurisprudence/DecisionListItem'
import { cn } from '@/lib/utils'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import {
  listDecisions,
  listEditorialDecisions,
  type CourtType,
  type DecisionListItemRich,
  type DecisionSubjectTag,
  type EditorialDecisionListItem,
  type EditorialStatus,
} from '@/lib/api/endpoints'

const COURT_OPTIONS: CourtType[] = [
  'cassation',
  'appel',
  'tpi',
  'tribunal_commerce',
  'tribunal_enfants',
  'autre',
]

const PAGE_SIZE = 20

const EDITOR_STATUS_FILTERS: Array<{
  value: 'all' | EditorialStatus
  labelKey: string
}> = [
  { value: 'all', labelKey: 'decisionEditor.list.statusAll' },
  { value: 'draft', labelKey: 'decisionEditor.list.statusDraft' },
  { value: 'pending_review', labelKey: 'decisionEditor.list.statusPending' },
  { value: 'published', labelKey: 'decisionEditor.list.statusPublished' },
  { value: 'rejected', labelKey: 'decisionEditor.list.statusRejected' },
]

const EDITOR_STATUS_TONE: Record<EditorialStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 border-amber-200',
  pending_review: 'bg-sky-100 text-sky-900 border-sky-200',
  published: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-red-100 text-red-900 border-red-200',
}

/**
 * Interactive index of court decisions — search, court/year/subject
 * filters, paginated list. Server-rendered shell wraps this client
 * component so the SEO / metadata path stays clean.
 */
export default function JurisprudenceListClient() {
  const { t, language } = useT()
  const isFr = language === 'fr'
  const { isEditor } = useEditorMode()

  const [items, setItems] = useState<EditorialDecisionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state — local; we let the user adjust freely and only
  // refetch when one of these changes.
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [court, setCourt] = useState<CourtType | 'all'>('all')
  const [year, setYear] = useState<string>('all')
  const [subject, setSubject] = useState<string>('all')
  // Editor-only — defaults to "all" so editors see drafts alongside
  // published; ignored entirely for non-editors (we always go through
  // the public endpoint, which already filters to published).
  const [editorialStatus, setEditorialStatus] =
    useState<'all' | EditorialStatus>('all')
  const [page, setPage] = useState(1)

  // Debounce the search input so we don't hammer the API on every
  // keystroke. 350 ms balances responsiveness against the back-end
  // round-trip on a slow Haitian connection. We also reset to page
  // 1 here (filter-side change ⇒ pagination cursor is meaningless),
  // keeping the page-reset state update out of effect bodies — Next
  // 16's lint rule (react-hooks/set-state-in-effect) flags those.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(id)
  }, [query])

  // Fetch decisions on every filter / page change. Cancels the
  // in-flight request when filters change again so we don't render
  // stale results. `setLoading(true)` lives outside the effect body
  // by sharing state with the page transitions — we set loading
  // optimistically inside the filter setters and the effect flips
  // it back off on completion.
  useEffect(() => {
    let cancelled = false

    const from = year !== 'all' ? `${year}-01-01` : undefined
    const to = year !== 'all' ? `${year}-12-31` : undefined

    const run = async () => {
      try {
        // Editors get the editorial endpoint so drafts / pending-review
        // rows are visible alongside published ones. Non-editors stay on
        // the public endpoint which silently filters drafts out.
        const res = isEditor
          ? await listEditorialDecisions({
              q: debouncedQuery || undefined,
              court: court === 'all' ? undefined : court,
              from,
              to,
              subject: subject === 'all' ? undefined : subject,
              editorial_status:
                editorialStatus === 'all' ? undefined : editorialStatus,
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
            })
          : await listDecisions({
              q: debouncedQuery || undefined,
              court: court === 'all' ? undefined : court,
              from,
              to,
              subject: subject === 'all' ? undefined : subject,
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
            })
        if (cancelled) return
        setItems(res.items ?? [])
        setTotal(res.total ?? 0)
        setError(null)
      } catch (err) {
        if (cancelled) return
        // The /decisions endpoint may return 4xx / 5xx while the
        // backend is still being built — degrade gracefully to the
        // empty-state surface instead of crashing the page.
        setItems([])
        setTotal(0)
        setError(err instanceof Error ? err.message : 'unknown_error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, court, year, subject, page, isEditor, editorialStatus])

  // Filter setters that also reset the page cursor and flip the
  // loading flag on, sidestepping Next 16's set-state-in-effect
  // lint rule. Component handlers — not effects — are the right
  // place for these compound state updates.
  const handleCourtChange = (next: CourtType | 'all') => {
    setCourt(next)
    setPage(1)
    setLoading(true)
  }
  const handleYearChange = (next: string) => {
    setYear(next)
    setPage(1)
    setLoading(true)
  }
  const handleSubjectChange = (next: string) => {
    setSubject(next)
    setPage(1)
    setLoading(true)
  }
  const handlePageChange = (next: number) => {
    setPage(next)
    setLoading(true)
  }
  const handleEditorialStatusChange = (next: 'all' | EditorialStatus) => {
    setEditorialStatus(next)
    setPage(1)
    setLoading(true)
  }

  // Derive year + subject options from the currently visible items.
  // Once the backend exposes a `/decisions/facets` endpoint, swap
  // this for that — but the inferred set is fine for early data.
  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    for (const d of items) {
      const y = d.decision_date?.slice(0, 4)
      if (y) set.add(y)
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [items])

  const subjectOptions = useMemo(() => {
    const map = new Map<string, DecisionSubjectTag>()
    for (const d of items) {
      for (const tag of d.subject_tags ?? []) {
        if (!map.has(tag.key)) map.set(tag.key, tag)
      }
    }
    return Array.from(map.values())
  }, [items])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasActiveFilter =
    debouncedQuery !== '' || court !== 'all' || year !== 'all' || subject !== 'all'

  const handleReset = () => {
    setQuery('')
    setDebouncedQuery('')
    setCourt('all')
    setYear('all')
    setSubject('all')
    setEditorialStatus('all')
    setPage(1)
    setLoading(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <StandardPageHeader
        title={t('jurisprudence.title')}
        subtitle={t('jurisprudence.intro')}
        breadcrumbs={[
          { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
          { label: t('jurisprudence.breadcrumb') },
        ]}
      >
        {/* Eyebrow over the title — overlay above the StandardPageHeader's
            existing h1 by reading the prop and using an absolutely-positioned
            element would be invasive. Instead we drop an eyebrow line into
            the children slot below the title; the visual hierarchy still
            works because the StandardPageHeader's subtitle sits between. */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both mt-8 max-w-3xl flex items-stretch gap-0 rounded-lg overflow-hidden bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-amber-300/60 transition-shadow">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('jurisprudence.searchPlaceholder')}
              aria-label={t('jurisprudence.searchPlaceholder')}
              className="w-full h-14 pl-11 pr-4 bg-transparent text-slate-900 placeholder:text-slate-400 placeholder:italic placeholder:text-sm text-base outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            type="button"
            aria-label={t('jurisprudence.searchButton')}
            className="inline-flex items-center gap-2 px-5 sm:px-7 bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all"
          >
            <Search className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">
              {t('jurisprudence.searchButton')}
            </span>
          </button>
        </div>
      </StandardPageHeader>

      <div className="container py-8 lg:py-12">
        {/* Editor-only status switcher — drafts/pending live in the
            editorial table; this row gives editors a one-click way to
            surface them on the same public surface they edit on. */}
        {isEditor && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isFr ? 'Vue éditeur' : 'Vi editè'}
            </span>
            {EDITOR_STATUS_FILTERS.map((f) => {
              const active = editorialStatus === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleEditorialStatusChange(f.value)}
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  )}
                >
                  {t(f.labelKey)}
                </button>
              )
            })}
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            <Filter className="h-3.5 w-3.5" />
            {t('jurisprudence.filtersLabel')}
          </div>
          {/* Horizontal scroll on mobile so the filters never wrap awkwardly
              into a tall stack. */}
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <FilterSelect
              label={t('jurisprudence.courtFilter')}
              value={court}
              onChange={(v) => handleCourtChange(v as CourtType | 'all')}
              options={[
                { value: 'all', label: t('jurisprudence.courtAll') },
                ...COURT_OPTIONS.map((c) => ({
                  value: c,
                  label: t(`jurisprudence.courts.${c}`),
                })),
              ]}
            />
            <FilterSelect
              label={t('jurisprudence.yearFilter')}
              value={year}
              onChange={handleYearChange}
              options={[
                { value: 'all', label: t('jurisprudence.yearAll') },
                ...yearOptions.map((y) => ({ value: y, label: y })),
              ]}
            />
            {subjectOptions.length > 0 && (
              <FilterSelect
                label={t('jurisprudence.subjectFilter')}
                value={subject}
                onChange={handleSubjectChange}
                options={[
                  { value: 'all', label: t('jurisprudence.subjectAll') },
                  ...subjectOptions.map((s) => ({
                    value: s.key,
                    label:
                      (language === 'ht' && s.label_ht) ||
                      s.label_fr ||
                      s.key,
                  })),
                ]}
              />
            )}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('jurisprudence.reset')}
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && total > 0 && (
          <p className="mb-6 text-sm text-slate-500">
            <span className="font-bold tabular-nums text-slate-900">{total}</span>{' '}
            {t('jurisprudence.resultsCount')}
          </p>
        )}

        {/* List */}
        {loading ? (
          <LoadingState />
        ) : items.length > 0 ? (
          <>
            <motion.div
              key={`list-${court}-${year}-${subject}-${debouncedQuery}-${page}`}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.04 },
                },
              }}
              className="space-y-4"
            >
              {items.map((decision) => {
                const status = decision.editorial_status as
                  | EditorialStatus
                  | undefined
                const showBadge =
                  isEditor && status && status !== 'published'
                return (
                  <motion.div
                    key={decision.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    className="relative"
                  >
                    {showBadge && (
                      <span
                        className={cn(
                          'absolute -top-2 left-4 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm',
                          EDITOR_STATUS_TONE[status],
                        )}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {t(`decisionEditor.list.status${
                          status === 'pending_review'
                            ? 'Pending'
                            : status.charAt(0).toUpperCase() + status.slice(1)
                        }`)}
                      </span>
                    )}
                    <DecisionListItem decision={decision} />
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                className="mt-10 flex items-center justify-between gap-3"
                aria-label="Pagination"
              >
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  className={cn(
                    'rounded-full border-slate-200 px-5 h-10 font-semibold',
                    page === 1 && 'opacity-50',
                  )}
                >
                  ← {t('jurisprudence.previous')}
                </Button>
                <p className="text-sm text-slate-500 tabular-nums">
                  {t('jurisprudence.page')}{' '}
                  <span className="font-bold text-slate-900">{page}</span>{' '}
                  {t('jurisprudence.of')}{' '}
                  <span className="font-bold text-slate-900">{totalPages}</span>
                </p>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() =>
                    handlePageChange(Math.min(totalPages, page + 1))
                  }
                  className={cn(
                    'rounded-full border-slate-200 px-5 h-10 font-semibold',
                    page >= totalPages && 'opacity-50',
                  )}
                >
                  {t('jurisprudence.next')} →
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            eyebrow={t('jurisprudence.eyebrow')}
            title={t('jurisprudence.empty.title')}
            description={t('jurisprudence.empty.subtitle')}
            actions={
              <Button
                variant="outline"
                className="rounded-full border-slate-200 hover:bg-white hover:border-primary hover:text-primary px-6 h-11 font-bold transition-all"
                onClick={() => (window.location.href = '/lois')}
              >
                {isFr
                  ? 'Voir la législation disponible'
                  : 'Wè lejislasyon ki disponib la'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}

/**
 * Minimal native-select wrapper — we deliberately avoid Radix
 * SelectPrimitive here because the filter bar needs to scroll
 * horizontally on mobile, and the Radix popover positioning
 * collides with the parent's overflow-x-auto. Native selects
 * also work better for legal users on slow connections.
 */
function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <label className="flex flex-shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-semibold text-slate-800 outline-none cursor-pointer pr-1"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
