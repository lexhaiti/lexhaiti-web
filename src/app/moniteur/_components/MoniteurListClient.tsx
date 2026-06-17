'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n/useT'
import { StandardPageHeader } from '@/components/shared/StandardPageHeader'
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Grid3X3,
  LayoutGrid,
  List,
  Loader2,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MobileFilterSheet } from '@/components/shared/MobileFilterSheet'
import {
  listMoniteurIssues,
  moniteurIssueSlug,
  type MoniteurIssueRead,
} from '@/lib/api/endpoints'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { cn } from '@/lib/utils'
import { type EditorialStatusFilter } from '@/components/shared/EditorialFilter'
import { MoniteurIssueCard } from '@/components/shared/MoniteurIssueCard'
import { LoadingState } from '@/components/shared/LoadingState'
import { MoniteurYearView } from './MoniteurYearView'

const STATUS_LABEL: Record<
  MoniteurIssueRead['processing_status'],
  { fr: string; ht: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  uploaded: {
    fr: 'Téléversé', ht: 'Telechaje',
    cls: 'bg-slate-100 text-slate-700 border-slate-200', Icon: FileText,
  },
  ocr_pending: {
    fr: 'OCR en cours', ht: 'OCR ap mache',
    cls: 'bg-blue-50 text-blue-700 border-blue-200', Icon: Loader2,
  },
  parsed: {
    fr: 'Analysé', ht: 'Analize',
    cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock,
  },
  reviewed: {
    fr: 'Revu', ht: 'Revize',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', Icon: CheckCircle2,
  },
  published: {
    fr: 'Publié', ht: 'Pibliye',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2,
  },
  failed: {
    fr: 'Échec', ht: 'Echèk',
    cls: 'bg-red-50 text-red-700 border-red-200', Icon: AlertTriangle,
  },
}

/**
 * Client list view for /moniteur — interactive search, editorial
 * filter, and grid of cards. Wrapped by an RSC route file
 * (`../page.tsx`) that emits per-route metadata.
 */
