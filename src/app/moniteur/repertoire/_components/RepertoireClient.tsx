'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BookMarked,
  Check,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useT } from '@/i18n/useT'
import { StandardPageHeader } from '@/components/shared/StandardPageHeader'
import { MobileFilterSheet } from '@/components/shared/MobileFilterSheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { cn } from '@/lib/utils'
import {
  getMoniteurIndexFacets,
  listMoniteurIndex,
  listTexts,
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
  status?: string
  q?: string
  sort: Sort
}

const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors'
const PILL_OFF = 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
const PILL_ON = 'bg-slate-900 text-white border-slate-900'

/** Pill-style trigger for shadcn Select (matches /lois & /moniteur). */
const PILL_TRIGGER = (active: boolean) =>
  cn(
    'w-auto rounded-full h-9 text-sm transition-all',
    active
      ? 'bg-primary text-white border-primary hover:bg-primary/90 shadow-sm [&_svg]:text-white/60'
      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  )

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
    editorial_status: entry.editorial_status ?? 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [linked, setLinked] = useState<{
    id: number
    slug: string
    title: string
  } | null>(
    entry.legal_text_id && entry.legal_text_slug
      ? {
          id: entry.legal_text_id,
          slug: entry.legal_text_slug,
          title: entry.legal_text_title ?? entry.legal_text_slug,
        }
      : null,
  )
  const [lawQ, setLawQ] = useState('')
  const [lawResults, setLawResults] = useState<
    { id: number; slug: string; title_fr: string }[]
  >([])

  // debounced corpus-law search (skipped once a law is linked)
  useEffect(() => {
    if (linked || lawQ.trim().length < 2) {
      setLawResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const res = await listTexts({ q: lawQ.trim(), limit: 6 })
        if (!cancelled)
          setLawResults(
            (res.items ?? []) as { id: number; slug: string; title_fr: string }[],
          )
      } catch {
        if (!cancelled) setLawResults([])
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [lawQ, linked])

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
        legal_text_id: linked?.id ?? null,
        editorial_status: d.editorial_status,
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

      {/* Link to a law in the corpus */}
      <div className="rounded-md border border-slate-200 bg-white p-2">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link2 className="h-3.5 w-3.5" />
          {isFr ? 'Loi liée (corpus)' : 'Lwa ki lye (kòpis)'}
        </div>
        {linked ? (
          <div className="flex items-center justify-between gap-2 rounded bg-emerald-50 px-2 py-1.5 text-sm ring-1 ring-emerald-200">
            <span className="truncate text-emerald-900">{linked.title}</span>
            <button
              type="button"
              onClick={() => setLinked(null)}
              title={isFr ? 'Délier' : 'Delye'}
              className="shrink-0 text-emerald-700 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={lawQ}
              onChange={(e) => setLawQ(e.target.value)}
              placeholder={isFr ? 'Rechercher une loi…' : 'Chèche yon lwa…'}
              className={inputCls}
            />
            {lawResults.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                {lawResults.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setLinked({
                          id: l.id,
                          slug: l.slug,
                          title: l.title_fr,
                        })
                        setLawQ('')
                        setLawResults([])
                      }}
                      className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-slate-50"
                    >
                      {l.title_fr}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Editorial status */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">
          {isFr ? 'Statut' : 'Estati'}:
        </span>
        {(['draft', 'published'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setD({ ...d, editorial_status: s })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              d.editorial_status === s
                ? s === 'published'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-amber-500 bg-amber-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
            )}
          >
            {s === 'published'
              ? isFr
                ? 'Publié'
                : 'Pibliye'
              : isFr
                ? 'Brouillon'
                : 'Bouyon'}
          </button>
        ))}
      </div>

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
        status: filters.status,
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
    !!filters.initial ||
    !!filters.year ||
    !!filters.acte_type ||
    !!filters.status ||
    !!filters.q
  const activeCount = [
    filters.initial,
    filters.year,
    filters.acte_type,
    filters.status,
    filters.q,
  ].filter(Boolean).length

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

  // Filter selects, shared between the desktop inline row (pill, `w-auto`)
  // and the mobile bottom sheet (`full` → `w-full` stacked).
  const filterSelects = (full: boolean) => {
    const trig = (active: boolean) =>
      cn(full ? 'w-full' : 'min-w-[9rem]', PILL_TRIGGER(active))
    return (
      <>
        <Select
          value={filters.year != null ? String(filters.year) : 'all'}
          onValueChange={(v) =>
            setF({ year: v === 'all' ? undefined : Number(v) })
          }
        >
          <SelectTrigger className={trig(filters.year != null)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {isFr ? 'Toutes années' : 'Tout ane'}
            </SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.acte_type ?? 'all'}
          onValueChange={(v) => setF({ acte_type: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className={trig(!!filters.acte_type)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {isFr ? 'Tous types' : 'Tout kalite'}
            </SelectItem>
            {acteTypes.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTE_LABEL[a]?.fr ?? a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isEditor && (
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => setF({ status: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className={trig(!!filters.status)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {isFr ? 'Tous statuts' : 'Tout estati'}
              </SelectItem>
              <SelectItem value="published">
                {isFr ? 'Publiés' : 'Pibliye'}
              </SelectItem>
              <SelectItem value="draft">
                {isFr ? 'Brouillons' : 'Bouyon'}
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.sort}
          onValueChange={(v) => setF({ sort: v as Sort })}
        >
          <SelectTrigger className={trig(filters.sort !== 'rubrique')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['rubrique', 'year', 'date'] as Sort[]).map((s) => (
              <SelectItem key={s} value={s}>
                {sortLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    )
  }

  const searchField = (
    <div className="relative min-w-[180px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={qDraft}
        onChange={(e) => setQDraft(e.target.value)}
        placeholder={
          isFr ? 'Rechercher (rubrique, acte…)' : 'Chèche (rubrik, zak…)'
        }
        className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400"
      />
    </div>
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

      {/* Filter toolbar — full-width sticky band (matches /lois & /moniteur) */}
      <div className="sticky top-16 z-30 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 lg:top-20">
        <div className="container space-y-3 py-4">
          {/* Mobile: compact Filtres button (sheet = selects only) + the
              search bar below it (like /lois) */}
          <div className="space-y-3 lg:hidden">
            <MobileFilterSheet
              activeCount={activeCount}
              title={isFr ? 'Filtres' : 'Filt'}
              applyLabel={isFr ? 'Appliquer' : 'Aplike'}
              resetLabel={isFr ? 'Réinitialiser' : 'Reyinisyalize'}
              onReset={reset}
            >
              <div className="space-y-3">{filterSelects(true)}</div>
            </MobileFilterSheet>
            {searchField}
          </div>

          {/* Desktop: inline pill row */}
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {filterSelects(false)}

            {searchField}

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
      </div>

      <div className="container py-8 lg:py-12">
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
                  {isEditor && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        e.editorial_status === 'published'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700',
                      )}
                    >
                      {e.editorial_status === 'published'
                        ? isFr
                          ? 'Publié'
                          : 'Pibliye'
                        : isFr
                          ? 'Brouillon'
                          : 'Bouyon'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">
                  {e.description}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {e.legal_text_slug && (
                    <Link
                      href={`/loi/${e.legal_text_slug}`}
                      className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                    >
                      <Link2 className="h-3 w-3" />
                      {e.legal_text_title ?? e.legal_text_slug}
                    </Link>
                  )}
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
