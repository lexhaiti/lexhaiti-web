'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookMarked,
  Check,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { useT } from '@/i18n/useT'
import { StandardPageHeader } from '@/components/shared/StandardPageHeader'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { cn } from '@/lib/utils'
import {
  getMoniteurIndexFacets,
  listMoniteurIndex,
  updateMoniteurIndexEntry,
  type MoniteurIndexEntry,
  type MoniteurIndexFacets,
} from '@/lib/api/endpoints'

const PAGE = 50

const ACTE_LABEL: Record<string, { fr: string; cls: string }> = {
  loi: { fr: 'Loi', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  decret: { fr: 'Décret', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  arrete: { fr: 'Arrêté', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  convention: { fr: 'Convention', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  ordonnance: { fr: 'Ordonnance', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  circulaire: { fr: 'Circulaire', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
}

type Sort = 'rubrique' | 'year' | 'date'
type Filters = {
  initial?: string
  year?: number
  acte_type?: string
  q?: string
  sort: Sort
}

const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors'
const PILL_OFF = 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
const PILL_ON = 'bg-slate-900 text-white border-slate-900'

const ACTE_TYPES = [
  'loi',
  'decret',
  'arrete',
  'convention',
  'ordonnance',
  'circulaire',
]

/** Inline editor (editors only) to correct OCR mistakes in one entry. */
function EntryEditForm({
  entry,
  isFr,
  onSaved,
  onCancel,
}: {
  entry: MoniteurIndexEntry
  isFr: boolean
  onSaved: (e: MoniteurIndexEntry) => void
  onCancel: () => void
}) {
  const [d, setD] = useState({
    rubrique: entry.rubrique,
    year: entry.year != null ? String(entry.year) : '',
    acte_type: entry.acte_type ?? '',
    description: entry.description,
    moniteur_ref_raw: entry.moniteur_ref_raw ?? '',
    moniteur_date: entry.moniteur_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const inputCls =
    'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500'

  const save = async () => {
    setSaving(true)
    setError(false)
    try {
      const updated = await updateMoniteurIndexEntry(entry.id, {
        rubrique: d.rubrique.trim(),
        year: d.year ? Number(d.year) : null,
        acte_type: d.acte_type || null,
        description: d.description.trim(),
        moniteur_ref_raw: d.moniteur_ref_raw.trim() || null,
        moniteur_date: d.moniteur_date || null,
      })
      onSaved(updated)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <input
        value={d.rubrique}
        onChange={(e) => setD({ ...d, rubrique: e.target.value })}
        placeholder={isFr ? 'Rubrique' : 'Rubrik'}
        className={cn(inputCls, 'font-semibold')}
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={d.year}
          onChange={(e) => setD({ ...d, year: e.target.value })}
          placeholder={isFr ? 'Année' : 'Ane'}
          className={cn(inputCls, 'w-24')}
        />
        <select
          value={d.acte_type}
          onChange={(e) => setD({ ...d, acte_type: e.target.value })}
          className={cn(inputCls, 'w-44')}
        >
          <option value="">{isFr ? '— type —' : '— kalite —'}</option>
          {ACTE_TYPES.map((a) => (
            <option key={a} value={a}>
              {ACTE_LABEL[a]?.fr ?? a}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={d.moniteur_date}
          onChange={(e) => setD({ ...d, moniteur_date: e.target.value })}
          className={cn(inputCls, 'w-40')}
        />
      </div>
      <textarea
        value={d.description}
        onChange={(e) => setD({ ...d, description: e.target.value })}
        rows={3}
        placeholder="Description"
        className={inputCls}
      />
      <input
        value={d.moniteur_ref_raw}
        onChange={(e) => setD({ ...d, moniteur_ref_raw: e.target.value })}
        placeholder="Moniteur du …"
        className={inputCls}
      />
      {error && (
        <p className="text-xs text-red-600">
          {isFr ? "Échec de l'enregistrement." : 'Echèk anrejistreman.'}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {isFr ? 'Enregistrer' : 'Anrejistre'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <X className="h-3.5 w-3.5" />
          {isFr ? 'Annuler' : 'Anile'}
        </button>
      </div>
    </div>
  )
}

export default function RepertoireClient() {
  const { language } = useT()
  const isFr = language !== 'ht'
  const { isEditor } = useEditorMode()

  const [facets, setFacets] = useState<MoniteurIndexFacets | null>(null)
  const [filters, setFilters] = useState<Filters>({ sort: 'rubrique' })
  const [entries, setEntries] = useState<MoniteurIndexEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [qDraft, setQDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // facets once
  useEffect(() => {
    getMoniteurIndexFacets()
      .then(setFacets)
      .catch(() => setFacets(null))
  }, [])

  // debounce the free-text box into filters.q
  useEffect(() => {
    const id = setTimeout(
      () => setFilters((f) => ({ ...f, q: qDraft.trim() || undefined })),
      250,
    )
    return () => clearTimeout(id)
  }, [qDraft])

  const fetchPage = useCallback(
    async (offset: number) => {
      const res = await listMoniteurIndex({
        initial: filters.initial,
        year: filters.year,
        acte_type: filters.acte_type,
        q: filters.q,
        sort: filters.sort,
        limit: PAGE,
        offset,
      })
      setTotal(res.total)
      setEntries((prev) => (offset === 0 ? res.items : [...prev, ...res.items]))
    },
    [filters],
  )

  // reload on filter change
  const filterKey = JSON.stringify(filters)
  const firstRun = useRef(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPage(0).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchPage(entries.length).finally(() => setLoadingMore(false))
  }

  const setF = (patch: Partial<Filters>) =>
    setFilters((f) => ({ ...f, ...patch }))
  const reset = () => {
    setFilters({ sort: 'rubrique' })
    setQDraft('')
  }
  const onSaved = (updated: MoniteurIndexEntry) => {
    setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    setEditingId(null)
  }
  const hasFilters =
    !!filters.initial || !!filters.year || !!filters.acte_type || !!filters.q

  const initials = facets?.initials ?? []
  const years = facets?.years ?? []
  const acteTypes = facets?.acte_types ?? []

  const sortLabel = useMemo(
    () => ({
      rubrique: isFr ? 'Rubrique A–Z' : 'Rubrik A–Z',
      year: isFr ? 'Par année' : 'Pa ane',
      date: isFr ? 'Par date' : 'Pa dat',
    }),
    [isFr],
  )

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <StandardPageHeader
        title={
          isFr
            ? 'Répertoire du Moniteur (1900–1944)'
            : 'Repètwa Moniteur la (1900–1944)'
        }
        subtitle={
          isFr
            ? 'Index alphabétique et chronologique du journal officiel.'
            : 'Endèks alfabetik e kwonolojik jounal ofisyèl la.'
        }
        breadcrumbs={[
          { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
          { label: 'Le Moniteur', href: '/moniteur' },
          { label: isFr ? 'Répertoire' : 'Repètwa' },
        ]}
      >
        {facets && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15">
            <BookMarked className="h-4 w-4" />
            {facets.total.toLocaleString('fr-FR')}{' '}
            {isFr ? 'entrées' : 'antre'}
          </div>
        )}
      </StandardPageHeader>

      <div className="container py-10 lg:py-12">
        {/* Filter bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filters.year ?? ''}
            onChange={(e) =>
              setF({ year: e.target.value ? Number(e.target.value) : undefined })
            }
            className={cn(PILL, PILL_OFF, 'cursor-pointer appearance-none pr-7')}
          >
            <option value="">{isFr ? 'Toutes années' : 'Tout ane'}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={filters.acte_type ?? ''}
            onChange={(e) => setF({ acte_type: e.target.value || undefined })}
            className={cn(PILL, PILL_OFF, 'cursor-pointer appearance-none pr-7')}
          >
            <option value="">{isFr ? 'Tous types' : 'Tout kalite'}</option>
            {acteTypes.map((a) => (
              <option key={a} value={a}>
                {ACTE_LABEL[a]?.fr ?? a}
              </option>
            ))}
          </select>

          <select
            value={filters.sort}
            onChange={(e) => setF({ sort: e.target.value as Sort })}
            className={cn(PILL, PILL_OFF, 'cursor-pointer appearance-none pr-7')}
          >
            {(['rubrique', 'year', 'date'] as Sort[]).map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder={
                isFr ? 'Rechercher (rubrique, acte…)' : 'Chèche (rubrik, zak…)'
              }
              className="w-full rounded-full border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          {hasFilters && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isFr ? 'Réinitialiser' : 'Reyinisyalize'}
            </button>
          )}
        </div>

        {/* A–Z initials */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setF({ initial: undefined })}
            className={cn(
              'rounded-md px-2.5 py-1 text-sm font-medium transition-colors',
              !filters.initial
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {isFr ? 'Tout' : 'Tout'}
          </button>
          {initials.map((c) => (
            <button
              key={c}
              onClick={() =>
                setF({ initial: filters.initial === c ? undefined : c })
              }
              className={cn(
                'min-w-[28px] rounded-md px-2 py-1 text-sm font-medium transition-colors',
                filters.initial === c
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-slate-500">
          {isFr ? 'Aucune entrée trouvée.' : 'Pa jwenn anyen.'}
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-400">
            {total.toLocaleString('fr-FR')} {isFr ? 'résultats' : 'rezilta'}
          </p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {entries.map((e) => (
              <li
                key={e.id}
                className="group relative p-4 pr-10 hover:bg-slate-50/60"
              >
                {editingId === e.id ? (
                  <EntryEditForm
                    entry={e}
                    isFr={isFr}
                    onSaved={onSaved}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-900">
                    {e.rubrique}
                  </span>
                  {e.acte_type && (
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        ACTE_LABEL[e.acte_type]?.cls ??
                          'bg-slate-50 text-slate-600 border-slate-200',
                      )}
                    >
                      {ACTE_LABEL[e.acte_type]?.fr ?? e.acte_type}
                    </span>
                  )}
                  {e.year && (
                    <span className="text-xs font-medium text-slate-400">
                      {e.year}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {e.description}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {e.moniteur_ref_raw &&
                    (e.issue_id ? (
                      <Link
                        href={`/moniteur/${e.issue_id}`}
                        className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
                      >
                        {e.moniteur_ref_raw}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="font-medium text-slate-500">
                        {e.moniteur_ref_raw}
                      </span>
                    ))}
                  {e.cross_refs && e.cross_refs.length > 0 && (
                    <span className="text-slate-400">
                      {isFr ? 'Voir' : 'Gade'}: {e.cross_refs.join(', ')}
                    </span>
                  )}
                  {typeof e.ocr_confidence === 'number' &&
                    e.ocr_confidence < 0.6 && (
                      <span
                        className="text-amber-600"
                        title={
                          isFr
                            ? 'Confiance OCR faible — vérifier sur le scan'
                            : 'Konfyans OCR ba'
                        }
                      >
                        OCR ~{Math.round(e.ocr_confidence * 100)}%
                      </span>
                    )}
                </div>
                {isEditor && (
                  <button
                    type="button"
                    onClick={() => setEditingId(e.id)}
                    title={isFr ? 'Corriger (OCR)' : 'Korije (OCR)'}
                    className="absolute right-2 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                  </>
                )}
              </li>
            ))}
          </ul>

          {entries.length < total && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {isFr ? 'Charger plus' : 'Chaje plis'} ({entries.length}/{total})
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
