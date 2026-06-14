'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, ChevronRight, Loader2, ScanLine, UserCircle2, Users } from 'lucide-react'

import {
  assignMoniteurIssue,
  assignMoniteurYear,
  listMoniteurIssues,
  listMoniteurReviewers,
  listMoniteurYears,
  moniteurIssueSlug,
  type MoniteurIssueRead,
  type MoniteurReviewerOption,
  type MoniteurYearSummary,
} from '@/lib/api/endpoints'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { cn } from '@/lib/utils'

/**
 * Editor-only year view for /moniteur. Groups issues by publication year
 * in collapsible accordion sections so an editor can assign a reviewer to
 * a whole year (bulk) or to a single edition, and track OCR/review
 * progress per year. Reviewers can filter to "my years".
 */
export function MoniteurYearView({ lang }: { lang: 'fr' | 'ht' }) {
  const isFr = lang === 'fr'
  const { user } = useEditorMode()
  const myId = user?.id ? Number(user.id) : null

  const [years, setYears] = useState<MoniteurYearSummary[] | null>(null)
  const [reviewers, setReviewers] = useState<MoniteurReviewerOption[]>([])
  const [openYear, setOpenYear] = useState<number | null>(null)
  const [issuesByYear, setIssuesByYear] = useState<
    Record<number, MoniteurIssueRead[]>
  >({})
  const [mineOnly, setMineOnly] = useState(false)
  const [busyYear, setBusyYear] = useState<number | null>(null)

  const reloadYears = () =>
    listMoniteurYears(false)
      .then((ys) => {
        setYears(ys)
        // Open the most recent year by default on first load and eagerly
        // load its issues. Done here in the fetch callback (not a
        // synchronous setState in an effect body) to satisfy the
        // react-hooks/set-state-in-effect lint rule.
        if (ys.length && openYear === null) {
          setOpenYear(ys[0].year)
          listMoniteurIssues({
            year: ys[0].year,
            only_published: false,
            limit: 100,
          })
            .then((res) =>
              setIssuesByYear((p) => ({ ...p, [ys[0].year]: res.items })),
            )
            .catch(() => {})
        }
      })
      .catch(() => setYears([]))

  useEffect(() => {
    reloadYears()
    listMoniteurReviewers()
      .then(setReviewers)
      .catch(() => setReviewers([]))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleYears = useMemo(() => {
    if (!years) return null
    if (mineOnly && myId)
      return years.filter((y) =>
        (y.assignees ?? []).some((a) => a.reviewer_id === myId),
      )
    return years
  }, [years, mineOnly, myId])

  const reviewerLabel = (r: MoniteurReviewerOption) =>
    r.name || r.email || `#${r.id}`

  const loadYearIssues = async (year: number) => {
    const res = await listMoniteurIssues({
      year,
      only_published: false,
      limit: 100,
    })
    setIssuesByYear((prev) => ({ ...prev, [year]: res.items }))
  }

  const toggleYear = async (year: number) => {
    const next = openYear === year ? null : year
    setOpenYear(next)
    if (next !== null && !issuesByYear[next]) await loadYearIssues(next)
  }

  const onAssignYear = async (year: number, reviewerId: number | null) => {
    setBusyYear(year)
    try {
      await assignMoniteurYear(year, reviewerId)
      await reloadYears()
      if (issuesByYear[year]) await loadYearIssues(year)
    } finally {
      setBusyYear(null)
    }
  }

  const onAssignIssue = async (
    year: number,
    issueId: number,
    reviewerId: number | null,
  ) => {
    await assignMoniteurIssue(issueId, reviewerId)
    await Promise.all([reloadYears(), loadYearIssues(year)])
  }

  if (years === null) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: "my years" filter for reviewers */}
      {myId && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-colors',
              mineOnly
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300',
            )}
          >
            <UserCircle2 className="w-3.5 h-3.5" />
            {isFr ? 'Mes années' : 'Ane mwen yo'}
          </button>
        </div>
      )}

      {(visibleYears ?? []).map((y) => {
        const open = openYear === y.year
        const issues = issuesByYear[y.year]
        const pct = y.total ? Math.round((y.reviewed / y.total) * 100) : 0
        const done = y.total > 0 && y.reviewed === y.total
        const assignees = y.assignees ?? []
        return (
          <div
            key={y.year}
            className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
          >
            {/* Year header */}
            <div className="flex items-center gap-3 px-5 sm:px-6 py-4">
              <button
                type="button"
                onClick={() => toggleYear(y.year)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <ChevronRight
                  className={cn(
                    'w-5 h-5 text-slate-400 transition-transform flex-shrink-0',
                    open && 'rotate-90',
                  )}
                />
                <span className="text-xl font-black text-slate-300 dark:text-slate-600 tabular-nums">
                  {y.year}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {y.total} {y.total === 1 ? 'texte' : 'textes'}
                </span>
                {/* Review progress */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    done
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {done && <CheckCircle2 className="w-3 h-3" />}
                  {y.reviewed}/{y.total} {isFr ? 'revus' : 'revize'}
                  {y.total > 0 && ` · ${pct}%`}
                </span>
                {/* Assignee chips */}
                {assignees.length > 0 && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <Users className="w-3 h-3" />
                    {assignees
                      .map((a) => `${a.name || a.email || `#${a.reviewer_id}`} (${a.count})`)
                      .join(', ')}
                  </span>
                )}
              </button>

              {/* Bulk assign-year dropdown */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {busyYear === y.year && (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                )}
                <select
                  aria-label={
                    isFr
                      ? `Assigner toute l'année ${y.year}`
                      : `Bay tout ane ${y.year}`
                  }
                  value={
                    assignees.length === 1 ? assignees[0].reviewer_id : ''
                  }
                  onChange={(e) =>
                    onAssignYear(
                      y.year,
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-slate-700 dark:text-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
                >
                  <option value="">
                    {isFr ? '— Assigner l’année…' : '— Bay ane a…'}
                  </option>
                  {reviewers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {reviewerLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expanded issue list */}
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-slate-100 dark:border-slate-800"
                >
                  {!issues ? (
                    <div className="flex items-center justify-center py-6 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {issues.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center gap-3 px-5 sm:px-6 py-3"
                        >
                          <Link
                            href={`/moniteur/${moniteurIssueSlug(it)}`}
                            className="flex-1 min-w-0 group"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] font-mono text-slate-400 tabular-nums flex-shrink-0">
                                {it.publication_date ?? '—'}
                              </span>
                              <span className="text-sm text-slate-700 dark:text-slate-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                N° {it.number}
                                {it.edition_label ? ` · ${it.edition_label}` : ''}
                              </span>
                            </div>
                          </Link>
                          {(it.ocr_flagged_count ?? 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 flex-shrink-0"
                              title={
                                isFr
                                  ? `${it.ocr_flagged_count} texte(s) à vérifier (OCR)`
                                  : `${it.ocr_flagged_count} tèks pou verifye (OCR)`
                              }
                            >
                              <ScanLine className="w-3 h-3" aria-hidden="true" />
                              {it.ocr_flagged_count}
                            </span>
                          )}
                          {it.assigned_reviewer_email && (
                            <span className="hidden sm:inline text-[11px] text-slate-400 truncate max-w-[140px]">
                              {it.assigned_reviewer_name ||
                                it.assigned_reviewer_email}
                            </span>
                          )}
                          {/* Per-issue reassignment */}
                          <select
                            aria-label={
                              isFr
                                ? `Assigner le N° ${it.number}`
                                : `Bay N° ${it.number}`
                            }
                            value={it.assigned_reviewer_id ?? ''}
                            onChange={(e) =>
                              onAssignIssue(
                                y.year,
                                it.id,
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                            className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-600 dark:text-slate-300 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 flex-shrink-0"
                          >
                            <option value="">
                              {isFr ? '— non assigné' : '— pa bay'}
                            </option>
                            {reviewers.map((r) => (
                              <option key={r.id} value={r.id}>
                                {reviewerLabel(r)}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {visibleYears && visibleYears.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">
          {mineOnly
            ? isFr
              ? 'Aucune année ne vous est assignée.'
              : 'Pa gen ane ki bay ou.'
            : isFr
              ? 'Aucune édition.'
              : 'Pa gen edisyon.'}
        </div>
      )}
    </div>
  )
}
