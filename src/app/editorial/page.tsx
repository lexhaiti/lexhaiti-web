'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowRight,
  Braces,
  CalendarRange,
  ChevronDown,
  Clock,
  FileCheck,
  FilePen,
  FileText,
  Gavel,
  GitMerge,
  Languages,
  Loader2,
  Newspaper,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { useT } from '@/i18n/useT'
import {
  getTranslationStats,
  listEditorialTexts,
  type TranslationStats,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { categoryLabel, categoryBadgeClass } from '@/lib/legal/labels'

type LegalTextListItem = components['schemas']['LegalTextListItem']

export default function EditorialDashboardPage() {
  const { isEditor, role, user, status } = useEditorMode()
  const { language } = useT()
  const isFr = language !== 'ht'

  const [stats, setStats] = useState<TranslationStats | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [allLaws, setAllLaws] = useState<LegalTextListItem[] | null>(null)
  const [drafts, setDrafts] = useState<LegalTextListItem[] | null>(null)
  const [pendingReview, setPendingReview] = useState<LegalTextListItem[] | null>(null)
  const [lawsQuery, setLawsQuery] = useState('')
  const [openYears, setOpenYears] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!isEditor) return
    let cancelled = false
    getTranslationStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message ?? String(e))
      })
    listEditorialTexts({ limit: 100 })
      .then((res) => {
        if (!cancelled) setAllLaws(res.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setAllLaws([])
      })
    listEditorialTexts({ editorial_status: 'draft', limit: 10 })
      .then((res) => {
        if (!cancelled) setDrafts(res.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setDrafts([])
      })
    listEditorialTexts({ editorial_status: 'pending_review', limit: 10 })
      .then((res) => {
        if (!cancelled) setPendingReview(res.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setPendingReview([])
      })
    return () => {
      cancelled = true
    }
  }, [isEditor])

  // Group laws by their publication year. Texts without a date land
  // in a trailing "(année inconnue)" bucket so the editor can spot
  // and fix them rather than have them silently disappear. The
  // search box filters the list ahead of grouping; an active query
  // also forces every matching year open so hits aren't hidden
  // behind a collapsed accordion.
  const lawsByYear = useMemo(() => {
    if (!allLaws) return null
    const q = lawsQuery.trim().toLowerCase()
    const matches = q
      ? allLaws.filter(
          (law) =>
            (law.title_fr || '').toLowerCase().includes(q) ||
            (law.title_ht || '').toLowerCase().includes(q) ||
            (law.slug || '').toLowerCase().includes(q),
        )
      : allLaws
    const groups = new Map<string, LegalTextListItem[]>()
    for (const law of matches) {
      const year = law.publication_date
        ? law.publication_date.slice(0, 4)
        : '—'
      const bucket = groups.get(year) ?? []
      bucket.push(law)
      groups.set(year, bucket)
    }
    return Array.from(groups.entries()).sort((a, b) => {
      // Numeric years descending; unknown year always last.
      if (a[0] === '—') return 1
      if (b[0] === '—') return -1
      return Number(b[0]) - Number(a[0])
    })
  }, [allLaws, lawsQuery])

  // Seed openYears once the data arrives: pop the most recent (first
  // in the sorted list) open by default, everything else collapsed.
  // ``useEffect`` rather than ``useMemo`` because we only want to
  // initialize once; subsequent user toggles persist.
  useEffect(() => {
    if (openYears !== null) return
    if (!lawsByYear || lawsByYear.length === 0) return
    setOpenYears(new Set([lawsByYear[0][0]]))
  }, [lawsByYear, openYears])

  // Active query forces every year-with-hits open so matches aren't
  // hidden behind a collapsed accordion. ``effectiveOpen`` is the
  // render-time set; we don't mutate ``openYears`` so toggles after
  // clearing the search restore the user's prior accordion state.
  const recentTexts = useMemo(() => {
    if (!allLaws) return null
    return [...allLaws]
      .sort((a, b) => {
        const da = a.updated_at ?? a.publication_date ?? ''
        const db = b.updated_at ?? b.publication_date ?? ''
        return db.localeCompare(da)
      })
      .slice(0, 5)
  }, [allLaws])

  const effectiveOpenYears = useMemo(() => {
    if (lawsQuery.trim() && lawsByYear) {
      return new Set(lawsByYear.map(([year]) => year))
    }
    return openYears ?? new Set<string>()
  }, [lawsQuery, lawsByYear, openYears])

  function toggleYear(year: string) {
    setOpenYears((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

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
            {isFr
              ? 'Cette page est réservée aux éditeurs connectés.'
              : 'Paj sa a pou editè ki konekte sèlman.'}
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {isFr ? 'Se connecter' : 'Konekte'} →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="relative bg-primary dark:bg-slate-900 text-white overflow-hidden border-b border-white/5 dark:border-slate-800">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-20 pt-28 lg:pt-36">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
              { label: isFr ? 'Éditorial' : 'Editoryal' },
            ]}
          />
          <div className="flex items-end gap-5 flex-wrap animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="inline-flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-2xl lg:text-3xl font-bold shadow-xl shadow-red-900/40 ring-4 ring-white/10 flex-shrink-0">
              {(user?.name?.[0] ?? user?.email?.[0] ?? 'E').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl lg:text-5xl font-black leading-tight tracking-tight text-white">
                {isFr ? 'Bonjour' : 'Bonjou'},{' '}
                {user?.name ?? user?.email?.split('@')[0] ?? ''}
              </h1>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  {role ?? 'editor'}
                </span>
                <span className="text-sm text-slate-400">
                  {new Date().toLocaleDateString(isFr ? 'fr-FR' : 'fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
          {/* Corpus overview strip */}
          {stats && (
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-500 delay-150 fill-mode-both">
              <OverviewStat
                label={isFr ? 'Textes' : 'Tèks'}
                value={stats.legal_texts_total}
              />
              <OverviewStat
                label={isFr ? 'Articles' : 'Atik'}
                value={stats.articles_total}
              />
              <OverviewStat
                label={isFr ? 'Traduits' : 'Tradui'}
                value={stats.articles_translated}
                pct={
                  stats.articles_total > 0
                    ? Math.round(
                        (stats.articles_translated / stats.articles_total) * 100,
                      )
                    : 0
                }
              />
              <OverviewStat
                label="Moniteur"
                value={stats.moniteur_entries_total}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10 lg:py-12 space-y-10">
      {/* Quick actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <DashboardCard
          href="/editorial/loi/new"
          icon={Sparkles}
          title={isFr ? 'Nouveau texte' : 'Nouvo tèks'}
          subtitle={
            isFr
              ? 'Saisie manuelle — loi, décret, arrêté…'
              : 'Antre alamen — lwa, dekrè, areté…'
          }
        />
        <DashboardCard
          href="/editorial/moniteur/new"
          icon={Newspaper}
          title={isFr ? 'Nouveau Moniteur' : 'Nouvo Moniteur'}
          subtitle={
            isFr
              ? 'Numéro + sommaire structuré'
              : 'Nimewo + somè estriktire'
          }
        />
        <DashboardCard
          href="/editorial/import"
          icon={Sparkles}
          title={isFr ? 'Importer un texte' : 'Enpòte yon tèks'}
          subtitle={
            isFr
              ? 'PDF/DOCX français — avec ou sans Kreyòl'
              : 'PDF/DOCX fransè — ak oswa san Kreyòl'
          }
        />
        <DashboardCard
          href="/editorial/moniteur"
          icon={Newspaper}
          title={isFr ? 'Le Moniteur' : 'Le Moniteur'}
          subtitle={
            isFr ? 'Numéros + sommaire à réviser' : 'Nimewo + somè pou revize'
          }
        />
        <DashboardCard
          href="/editorial/translations"
          icon={Languages}
          title={isFr ? 'Traductions' : 'Tradiksyon'}
          subtitle={
            isFr ? 'Liste des textes à traduire' : 'Lis tèks pou tradui'
          }
        />
        <DashboardCard
          href="/editorial/chronologie"
          icon={CalendarRange}
          title={isFr ? 'Chronologie' : 'Kwonoloji'}
          subtitle={
            isFr
              ? '1 728 références (1804-2000) à vérifier'
              : '1,728 referans (1804-2000) pou verifye'
          }
        />
        {/* Jurisprudence — full editorial console for court decisions
            (list, create from JSON, inline metadata + body editing).
            Mirrors the legal-text editorial flow. */}
        <DashboardCard
          href="/editorial/jurisprudence"
          icon={Gavel}
          title={isFr ? 'Jurisprudence' : 'Jirispridans'}
          subtitle={
            isFr
              ? 'Arrêts et jugements — brouillons et publications'
              : 'Arè ak jijman — bouyon ak piblikasyon'
          }
        />
        {/* Ajouter un amendement — wire an amending law to N target
            articles in one JSON payload. Mirrors the legal-text JSON
            import flow but produces ``LegalChange`` graph rows + new
            article versions instead of a brand-new text. */}
        <DashboardCard
          href="/editorial/amend"
          icon={GitMerge}
          title={isFr ? 'Ajouter un amendement' : 'Ajoute yon amandman'}
          subtitle={
            isFr
              ? 'Lier une loi modificative à des articles cibles'
              : 'Lyen yon lwa modifikasyon ak atik sib yo'
          }
        />
        {/* JSON dev — moved off the global "+" dropdown into this
            console so the header dropdown stays clean (only Console
            éditoriale + Gérer les utilisateurs). The card surfaces
            the bulk-paste flow for legal texts + Moniteur issues. */}
        <DashboardCard
          href="/editorial/import?type=json"
          icon={Braces}
          title={isFr ? 'JSON (dev)' : 'JSON (dev)'}
          subtitle={
            isFr
              ? 'Import brut — texte légal ou Moniteur en JSON'
              : 'Enpòte brit — tèks legal oswa Moniteur an JSON'
          }
        />
      </section>

      {/* Pipeline — drafts + pending review */}
      {((drafts && drafts.length > 0) || (pendingReview && pendingReview.length > 0)) && (
        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <FilePen className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {isFr ? 'Textes à traiter' : 'Tèks pou trete'}
            </h2>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts && drafts.length > 0 && (
              <PipelineCard
                title={isFr ? 'Brouillons' : 'Bouyon'}
                icon={FileText}
                count={drafts.length}
                accent="amber"
                items={drafts}
                lang={isFr ? 'fr' : 'ht'}
              />
            )}
            {pendingReview && pendingReview.length > 0 && (
              <PipelineCard
                title={isFr ? 'En attente de révision' : 'Ap tann revizyon'}
                icon={FileCheck}
                count={pendingReview.length}
                accent="blue"
                items={pendingReview}
                lang={isFr ? 'fr' : 'ht'}
              />
            )}
          </div>
        </section>
      )}

      {/* Recently updated texts */}
      {recentTexts && recentTexts.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {isFr ? 'Dernières modifications' : 'Dènye modifikasyon'}
            </h2>
          </header>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {recentTexts.map((law) => {
              const title =
                (isFr ? law.title_fr : law.title_ht || law.title_fr) || law.slug
              const date = law.updated_at ?? law.publication_date
              return (
                <Link
                  key={law.id}
                  href={`/loi/${law.slug}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${categoryBadgeClass(law.category)}`}
                  >
                    {categoryLabel(law.category, isFr ? 'fr' : 'ht')}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary truncate transition-colors">
                    {title}
                  </span>
                  {date && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0">
                      {new Date(date).toLocaleDateString(isFr ? 'fr-FR' : 'fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Translation stats */}
      {err && <ErrorBanner>{err}</ErrorBanner>}

      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {isFr ? 'Couverture des traductions' : 'Kouvèti tradiksyon yo'}
          </h2>
        </header>
        {stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label={isFr ? 'Textes au corpus' : 'Tèks nan kòpis'}
              value={stats.legal_texts_total}
              icon={FileText}
            />
            <StatCard
              label={isFr ? 'Au moins partiellement traduits' : 'Omwen pasyèlman tradui'}
              value={stats.legal_texts_with_ht}
              accent="emerald"
            />
            <StatCard
              label={isFr ? 'Entièrement traduits' : 'Tradui konplètman'}
              value={stats.legal_texts_fully_translated}
              accent="emerald"
            />
            <StatCard
              label={isFr ? 'Aucune traduction' : 'Pa gen tradiksyon'}
              value={stats.legal_texts_fr_only}
              accent="amber"
            />
            <StatCard
              label={isFr ? 'Articles au corpus' : 'Atik nan kòpis'}
              value={stats.articles_total}
              icon={FileText}
            />
            <StatCard
              label={isFr ? 'Articles traduits' : 'Atik tradui'}
              value={stats.articles_translated}
              accent="emerald"
              hint={
                stats.articles_total > 0
                  ? `${Math.round((stats.articles_translated / stats.articles_total) * 100)}%`
                  : undefined
              }
            />
            <StatCard
              label={isFr ? 'Entrées Moniteur' : 'Antre Moniteur'}
              value={stats.moniteur_entries_total}
              icon={Newspaper}
            />
            <StatCard
              label={isFr ? 'Avec source HT' : 'Ak sous HT'}
              value={stats.moniteur_entries_with_translation_pointer}
              accent="emerald"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            {isFr ? 'Chargement…' : 'Chaje…'}
          </div>
        )}
      </section>

      {/* Pending pointers callout — only when there are entries to fix */}
      {stats && stats.moniteur_entries_pending_translation > 0 && (
        <section className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 mb-1">
                {isFr ? 'En attente d’une source HT' : 'Ap tann sous HT'}
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {isFr
                  ? `${stats.moniteur_entries_pending_translation} entrée(s) du Moniteur ont été promues mais n'ont pas encore de source de traduction.`
                  : `${stats.moniteur_entries_pending_translation} antre Moniteur pwomòte san sous tradiksyon.`}
              </p>
            </div>
            <Link
              href="/editorial/moniteur"
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-800"
            >
              {isFr ? 'Voir les numéros' : 'Wè nimewo yo'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      )}

      {/* All laws grouped by publication year — quick inventory for
          editors. Single-column list (one text per line) for fast
          scanning, accordion per year so older buckets stay folded
          by default, and a sticky search filter at the top of the
          block for instant title lookup. */}
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {isFr ? 'Tous les textes par année' : 'Tout tèks pa ane'}
          </h2>
          {allLaws && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 tabular-nums">
              {allLaws.length}
            </span>
          )}
        </header>
        {/* Search filter — purely client-side, hits title_fr / title_ht
            / slug. Active query also force-opens every accordion. */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={lawsQuery}
            onChange={(e) => setLawsQuery(e.target.value)}
            placeholder={
              isFr
                ? 'Filtrer par titre ou slug…'
                : 'Filtre pa tit oswa slug…'
            }
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {lawsQuery && (
            <button
              type="button"
              onClick={() => setLawsQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-1"
              aria-label={isFr ? 'Effacer le filtre' : 'Efase filtè'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {lawsByYear === null ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
            {isFr ? 'Chargement…' : 'Chaje…'}
          </div>
        ) : lawsByYear.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic px-1">
            {lawsQuery.trim()
              ? isFr
                ? 'Aucun texte ne correspond à ce filtre.'
                : 'Pa gen tèks ki koresponn ak filtè sa a.'
              : isFr
                ? 'Aucun texte au corpus.'
                : 'Pa gen tèks nan kòpis la.'}
          </p>
        ) : (
          <div className="space-y-2">
            {lawsByYear.map(([year, items]) => {
              const isOpen = effectiveOpenYears.has(year)
              return (
                <div
                  key={year}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleYear(year)}
                    aria-expanded={isOpen}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left',
                      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                      isOpen && 'bg-slate-50/60 dark:bg-slate-800/40',
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform',
                        !isOpen && '-rotate-90',
                      )}
                    />
                    <span className="text-xl font-black text-slate-300 dark:text-slate-600 tabular-nums leading-none">
                      {year}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 tabular-nums">
                      {items.length}{' '}
                      {items.length === 1
                        ? isFr
                          ? 'texte'
                          : 'tèks'
                        : isFr
                          ? 'textes'
                          : 'tèks'}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                          {items.map((law) => (
                            <li
                              key={law.id}
                              className="px-4 py-2.5 text-sm leading-relaxed hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <Link
                                href={`/loi/${law.slug}`}
                                className="text-slate-700 dark:text-slate-300 hover:text-primary hover:underline underline-offset-2"
                              >
                                {(isFr
                                  ? law.title_fr
                                  : law.title_ht || law.title_fr) ||
                                  law.slug}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </section>
      </div>
    </div>
  )
}

function DashboardCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:border-primary/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors" />
        <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </Link>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  hint?: string
  icon?: React.ComponentType<{ className?: string }>
  accent?: 'emerald' | 'amber'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white dark:bg-slate-900 p-4',
        accent === 'emerald'
          ? 'border-emerald-100 dark:border-emerald-500/20'
          : accent === 'amber'
            ? 'border-amber-100 dark:border-amber-500/20'
            : 'border-slate-200 dark:border-slate-800',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-tight">
          {label}
        </p>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />}
      </div>
      <p className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-2xl font-black tabular-nums leading-none',
            accent === 'emerald'
              ? 'text-emerald-700 dark:text-emerald-400'
              : accent === 'amber'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-slate-900 dark:text-slate-100',
          )}
        >
          {value.toLocaleString('fr-FR')}
        </span>
        {hint && (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {hint}
          </span>
        )}
      </p>
    </div>
  )
}

function OverviewStat({
  label,
  value,
  pct,
}: {
  label: string
  value: number
  pct?: number
}) {
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums text-white leading-none">
          {value.toLocaleString('fr-FR')}
        </span>
        {pct !== undefined && (
          <span className="text-xs font-semibold text-emerald-400 tabular-nums">
            {pct}%
          </span>
        )}
      </div>
    </div>
  )
}

function PipelineCard({
  title,
  icon: Icon,
  count,
  accent,
  items,
  lang,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  count: number
  accent: 'amber' | 'blue'
  items: LegalTextListItem[]
  lang: 'fr' | 'ht'
}) {
  const borderCls = accent === 'amber' ? 'border-amber-200 dark:border-amber-500/30' : 'border-blue-200 dark:border-blue-500/30'
  const bgCls = accent === 'amber' ? 'bg-amber-50/60 dark:bg-amber-500/10' : 'bg-blue-50/60 dark:bg-blue-500/10'
  const countCls = accent === 'amber' ? 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20' : 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/20'
  return (
    <div className={cn('rounded-xl border p-5', borderCls, bgCls)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
        <span className={cn('ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 tabular-nums', countCls)}>
          {count}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((law) => (
          <li key={law.id}>
            <Link
              href={`/loi/${law.slug}`}
              className="text-sm text-slate-700 dark:text-slate-300 hover:text-primary hover:underline underline-offset-2 line-clamp-1"
            >
              {(lang === 'fr' ? law.title_fr : law.title_ht || law.title_fr) || law.slug}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
