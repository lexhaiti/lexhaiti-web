'use client'

// Editor-only usage dashboard — renders the anonymous reach metrics from
// GET /api/v1/analytics/usage (top downloads, top searches, zero-result
// searches, per-type totals). Mirrors the other editorial pages: client
// component, useEditorMode() guard, apiGet wrapper, FR/HT inline i18n.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Newspaper,
  Scale,
  Search,
} from 'lucide-react'

import { StandardPageHeader } from '@/components/shared/StandardPageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { Badge } from '@/components/ui/badge'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { useT } from '@/i18n/useT'
import {
  getAnalyticsUsage,
  type AnalyticsUsageResponse,
} from '@/lib/api/endpoints'
import { buildUsageCsv, downloadCsv } from '@/lib/analytics/csv'

const WINDOWS = [30, 90, 365] as const

export default function AnalyticsPage() {
  const { isEditor, status } = useEditorMode()
  const { language } = useT()
  const isFr = language !== 'ht'
  const L = (fr: string, ht: string) => (isFr ? fr : ht)

  const [windowDays, setWindowDays] = useState<number>(30)
  const [data, setData] = useState<AnalyticsUsageResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    getAnalyticsUsage({ windowDays })
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setErr(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message ?? String(e))
      })
    return () => {
      cancelled = true
    }
  }, [isEditor, windowDays])

  // Derived loading flags (no setState-in-effect): the first load shows a
  // full block; a window change keeps the old data visible and shows a small
  // "refreshing" pill until the response for the new window arrives.
  const initialLoading = data === null && err === null
  const refreshing = data !== null && data.window_days !== windowDays

  // --- auth gates (same pattern as the other editorial pages) ---
  if (status === 'loading') {
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
            {L(
              'Cette page est réservée aux éditeurs connectés.',
              'Paj sa a pou editè ki konekte sèlman.',
            )}
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {L('Se connecter', 'Konekte')} →
          </Link>
        </div>
      </div>
    )
  }

  const downloadKind = (eventType: string): string => {
    switch (eventType) {
      case 'download_scan':
        return L('Scan Moniteur', 'Eskan Moniteur')
      case 'download_moniteur_pdf':
        return L('PDF Moniteur', 'PDF Moniteur')
      case 'download_law':
        return L('PDF Loi', 'PDF Lwa')
      default:
        return eventType
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <StandardPageHeader
        title={L("Statistiques d'usage", 'Estatistik itilizasyon')}
        subtitle={L(
          'Téléchargements et recherches des visiteurs. Données entièrement anonymes (aucune IP, aucun compte).',
          'Telechajman ak rechèch vizitè yo. Done konplètman anonim (pa gen IP, pa gen kont).',
        )}
        breadcrumbs={[
          { label: L('Accueil', 'Akèy'), href: '/' },
          { label: L('Éditorial', 'Editoryal'), href: '/editorial' },
          { label: L('Statistiques', 'Estatistik') },
        ]}
      />

      <div className="container py-10 lg:py-12 space-y-8">
        {/* Window selector */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {L('Période', 'Peryòd')}
          </span>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            {WINDOWS.map((d) => {
              const active = windowDays === d
              const label =
                d === 365 ? L('1 an', '1 an') : L(`${d} jours`, `${d} jou`)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWindowDays(d)}
                  className={`px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {L('Chargement…', 'Chaje…')}
            </span>
          )}
          {data && (
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  `lexhaiti-stats-${windowDays}j.csv`,
                  buildUsageCsv(data),
                )
              }
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              {L('Exporter en CSV', 'Ekspòte CSV')}
            </button>
          )}
        </div>

        {err && <ErrorBanner>{err}</ErrorBanner>}

        {!err && initialLoading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-sm text-slate-500 dark:text-slate-400 text-center">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            {L('Chargement des statistiques…', 'Ap chaje estatistik yo…')}
          </div>
        )}

        {data && (
          <>
            {/* Totals strip */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile
                label={L('Scans Moniteur', 'Eskan Moniteur')}
                value={data.totals.download_scan ?? 0}
                icon={Newspaper}
              />
              <StatTile
                label={L('PDF Moniteur', 'PDF Moniteur')}
                value={data.totals.download_moniteur_pdf ?? 0}
                icon={FileText}
              />
              <StatTile
                label={L('PDF Lois', 'PDF Lwa')}
                value={data.totals.download_law ?? 0}
                icon={Scale}
              />
              <StatTile
                label={L('Recherches', 'Rechèch')}
                value={data.totals.search ?? 0}
                icon={Search}
              />
            </section>

            {/* Top downloads */}
            <section className="space-y-3">
              <SectionLabel
                icon={Download}
                text={L('Documents les plus téléchargés', 'Dokiman ki pi telechaje')}
              />
              {data.top_downloads.length === 0 ? (
                <EmptyState
                  density="compact"
                  title={L('Aucun téléchargement', 'Pa gen telechajman')}
                  description={L(
                    'Aucun téléchargement enregistré sur cette période.',
                    'Pa gen telechajman ki anrejistre nan peryòd sa a.',
                  )}
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-5 py-3 w-10">#</th>
                        <th className="px-5 py-3">{L('Document', 'Dokiman')}</th>
                        <th className="px-5 py-3">{L('Type', 'Tip')}</th>
                        <th className="px-5 py-3">
                          {L('Tendance', 'Tandans')}
                        </th>
                        <th className="px-5 py-3 text-right">
                          {L('Téléchargements', 'Telechajman')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.top_downloads.map((row, i) => (
                        <tr
                          key={`${row.event_type}-${row.target_type}-${row.target_id}-${i}`}
                          className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40"
                        >
                          <td className="px-5 py-3.5 tabular-nums text-slate-400">
                            {i + 1}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100">
                            {row.label ??
                              `${row.target_type ?? '?'} #${row.target_id ?? '?'}`}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="secondary">
                              {downloadKind(row.event_type)}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5">
                            {row.trend && row.trend.some((n) => n > 0) ? (
                              <Sparkline
                                values={row.trend}
                                className="text-primary"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Top searches */}
            <section className="space-y-3">
              <SectionLabel
                icon={Search}
                text={L('Recherches les plus fréquentes', 'Rechèch ki pi frekan')}
              />
              <SearchTable
                rows={data.top_searches}
                emptyTitle={L('Aucune recherche', 'Pa gen rechèch')}
                emptyDesc={L(
                  'Aucune recherche enregistrée sur cette période.',
                  'Pa gen rechèch ki anrejistre nan peryòd sa a.',
                )}
                queryLabel={L('Terme recherché', 'Tèm rechèch')}
                countLabel={L('Recherches', 'Rechèch')}
              />
            </section>

            {/* Zero-result searches — corpus gaps */}
            <section className="space-y-3">
              <SectionLabel
                icon={AlertTriangle}
                text={L(
                  'Recherches sans résultat (lacunes du corpus)',
                  'Rechèch san rezilta (twou nan kòpis la)',
                )}
                attention
              />
              {data.zero_result_searches.length === 0 ? (
                <EmptyState
                  density="compact"
                  tone="default"
                  title={L('Aucune lacune détectée', 'Pa gen twou detekte')}
                  description={L(
                    'Toutes les recherches de cette période ont renvoyé au moins un résultat.',
                    'Tout rechèch nan peryòd sa a te bay omwen yon rezilta.',
                  )}
                />
              ) : (
                <SearchTable
                  rows={data.zero_result_searches}
                  emptyTitle=""
                  emptyDesc=""
                  queryLabel={L('Terme recherché', 'Tèm rechèch')}
                  countLabel={L('Tentatives', 'Tantativ')}
                  attention
                />
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

// --- local presentational helpers (the app uses page-local stat/table
//     building blocks rather than shared components for these) ---

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      </div>
      <div className="mt-2 text-2xl font-black tabular-nums text-slate-900 dark:text-white">
        {value.toLocaleString('fr-FR')}
      </div>
    </div>
  )
}

function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const width = 96
  const height = 24
  const pad = 2
  if (values.length === 0) return null
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = pad + i * step
      const y = height - pad - (v / max) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SectionLabel({
  icon: Icon,
  text,
  attention = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
  attention?: boolean
}) {
  return (
    <header className="flex items-center gap-2">
      <Icon
        className={`w-4 h-4 ${
          attention
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
      />
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {text}
      </h2>
    </header>
  )
}

function SearchTable({
  rows,
  emptyTitle,
  emptyDesc,
  queryLabel,
  countLabel,
  attention = false,
}: {
  rows: { query: string; count: number }[]
  emptyTitle: string
  emptyDesc: string
  queryLabel: string
  countLabel: string
  attention?: boolean
}) {
  if (rows.length === 0) {
    return (
      <EmptyState density="compact" title={emptyTitle} description={emptyDesc} />
    )
  }
  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        attention
          ? 'border-amber-200 dark:border-amber-500/30'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <table className="w-full text-sm">
        <thead className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 w-10">#</th>
            <th className="px-5 py-3">{queryLabel}</th>
            <th className="px-5 py-3 text-right">{countLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <tr
              key={`${row.query}-${i}`}
              className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40"
            >
              <td className="px-5 py-3.5 tabular-nums text-slate-400">
                {i + 1}
              </td>
              <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-100 break-words">
                {row.query}
              </td>
              <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {row.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