export default function MoniteurListClient() {
  const { t, language } = useT()
  const isFr = language === 'fr'
  const lang: 'fr' | 'ht' = isFr ? 'fr' : 'ht'
  const { isEditor } = useEditorMode()

  const [issues, setIssues] = useState<MoniteurIssueRead[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  // Editors default to "all" so the in-progress brouillons are visible
  // immediately (the whole corpus is currently drafts). The public view
  // ignores this and always shows only published issues.
  const [editorialFilter, setEditorialFilter] = useState<EditorialStatusFilter>('all')
  // Editor-only: switch between the public card grid and the year-grouped
  // review/assignment view. Defaults to grid so the page is unchanged for
  // the common case.
  const [view, setView] = useState<'grid' | 'year'>('grid')
  // Year filter for the issues list (server supports `year`; we filter the
  // loaded set client-side so the dropdown and grid stay in sync).
  const [year, setYear] = useState<number | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [cardStyle, setCardStyle] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    let cancelled = false
    const onlyPublished = isEditor ? editorialFilter === 'published' : true
    listMoniteurIssues({ only_published: onlyPublished, limit: 500 })
      .then((res) => {
        if (cancelled) return
        setIssues(res.items)
      })
      .catch(() => {
        if (cancelled) return
        setIssues([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEditor, editorialFilter])

  const availableYears = useMemo(
    () =>
      [
        ...new Set(
          issues
            .map((i) => i.publication_date?.slice(0, 4))
            .filter(Boolean) as string[],
        ),
      ]
        .map(Number)
        .sort((a, b) => b - a),
    [issues],
  )

  const filteredByQuery = query.trim()
    ? issues.filter((i) => {
        const q = query.trim().toLowerCase()
        return (
          i.number.toLowerCase().includes(q) ||
          (i.publication_date ?? '').includes(q) ||
          (i.edition_label ?? '').toLowerCase().includes(q) ||
          i.sommaire.some((s) => s.title?.toLowerCase().includes(q))
        )
      })
    : issues

  const filteredByYear = year
    ? filteredByQuery.filter((i) =>
        i.publication_date?.startsWith(String(year)),
      )
    : filteredByQuery

  const visibleIssues = isEditor && editorialFilter === 'draft'
    ? filteredByYear.filter((i) => i.processing_status !== 'published')
    : filteredByYear

  const displayIssues = [...visibleIssues].sort((a, b) => {
    const da = a.publication_date ?? ''
    const db = b.publication_date ?? ''
    return sort === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
  })

  const pillCls = (active: boolean) =>
    cn(
      'w-auto rounded-full h-9 text-sm transition-all',
      active
        ? 'bg-primary text-white border-primary hover:bg-primary/90 shadow-sm [&_svg]:text-white/60'
        : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 text-gray-700 dark:text-slate-200',
    )

  const activeFilterCount = [
    year !== null,
    sort !== 'newest',
    isEditor && editorialFilter !== 'all',
  ].filter(Boolean).length
  const resetFilters = () => {
    setYear(null)
    setSort('newest')
    setEditorialFilter('all')
  }
  // Filter selects, shared between the desktop inline row (pill) and the
  // mobile bottom sheet (`full` → full-width stacked).
  const filterSelects = (full: boolean) => {
    const trig = (active: boolean) =>
      cn(full ? 'w-full' : 'min-w-[9rem]', pillCls(active))
    return (
      <>
        {isEditor && (
          <Select
            value={editorialFilter}
            onValueChange={(v) =>
              setEditorialFilter(v as EditorialStatusFilter)
            }
          >
            <SelectTrigger className={trig(editorialFilter !== 'all')}>
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
          value={year !== null ? String(year) : 'all'}
          onValueChange={(v) => setYear(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger className={trig(year !== null)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {isFr ? 'Toutes années' : 'Tout ane'}
            </SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!full && (
          <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-slate-700" />
        )}
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as 'newest' | 'oldest')}
        >
          <SelectTrigger className={trig(sort !== 'newest')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">
              {isFr ? 'Plus récents' : 'Pi resan'}
            </SelectItem>
            <SelectItem value="oldest">
              {isFr ? 'Plus anciens' : 'Pi ansyen'}
            </SelectItem>
          </SelectContent>
        </Select>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <StandardPageHeader
        title={t('moniteur.title', { fallback: 'Le Moniteur' })}
        subtitle={t('moniteur.subtitle', {
          fallback: isFr
            ? "Journal Officiel de la République d'Haïti."
            : 'Jounal Ofisyèl Repiblik Ayiti.',
        })}
        breadcrumbs={[
          { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
          { label: 'Le Moniteur' },
        ]}
      >
        {/* Search bar inside header — same pattern as /lois */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both mt-8 max-w-3xl flex items-stretch gap-0 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/15 dark:ring-white/10 focus-within:ring-2 focus-within:ring-amber-300/60 transition-shadow">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isFr
                  ? 'Rechercher par numéro, date ou contenu…'
                  : 'Chèche pa nimewo, dat oswa konteni…'
              }
              aria-label={isFr ? 'Rechercher dans le Moniteur' : 'Chèche nan Moniteur'}
              className="w-full h-14 pl-11 pr-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 placeholder:italic placeholder:text-sm text-base outline-none"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            type="button"
            aria-label={isFr ? 'Rechercher' : 'Chèche'}
            className="inline-flex items-center gap-2 px-5 sm:px-7 bg-primary dark:bg-slate-800 text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-slate-700 active:scale-[0.99] transition-all"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isFr ? 'Rechercher' : 'Chèche'}
            </span>
          </button>
        </div>

        {/* Public entry to the printed-index browser (1900–1944). */}
        <div className="mt-4">
          <Link
            href="/moniteur/repertoire"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
          >
            <BookMarked className="h-4 w-4" />
            {isFr
              ? 'Répertoire alphabétique (1900–1944)'
              : 'Repètwa alfabetik (1900–1944)'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isEditor && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Grid ↔ year-view toggle (editor-only). The year view is the
                review/assignment work surface; the grid is the public look. */}
            <div className="inline-flex rounded-md border border-white/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === 'grid'
                    ? 'bg-white text-slate-900'
                    : 'bg-transparent text-white/80 hover:bg-white/10',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {isFr ? 'Grille' : 'Griy'}
              </button>
              <button
                type="button"
                onClick={() => setView('year')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === 'year'
                    ? 'bg-white text-slate-900'
                    : 'bg-transparent text-white/80 hover:bg-white/10',
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {isFr ? 'Par année' : 'Pa ane'}
              </button>
            </div>
            {/* Editorial status moved into the filter bar below (pill,
                /lois-style). */}
            {/* Editor-only quick action — opens the Moniteur side of
                the import flow directly with the type pre-selected.
                Visible only when ``isEditor`` is true, so the public
                /moniteur page stays clean. */}
            <Link
              href="/editorial/import?type=moniteur"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-400 text-slate-900 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-amber-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('moniteurList.importButton', {
                fallback: 'Importer un numéro',
              })}
            </Link>
            {/* "Vue éditeur" moved to the per-issue page
                (/moniteur/{slug}) — clicking an issue card opens its
                detail there, where the editor toggle swaps the public
                layout for the review work surface inline. The
                top-level button used to live here but it added a
                navigation hop and forced the editor to lose the list
                hero/search/filter on every click. */}
          </div>
        )}
      </StandardPageHeader>

      {!(isEditor && view === 'year') && !loading && (
        <div className="sticky top-16 z-30 border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950 lg:top-20">
          <div className="container py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Mobile: filters in a bottom sheet (same design as /lois) */}
              <MobileFilterSheet
                activeCount={activeFilterCount}
                title={isFr ? 'Filtres' : 'Filt'}
                applyLabel={isFr ? 'Appliquer' : 'Aplike'}
                resetLabel={isFr ? 'Réinitialiser' : 'Reyinisyalize'}
                onReset={resetFilters}
              >
                <div className="space-y-3">{filterSelects(true)}</div>
              </MobileFilterSheet>

              {/* Desktop: inline pill row */}
              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                {filterSelects(false)}

            {(year !== null ||
              sort !== 'newest' ||
              (isEditor && editorialFilter !== 'all')) && (
              <button
                type="button"
                onClick={() => {
                  setYear(null)
                  setSort('newest')
                  setEditorialFilter('all')
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isFr ? 'Réinitialiser' : 'Reyinisyalize'}
              </button>
            )}
            </div>

            {/* Grid / list view toggle (matches /lois) */}
            <div className="hidden lg:flex items-center gap-1 rounded-full bg-gray-100 p-1 px-2 dark:bg-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCardStyle('grid')}
                className={
                  cardStyle === 'grid'
                    ? 'rounded-full bg-white shadow-sm dark:bg-slate-700'
                    : 'rounded-full'
                }
                aria-label={isFr ? 'Grille' : 'Griy'}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCardStyle('list')}
                className={
                  cardStyle === 'list'
                    ? 'rounded-full bg-white shadow-sm dark:bg-slate-700'
                    : 'rounded-full'
                }
                aria-label={isFr ? 'Liste' : 'Lis'}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>
        </div>
      )}

      <div className="container py-8 lg:py-12">
        {!(isEditor && view === 'year') &&
          !loading &&
          displayIssues.length > 0 && (
            <p className="mb-6 text-sm text-slate-400">
              {displayIssues.length} {isFr ? 'numéros' : 'nimewo'}
            </p>
          )}

        {isEditor && view === 'year' ? (
          <MoniteurYearView lang={lang} />
        ) : loading ? (
          <LoadingState />
        ) : displayIssues.length > 0 ? (
          <motion.div
            // `key` forces a fresh mount whenever the filter changes so the
            // stagger animation re-runs against the new card set. Using
            // `whileInView` here was racy after a filter switch — when the
            // grid remounted already inside the viewport, the
            // IntersectionObserver sometimes never fired, leaving the
            // children locked at their `hidden` (opacity-0) variant and
            // making the page look empty even though results were loaded.
            key={`grid-${editorialFilter}`}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.04 },
              },
            }}
            className={cn(
              'grid gap-5 lg:gap-6',
              cardStyle === 'list'
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
            )}
          >
            {displayIssues.map((issue) => {
              const status = STATUS_LABEL[issue.processing_status]
              const Icon = status?.Icon
              const isDraft = issue.processing_status !== 'published'
              // Same URL for everyone — the destination renders an
              // editor toggle inline when the viewer is signed in.
              // Cards no longer fork the route by role.
              const href = `/moniteur/${moniteurIssueSlug(issue)}`

              return (
                <motion.div
                  key={issue.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="relative h-full"
                >
                  <MoniteurIssueCard
                    issue={issue}
                    href={href}
                    lang={lang}
                    sommaireLimit={4}
                    className={
                      isEditor && isDraft
                        ? 'border-l-4 border-l-amber-500'
                        : undefined
                    }
                  />
                  {/* Editor-only status pill, overlaid on top-right of the
                      card. Kept out of the shared component because only
                      editors see this and it'd otherwise clutter the
                      public surface's API. */}
                  {isEditor && status && Icon && (
                    <span
                      className={cn(
                        'absolute top-3 right-12 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md',
                        'bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm',
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-3 h-3',
                          issue.processing_status === 'ocr_pending' && 'animate-spin',
                        )}
                      />
                      {status[lang]}
                    </span>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-12 rounded-[3rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-center"
          >
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Newspaper className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              {isFr ? 'Bientôt disponible' : 'Byento disponib'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-10">
              {isFr
                ? 'La base de données complète du Moniteur est en cours de numérisation. Vous pouvez déjà retrouver les textes principaux dans la section Lois.'
                : 'Baz done konplè Moniteur a ap nimerize. Ou ka deja jwenn tèks prensipal yo nan seksyon Lwa.'}
            </p>
            <Button
              variant="outline"
              className="rounded-full border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-red-600 hover:text-red-600 px-8 h-12 font-bold transition-all"
              onClick={() => (window.location.href = '/lois')}
            >
              {isFr ? 'Voir les lois disponibles' : 'Wè lwa ki disponib yo'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
