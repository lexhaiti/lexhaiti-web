'use client'

/**
 * "Voir les versions dans le temps" panel.
 *
 * Lists every recorded change to the law, grouped by year and by
 * effective date, with the amending-law link and the affected
 * article number(s) under each. Reads ``/legal-texts/{slug}/
 * amendments`` (same endpoint the /amendements page uses) so we
 * already have the version history per amended article.
 *
 * Each year row is expandable (default collapsed). Inside, each
 * date row is also expandable, showing per-amending-law groups and
 * affected articles. Lazy-fetches the data on first open so the
 * panel adds nothing to the initial law-page load.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAmendmentsForText,
  type ArticleWithHistoryRead,
} from '@/lib/api/endpoints'
import { getLevelLabel } from '@/lib/legal/headingLabels'
import type { components } from '@/lib/api-types'

type LegalHeading = components['schemas']['LegalHeadingRead']
type ArticleEmbed = components['schemas']['ArticleEmbed']

interface Props {
  lawSlug: string
  lang: 'fr' | 'ht'
  /** Effective-from fallback for v1 article versions that carry no
   *  date themselves — historically-imported texts often only have
   *  the date on the parent law. Without it those rows group under
   *  "inconnu" instead of the law's publication year. */
  lawPublicationDate?: string | null
  /** Parent law's articles + headings — used to attach a chapter /
   *  titre breadcrumb to each affected-article group inside the
   *  date-detail row ("Articles 88-7 88-4 — Titre XV : De l'Union
   *  européenne"). Both optional; the panel still renders without
   *  them, just without the heading context. */
  articles?: ArticleEmbed[]
  headings?: LegalHeading[]
  /** Subcategory of the parent law (e.g. ``constitution``,
   *  ``code_civil``). Lets the heading-level label use the
   *  right vocabulary ("Titre" vs "Livre" etc.). */
  codeSubcategory?: string | null
  /** Controlled open state. The toolbar above owns whether the
   *  panel is shown; this component handles its own data fetching
   *  + group expansion. */
  open: boolean
  onClose?: () => void
}

interface ChangeEvent {
  versionId: number
  effectiveDate: string | null
  amendingLawSlug: string | null
  amendingLawTitle: string | null
  amendingArticleNumber: string | null
  affectedArticleNumber: string
  versionNumber: number
  /** True when this is the first version of the article (the
   *  "creation" event, not a modification). */
  isCreation: boolean
}

interface YearGroup {
  year: string
  events: ChangeEvent[]
}

interface DateGroup {
  date: string
  amendingGroups: Map<string, AmendingGroup>
}

interface AmendingGroup {
  amendingLawSlug: string | null
  amendingLawTitle: string | null
  amendingArticleNumber: string | null
  affectedArticleNumbers: string[]
  isCreation: boolean
}

function dateKey(d: string | null | undefined): string {
  if (!d) return 'unknown'
  return String(d).slice(0, 10)
}

function yearKey(d: string | null | undefined): string {
  if (!d) return 'inconnu'
  const m = String(d).match(/^(\d{4})/)
  return m ? m[1] : 'inconnu'
}

function formatDateLong(iso: string | null, lang: 'fr' | 'ht'): string {
  if (!iso) return lang === 'fr' ? 'Date inconnue' : 'Dat enkoni'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return iso
  }
}

