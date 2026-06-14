'use client'

import { useEffect, useState } from 'react'
import { Flag, Loader2, Check, X } from 'lucide-react'

import {
  listMoniteurErrorReports,
  resolveMoniteurErrorReport,
  type MoniteurErrorReport,
} from '@/lib/api/endpoints'

/**
 * Editorial triage of reader "Signaler une erreur" reports (Phase 3).
 * Lists open reports with resolve / dismiss actions. Renders nothing when
 * there are none, so it stays out of the way on a clean console.
 */
export function ErrorReportsPanel({ isFr }: { isFr: boolean }) {
  const [reports, setReports] = useState<MoniteurErrorReport[] | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () =>
    listMoniteurErrorReports('open')
      .then(setReports)
      .catch(() => setReports([]))

  useEffect(() => {
    load()
  }, [])

  async function act(id: number, status: 'resolved' | 'dismissed') {
    setBusyId(id)
    try {
      await resolveMoniteurErrorReport(id, status)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!reports || reports.length === 0) return null

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-red-500" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {isFr ? 'Signalements de lecteurs' : 'Siyalman lektè'}
        </h2>
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[11px] font-bold">
          {reports.length}
        </span>
      </header>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {reports.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {r.message}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                {r.target_type}
                {r.location ? ` · ${r.location}` : ''}
                {r.reporter_email ? ` · ${r.reporter_email}` : ''}
                {r.target_url ? (
                  <>
                    {' · '}
                    <a
                      href={r.target_url}
                      className="text-indigo-500 hover:underline"
                    >
                      {isFr ? 'voir la page' : 'gade paj la'}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => act(r.id, 'resolved')}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-200 text-emerald-700 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-emerald-50 disabled:opacity-50"
              >
                {busyId === r.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {isFr ? 'Résolu' : 'Rezoud'}
              </button>
              <button
                type="button"
                onClick={() => act(r.id, 'dismissed')}
                disabled={busyId === r.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 text-slate-500 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                {isFr ? 'Rejeter' : 'Rejte'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