export function ChronoTimelinePanel({
  lawSlug,
  lang,
  lawPublicationDate,
  articles,
  headings,
  codeSubcategory,
  open,
}: Props) {
  const isFr = lang === 'fr'
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ArticleWithHistoryRead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(
    new Set(),
  )
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    new Set(),
  )
  const sectionRef = useRef<HTMLElement | null>(null)

  // When the panel opens, scroll its top under the sticky toolbar
  // (the page's top chrome is ~240px tall on mobile, less on
  // desktop — ``scroll-mt-[15rem]`` below covers the offset).
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 50)
    return () => window.clearTimeout(id)
  }, [open])

  // Lazy fetch on first open. Subsequent opens reuse the cache.
  useEffect(() => {
    if (!open || loaded || loading) return
    setLoading(true)
    setError(null)
    getAmendmentsForText(lawSlug)
      .then((data) => {
        setRows(data ?? [])
        setLoaded(true)
      })
      .catch(() => {
        setError(
          isFr
            ? 'Impossible de charger les versions.'
            : 'Pa kapab chaje vèsyon yo.',
        )
        setLoaded(true)
      })
      .finally(() => setLoading(false))
  }, [open, loaded, loading, lawSlug, isFr])

  // Flatten article-version rows into a list of change events.
  // V1 of an article = "creation". V2+ = modifications attributed
  // to ``source_amendment_*`` when set. v1 rows that carry no
  // effective_from fall back to ``lawPublicationDate`` so they
  // group under the law's year instead of "inconnu".
  const events = useMemo<ChangeEvent[]>(() => {
    const out: ChangeEvent[] = []
    for (const art of rows) {
      const versions = art.versions ?? []
      for (const v of versions) {
        const isCreation = v.version_number === 1
        const effDate =
          v.effective_from ??
          (isCreation ? (lawPublicationDate ?? null) : null)
        out.push({
          versionId: v.id,
          effectiveDate: effDate,
          amendingLawSlug: v.source_amendment_slug ?? null,
          amendingLawTitle:
            (lang === 'ht' && (v as any).source_amendment_title_ht
              ? (v as any).source_amendment_title_ht
              : v.source_amendment_title_fr) ?? null,
          amendingArticleNumber:
            (v as any).source_amendment_article_number ?? null,
          affectedArticleNumber: String(art.number ?? ''),
          versionNumber: v.version_number,
          isCreation,
        })
      }
    }
    // Sort by date descending (newest first), unknowns last.
    out.sort((a, b) => {
      if (!a.effectiveDate && !b.effectiveDate) return 0
      if (!a.effectiveDate) return 1
      if (!b.effectiveDate) return -1
      return b.effectiveDate.localeCompare(a.effectiveDate)
    })
    return out
  }, [rows, lang, lawPublicationDate])

  // Lookup helpers driven by ``articles`` + ``headings``. The chrono
  // panel groups affected articles by their *top-level* heading
  // (TITRE / LIVRE / PARTIE) so the reader sees the textual context
  // each amendment touched ("Articles 88-7 88-4 — Titre XV : De
  // l'Union européenne") instead of a flat row of numbers.
  const articleByNumber = useMemo(() => {
    const m = new Map<string, ArticleEmbed>()
    for (const a of articles ?? []) m.set(String(a.number ?? ''), a)
    return m
  }, [articles])

  const headingById = useMemo(() => {
    const m = new Map<number, LegalHeading>()
    for (const h of headings ?? []) m.set(h.id, h)
    return m
  }, [headings])

  // Walk an article's heading chain to its top-level ancestor
  // (parent_id === null). Returns null when we can't resolve a
  // heading (article has no heading_id, or headings prop missing).
  const topLevelHeadingForArticle = (
    articleNumber: string,
  ): LegalHeading | null => {
    const a = articleByNumber.get(articleNumber)
    if (!a || a.heading_id == null) return null
    let cur = headingById.get(a.heading_id) ?? null
    while (cur && cur.parent_id != null) {
      const parent = headingById.get(cur.parent_id)
      if (!parent) break
      cur = parent
    }
    return cur
  }

  // Initial-publication year — pinned as "Version initiale" in the
  // timeline. Falls back to the year of the earliest creation event
  // when the parent law doesn't carry a publication_date itself.
  const initialYear = useMemo<string | null>(() => {
    if (lawPublicationDate) return yearKey(lawPublicationDate)
    let earliest: string | null = null
    for (const e of events) {
      if (!e.isCreation || !e.effectiveDate) continue
      if (!earliest || e.effectiveDate < earliest) earliest = e.effectiveDate
    }
    return earliest ? yearKey(earliest) : null
  }, [lawPublicationDate, events])

  // Amendement count for a given year = distinct amending laws that
  // landed in that year. "Distinct" by slug, falling back to title +
  // article number when slug is missing.
  const amendmentCountForYear = (yg: YearGroup): number => {
    const seen = new Set<string>()
    for (const e of yg.events) {
      if (e.isCreation) continue
      const key = `${e.amendingLawSlug ?? 'none'}::${e.amendingLawTitle ?? ''}::${e.amendingArticleNumber ?? ''}`
      seen.add(key)
    }
    return seen.size
  }

  // Group: year → date → amending-law → [affected articles]
  const yearGroups = useMemo<YearGroup[]>(() => {
    const byYear = new Map<string, ChangeEvent[]>()
    for (const e of events) {
      const y = yearKey(e.effectiveDate)
      const list = byYear.get(y)
      if (list) list.push(e)
      else byYear.set(y, [e])
    }
    return Array.from(byYear.entries())
      .map(([year, events]) => ({ year, events }))
      .sort((a, b) => b.year.localeCompare(a.year))
  }, [events])

  const dateGroupsForYear = (group: YearGroup): DateGroup[] => {
    const byDate = new Map<string, AmendingGroup[]>()
    for (const e of group.events) {
      const dk = dateKey(e.effectiveDate)
      const amendKey = `${e.amendingLawSlug ?? 'none'}::${e.amendingArticleNumber ?? '_'}::${e.isCreation ? 'create' : 'modify'}`
      let dateList = byDate.get(dk)
      if (!dateList) {
        dateList = []
        byDate.set(dk, dateList)
      }
      let amendGroup = dateList.find(
        (a) =>
          `${a.amendingLawSlug ?? 'none'}::${a.amendingArticleNumber ?? '_'}::${a.isCreation ? 'create' : 'modify'}` ===
          amendKey,
      )
      if (!amendGroup) {
        amendGroup = {
          amendingLawSlug: e.amendingLawSlug,
          amendingLawTitle: e.amendingLawTitle,
          amendingArticleNumber: e.amendingArticleNumber,
          affectedArticleNumbers: [],
          isCreation: e.isCreation,
        }
        dateList.push(amendGroup)
      }
      amendGroup.affectedArticleNumbers.push(e.affectedArticleNumber)
    }
    return Array.from(byDate.entries())
      .map(([date, amendingList]) => ({
        date,
        amendingGroups: new Map(
          amendingList.map((g) => [
            `${g.amendingLawSlug ?? 'none'}::${g.amendingArticleNumber ?? '_'}::${g.isCreation ? 'create' : 'modify'}`,
            g,
          ]),
        ),
      }))
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
  }

  const toggleYear = (y: string) =>
    setExpandedYears((s) => {
      const next = new Set(s)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })

  const toggleDate = (d: string) =>
    setExpandedDates((s) => {
      const next = new Set(s)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  if (!open) return null

  return (
    <section
      ref={sectionRef}
      aria-label={
        isFr ? 'Versions dans le temps' : 'Vèsyon yo nan tan'
      }
      className="mb-6 rounded-xl border border-slate-200 bg-slate-50/40 p-5 scroll-mt-[15rem] sm:scroll-mt-[10rem]"
    >
      <header className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-primary" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">
          {isFr
            ? 'Les différentes versions dans le temps'
            : 'Diferan vèsyon yo nan tan'}
        </h2>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          {isFr ? 'Chargement de l’historique…' : 'Chajman istwa…'}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 py-2">{error}</p>
      )}

      {loaded && !loading && events.length === 0 && (
        <p className="text-sm italic text-slate-500 py-2">
          {isFr
            ? 'Aucune modification recensée pour ce texte.'
            : 'Pa gen modifikasyon pou tèks sa a.'}
        </p>
      )}

      {loaded && !loading && events.length > 0 && (
        <ol className="relative pl-7">
          {/* Continuous timeline line — anchored at x=12px so its
              center aligns with the bullet centers (each bullet is
              positioned at the same x with -translate-x-1/2). The
              line runs from a touch below the first bullet's top to
              a touch above the last bullet's bottom so it doesn't
              poke out the open ends of the column. */}
          <div
            aria-hidden
            className="absolute left-3 top-4 bottom-4 w-px bg-slate-200"
          />
          {yearGroups.map((yg) => {
            // Initial year = the law's own publication year. Render
            // it as a flat "Version initiale" pin — no child detail
            // (it's not a modification, it's the founding text), so
            // no chevron / no expandable block.
            const isInitialYear = !!initialYear && yg.year === initialYear
            const yearOpen = !isInitialYear && expandedYears.has(yg.year)
            const dateGroups = yearOpen ? dateGroupsForYear(yg) : []
            // Amendement count = number of distinct amending laws that
            // landed in this year. The previous "55 versions" mixed
            // up "articles touched" with "version events" and read as
            // misleading inflation — a single law that touches 55
            // articles is one amendement, not 55.
            const amendmentCount = amendmentCountForYear(yg)
            return (
              // ``li`` deliberately NOT ``relative`` — the bullet
              // is positioned against the OL so it sits on the
              // shared timeline line (which is also positioned
              // against the OL). Going relative on the LI would
              // push the bullet by the LI's own left edge and slide
              // it on top of the year label.
              <li key={yg.year} className="pb-4">
                {/* Bullet — centered on the timeline line at x=12px
                    via ``left-3 -translate-x-1/2``. Solid white fill
                    so the line behind it doesn't bleed through the
                    ring. ``z-10`` keeps it above the line so the
                    line visually terminates AT the bullet rather
                    than running through its center stroke. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-3 -translate-x-1/2 mt-3 w-3 h-3 rounded-full bg-white border-[3px] z-10',
                    isInitialYear ? 'border-emerald-500' : 'border-primary',
                  )}
                />
                {isInitialYear ? (
                  <div className="flex items-center gap-3 px-2 py-1.5">
                    <span className="text-sm font-bold text-primary">
                      {yg.year}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                      {isFr ? 'Version initiale' : 'Vèsyon inisyal'}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleYear(yg.year)}
                    aria-expanded={yearOpen}
                    className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white transition-colors"
                  >
                    <span className="text-sm font-bold text-primary">
                      {yg.year}{' '}
                      <span className="font-medium text-slate-500">
                        — {amendmentCount}{' '}
                        {amendmentCount > 1
                          ? isFr
                            ? 'amendements'
                            : 'amandman'
                          : isFr
                            ? 'amendement'
                            : 'amandman'}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        'w-4 h-4 text-slate-400 transition-transform',
                        yearOpen && 'rotate-90',
                      )}
                    />
                  </button>
                )}
                {yearOpen && (
                  <ul className="mt-2 ml-3 space-y-3">
                    {dateGroups.map((dg) => {
                      const dateOpen = expandedDates.has(dg.date)
                      const amendGroups = Array.from(
                        dg.amendingGroups.values(),
                      )
                      return (
                        <li key={dg.date}>
                          <button
                            type="button"
                            onClick={() => toggleDate(dg.date)}
                            aria-expanded={dateOpen}
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-white transition-colors"
                          >
                            <ChevronRight
                              aria-hidden
                              className={cn(
                                'w-3.5 h-3.5 text-slate-400 transition-transform',
                                dateOpen && 'rotate-90',
                              )}
                            />
                            <span className="text-sm font-semibold text-slate-800">
                              {formatDateLong(dg.date, lang)}
                            </span>
                          </button>
                          {dateOpen && (
                            <ul className="mt-1 ml-6 space-y-3 text-[13px] text-slate-700">
                              {amendGroups
                                .filter((g) => !g.isCreation)
                                .map((g, idx) => {
                                  // Bucket the amending group's
                                  // affected articles by their
                                  // top-level heading so the row
                                  // reads as "Articles X Y Z — Titre
                                  // N : <title>" per parent.
                                  // ``__no_heading__`` is the bucket
                                  // for articles that have no
                                  // heading at all (flat decrees) —
                                  // it renders without the trailing
                                  // titre breadcrumb.
                                  const buckets = new Map<
                                    string,
                                    {
                                      heading: LegalHeading | null
                                      numbers: string[]
                                    }
                                  >()
                                  for (const num of g.affectedArticleNumbers) {
                                    const h = topLevelHeadingForArticle(num)
                                    const key = h ? `h-${h.id}` : '__no_heading__'
                                    let b = buckets.get(key)
                                    if (!b) {
                                      b = { heading: h, numbers: [] }
                                      buckets.set(key, b)
                                    }
                                    b.numbers.push(num)
                                  }
                                  const bucketList = Array.from(buckets.values())
                                  return (
                                    <li
                                      key={idx}
                                      className="border-l-2 border-primary/30 pl-3"
                                    >
                                      <p className="leading-snug">
                                        {g.amendingLawSlug ? (
                                          <Link
                                            href={
                                              g.amendingArticleNumber
                                                ? `/loi/${g.amendingLawSlug}?view=article&article=${encodeURIComponent(g.amendingArticleNumber)}`
                                                : `/loi/${g.amendingLawSlug}`
                                            }
                                            className="text-primary font-medium hover:underline underline-offset-2"
                                          >
                                            {g.amendingLawTitle ??
                                              g.amendingLawSlug}
                                            {g.amendingArticleNumber
                                              ? ` — art. ${g.amendingArticleNumber}`
                                              : ''}
                                          </Link>
                                        ) : (
                                          <span className="italic text-slate-500">
                                            {isFr
                                              ? 'Texte modificateur inconnu'
                                              : 'Tèks modifikatè enkoni'}
                                          </span>
                                        )}{' '}
                                        <span className="font-semibold text-slate-700">
                                          {isFr ? 'a modifié :' : 'modifye :'}
                                        </span>
                                      </p>
                                      {/* Affected articles, split by
                                          top-level heading. Each
                                          bucket gets its own row so
                                          the reader sees which titre
                                          the changes landed in. */}
                                      <ul className="mt-1 pl-3 space-y-1">
                                        {bucketList.map((b, bIdx) => {
                                          const headingLabel = b.heading
                                            ? (() => {
                                                const lvl =
                                                  getLevelLabel(
                                                    b.heading.level,
                                                    lang,
                                                    codeSubcategory ?? null,
                                                  ) ?? b.heading.level
                                                const num = b.heading.number
                                                  ? ` ${b.heading.number}`
                                                  : ''
                                                const title =
                                                  (lang === 'ht' &&
                                                    b.heading.title_ht) ||
                                                  b.heading.title_fr ||
                                                  null
                                                return `${lvl}${num}${title ? ' : ' + title : ''}`
                                              })()
                                            : null
                                          return (
                                            <li
                                              key={bIdx}
                                              className="leading-snug"
                                            >
                                              <span className="text-slate-500 mr-1">
                                                {b.numbers.length > 1
                                                  ? isFr
                                                    ? 'Articles'
                                                    : 'Atik yo'
                                                  : isFr
                                                    ? 'Article'
                                                    : 'Atik'}
                                              </span>
                                              {b.numbers.map((num) => (
                                                <Link
                                                  key={num}
                                                  href={`#article-${num}`}
                                                  className="inline-block mr-1.5 text-primary hover:underline underline-offset-2"
                                                >
                                                  {num}
                                                </Link>
                                              ))}
                                              {headingLabel && (
                                                <span className="text-slate-500">
                                                  — {headingLabel}
                                                </span>
                                              )}
                                            </li>
                                          )
                                        })}
                                      </ul>
                                    </li>
                                  )
                                })}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
