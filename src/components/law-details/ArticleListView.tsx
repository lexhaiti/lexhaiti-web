'use client'

/**
 * Inline list of articles — the rendering surface for the law-detail
 * page's "Tous" and "Par chapitre" view modes.
 *
 * Why not just stack ``ArticleViewer`` components? Because each one is
 * heavy (versions panel, citation column, share controls, edit
 * affordances) — fine for the focused-reading mode where there's ONE
 * article on screen, but rendering 200+ of them would tank the page.
 * This list keeps each row to the essentials: number, optional title,
 * status pill (if non-default), body, and a small "Vue article
 * unique" deep-link back to the focused viewer.
 *
 * Performance notes — the list is rendered for codes up to several
 * thousand articles (Code Civil, Code Pénal). To stay responsive:
 *
 *   - The heading path for every article is precomputed once into a
 *     Map<headingId, HeadingRead[]>, so per-article rendering is
 *     O(1) on path lookup.
 *   - The set of heading ids hidden by user-collapse is precomputed
 *     once when ``collapsed`` changes; per-article filtering is then
 *     O(path-length).
 *   - The search query passes through ``useDeferredValue`` — typing
 *     stays interactive while the filter + re-render runs as a
 *     low-priority update.
 *   - ``ArticleCard`` and ``HeadingBanner`` / ``HeadingChip`` are
 *     extracted + ``React.memo``'d so unchanged rows skip re-render
 *     when the user toggles a single section or types.
 *   - Sibling-article array passed into the per-row accordions is
 *     memoized so its identity stays stable across re-renders.
 */

import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelLabel } from '@/lib/legal/headingLabels'
import { articleNumberEquals } from '@/lib/legal/articleNumber'
import { CiteArticleButton } from './CiteArticleButton'
import { PlainExplainerBox } from './PlainExplainerBox'
import { ArticleAccordions } from './ArticleAccordions'
import type { components } from '@/lib/api-types'

type ArticleEmbed = components['schemas']['ArticleEmbed']
type HeadingRead = components['schemas']['LegalHeadingRead']

interface Props {
  articles: ArticleEmbed[]
  headings: HeadingRead[]
  lawSlug: string
  /** Short title for use in citations (e.g. ``Code civil``). The list
   *  view uses this to power the per-article Citer button. */
  lawShortTitle?: string
  /** Subset of the law's headings the breadcrumb walks; used to label
   *  heading break-rows. */
  codeSubcategory?: string | null
  currentLang: 'fr' | 'ht'
  /** Empty-state label override (e.g. "No articles in this chapter"). */
  emptyLabel?: string
  /** Drives editor-only affordances in the per-row ArticleAccordions
   *  (always-visible Textes-liés / Versions chips even at zero +
   *  Ajouter une version / Corriger le parser / Supprimer pills). */
  isEditor?: boolean
  /** Parent legal text id — needed by the editor dialogs (source-law
   *  picker exclusion, after-anchor insertion). Required when
   *  isEditor is true; ignored for public viewers. */
  lawId?: number | null
  /** Parent legal text's publication date — used as the
   *  ``effective_from`` fallback for v1 article versions whose
   *  per-version row carries no date (historical imports). */
  lawPublicationDate?: string | null
  /** Called when an editor action (add version / add article /
   *  delete) succeeds, so the parent can refetch the law and the
   *  list re-renders. */
  onArticleChanged?: () => void
  /** Editor-only: focus + open an article's editor in the
   *  single-article view (edit-from-any-view). */
  onEditArticle?: (article: any) => void
  /** Search filter — when populated, the list shows only articles
   *  matching the query under the selected scope. ``sommaire`` is
   *  the default; matches against article number + ancestor heading
   *  titles. ``code`` adds the article body to the haystack. */
  searchQuery?: string
  searchScope?: 'sommaire' | 'code'
  /** Article number the page is deep-linking / scrolling to (the
   *  ``?article=N`` URL param). When set, the render window expands
   *  to include that article's row BEFORE the parent's scroll fires,
   *  so the ``id="article-N"`` target exists in the DOM even when it
   *  sits past the current window. No-op when search is active (the
   *  full filtered set is rendered then) or the number isn't found. */
  jumpToArticleNumber?: string | null
  /** When true, articles with status === 'abrogated' are hidden
   *  (and heading rows whose subtree has nothing else visible
   *  collapse too). Controlled by the DocumentToolbar above. */
  hideAbrogated?: boolean
  /** Controlled heading-collapse state. The parent owns the Set
   *  so the DocumentToolbar's Tout fermer / Tout ouvrir buttons
   *  and the per-row chevrons share one source of truth. */
  collapsed: Set<number>
  onToggleCollapsed: (id: number) => void
  /** When true, render each amended article in its V1 form (text
   *  body + title), reading from ``initialV1ById``. Articles with
   *  only one version are unaffected (their current text IS V1). */
  showInitialVersion?: boolean
  /** Map: article id → V1 body for amended articles. Populated by
   *  the parent's ``useInitialVersions`` hook. */
  initialV1ById?: Map<
    number,
    {
      text_fr: string | null
      text_ht: string | null
      title_fr: string | null
      title_ht: string | null
      effective_from: string | null
    }
  >
}

// Lowercase + strip diacritics for substring matching.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Article-number → display label. Uppercase form is what every code
// uses on a printed page, so we keep it.
function articleNumberLabel(number: string, lang: 'fr' | 'ht'): string {
  if (/^article|^atik/i.test(number)) return number
  if (number === 'premier') return lang === 'ht' ? 'Atik 1' : 'Art. premier'
  return lang === 'ht' ? `Atik ${number}` : `Art. ${number}`
}

export function ArticleListView({
  articles,
  headings,
  lawSlug,
  lawShortTitle,
  codeSubcategory,
  currentLang,
  emptyLabel,
  isEditor = false,
  lawId,
  lawPublicationDate,
  onArticleChanged,
  onEditArticle,
  searchQuery,
  searchScope = 'sommaire',
  jumpToArticleNumber = null,
  hideAbrogated = false,
  collapsed,
  onToggleCollapsed,
  showInitialVersion = false,
  initialV1ById,
}: Props) {
  const lang = currentLang
  const isFr = lang === 'fr'

  // ─── Precomputed lookups ─────────────────────────────────────────
  // headingsById + pathByHeadingId build once per (headings) change.
  // Per-article rendering pulls from these in O(1).
  const headingsById = useMemo(
    () => new Map(headings.map((h) => [h.id, h])),
    [headings],
  )

  const pathByHeadingId = useMemo(() => {
    const m = new Map<number, HeadingRead[]>()
    for (const h of headings) {
      const path: HeadingRead[] = []
      let cur: HeadingRead | undefined = h
      let safety = 12
      while (cur && safety-- > 0) {
        path.unshift(cur)
        cur = cur.parent_id ? headingsById.get(cur.parent_id) : undefined
      }
      m.set(h.id, path)
    }
    return m
  }, [headings, headingsById])

  const getPath = (id: number | null | undefined): HeadingRead[] => {
    if (!id) return []
    return pathByHeadingId.get(id) ?? []
  }

  // Stable siblings array for the ArticleAccordions component.
  // SiblingArticle requires ``slug: string`` — fall back to ''
  // for the (rare) embed where slug is missing.
  const siblingArticles = useMemo(
    () =>
      articles.map((x) => ({
        id: x.id,
        number: x.number,
        slug: x.slug ?? '',
      })),
    [articles],
  )

  // Collapse state — fully controlled. The parent (LawDetail) owns
  // the Set + the toggle so the DocumentToolbar's Tout fermer / Tout
  // ouvrir buttons and the per-row chevrons share one source of
  // truth. See ``useHeadingCollapse`` for the tree-aware semantics.

  // ─── Search filter ───────────────────────────────────────────────
  // Defer the query — the input stays interactive while the
  // filter + re-render runs as a low-priority update. Critical on
  // Code-scale corpora where 2 000+ articles re-render per keystroke.
  const deferredQuery = useDeferredValue(searchQuery ?? '')
  const q = normalize(deferredQuery.trim())

  // Sort articles by HEADING HIERARCHY first, then by their own
  // position. Without this, articles added by later amendments
  // (e.g. art 207-2bis added to Titre VI by a 2012 amendment) end up
  // appended to the end of the corpus by raw ``position`` — even
  // though they semantically belong inside an earlier Titre. That
  // makes the parent Titre's heading-row render twice: once in its
  // proper place with the original articles, and once at the very
  // end with just the amended-in article. Re-sorting by the heading
  // path puts every amended-in article back where it reads.
  //
  // Sort key: ``[...heading_path_positions, article.position]``.
  // Articles with no heading (orphans / pre-articles) get an empty
  // path prefix so they sort by their own position relative to the
  // first heading row.
  const articlesByHeading = useMemo(() => {
    const sortKey = (a: any): number[] => {
      const path = getPath(a.heading_id)
      // ``position`` on each ancestor heading + the article's own
      // position. ``?? 0`` is a defensive fallback for headings that
      // somehow lack a position (shouldn't happen in practice).
      return [
        ...path.map((h) => (h as any).position ?? 0),
        a.position ?? 0,
      ]
    }
    const cmp = (ka: number[], kb: number[]) => {
      const n = Math.max(ka.length, kb.length)
      for (let i = 0; i < n; i++) {
        const va = ka[i] ?? -1
        const vb = kb[i] ?? -1
        if (va !== vb) return va - vb
      }
      return 0
    }
    const decorated = articles.map((a) => ({ a, k: sortKey(a) }))
    decorated.sort((x, y) => cmp(x.k, y.k))
    return decorated.map((d) => d.a)
    // pathByHeadingId is the dep that matters; ``getPath`` reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, pathByHeadingId])

  const filteredArticles = useMemo(() => {
    let base = articlesByHeading
    if (hideAbrogated) {
      base = base.filter((a) => a.status !== 'abrogated')
    }
    if (!q) return base
    return base.filter((a) => {
      const num = normalize(String(a.number ?? ''))
      if (num.includes(q)) return true
      const aTitle =
        (lang === 'ht' ? (a as any).title_ht : (a as any).title_fr) ?? ''
      if (aTitle && normalize(aTitle).includes(q)) return true
      const path = getPath(a.heading_id)
      if (
        path.some((h) => {
          const ht =
            (lang === 'ht' && (h as any).title_ht
              ? (h as any).title_ht
              : (h as any).title_fr) ?? ''
          return ht && normalize(ht).includes(q)
        })
      )
        return true
      if (searchScope === 'code') {
        const body =
          ((lang === 'ht' ? a.content_ht : null) ?? a.content_fr ?? '') +
          ' ' +
          (a.content_fr ?? '')
        const text = body.replace(/<[^>]+>/g, ' ')
        if (normalize(text).includes(q)) return true
      }
      return false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articlesByHeading, q, searchScope, lang, pathByHeadingId, hideAbrogated])

  // ─── Render windowing ────────────────────────────────────────────
  // Even with ``content-visibility:auto`` skipping off-screen *paint*,
  // mounting ~2 000 ArticleCard subtrees (each with its breadcrumb,
  // explainer box, and lazy accordions) at once blows up the initial
  // render / TTI on Code-scale corpora. So we mount only the first
  // ``renderCount`` rows and grow the window as a sentinel near the
  // tail approaches the viewport.
  //
  // Search is exempt: when a query is active the filtered set is small
  // (a handful of matches) AND the matches can sit anywhere in the
  // corpus, so we render ALL of them — windowing there would hide
  // results behind the tail.
  const INITIAL_RENDER = 70
  const RENDER_CHUNK = 60
  const isSearching = q.length > 0
  const total = filteredArticles.length

  // Row index of the deep-linked article within the *current* filtered
  // set (or -1). Drives the window's lower bound so the target is
  // always mounted — both on first paint and after a filter/collapse
  // reset. Recomputed only when the target number or the set changes.
  const jumpIndex = useMemo(() => {
    if (!jumpToArticleNumber || isSearching) return -1
    // Separator-tolerant match — see lib/legal/articleNumber.ts.
    return filteredArticles.findIndex((a) =>
      articleNumberEquals(a.number, jumpToArticleNumber),
    )
  }, [jumpToArticleNumber, filteredArticles, isSearching])

  // Baseline window size for a fresh view: the initial chunk, OR — when
  // a deep-link target sits past it — just enough to include that row
  // (+1 for the row itself, + a chunk of cushion so the sentinel
  // doesn't instantly re-fire). The reset effect below snaps back to
  // THIS, not a blind INITIAL_RENDER, so deep-links survive the reset.
  const baseRenderCount =
    jumpIndex >= 0
      ? Math.max(INITIAL_RENDER, jumpIndex + 1 + RENDER_CHUNK)
      : INITIAL_RENDER

  const [renderCount, setRenderCount] = useState(baseRenderCount)

  // Reset the window whenever the *inputs that reorder / refilter the
  // visible set* change — a new search query, a collapse toggle, the
  // abrogated filter, the as-of version, or the article set itself.
  // Resets to ``baseRenderCount`` (jump-aware) so a stale large window
  // can't hide fresh matches AND a deep-link target stays mounted.
  useEffect(() => {
    setRenderCount(baseRenderCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, collapsed, hideAbrogated, articles, showInitialVersion, baseRenderCount])

  // The number of rows actually rendered this pass. When searching we
  // render everything; otherwise we clamp to the growing window, but
  // never below the jump baseline (covers the first paint before the
  // reset effect has committed, so the deep-link node exists for the
  // parent's scroll).
  const windowCount = Math.max(renderCount, baseRenderCount)
  const visibleCount = isSearching ? total : Math.min(windowCount, total)

  // IntersectionObserver sentinel — when it scrolls within ~600px of
  // the viewport, bump the window by one chunk. Re-created whenever
  // the rendered slice can still grow (visibleCount < total) so the
  // observer always watches a freshly-positioned sentinel.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const canGrow = !isSearching && visibleCount < total
  useEffect(() => {
    if (!canGrow) return
    const node = sentinelRef.current
    if (!node) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRenderCount((prev) => prev + RENDER_CHUNK)
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [canGrow, visibleCount])

  // ─── Empty state ─────────────────────────────────────────────────
  if (filteredArticles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {q
          ? isFr
            ? `Aucun article ne correspond à « ${searchQuery} ».`
            : `Pa gen atik ki koresponn ak « ${searchQuery} ».`
          : (emptyLabel ??
            (isFr
              ? 'Aucun article à afficher dans cette sélection.'
              : 'Pa gen atik nan seleksyon sa a.'))}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────
  // Track lastPath so each break-row only re-prints heading levels
  // that actually changed since the previous break.
  let lastHeadingId: number | null = -1
  let lastPath: HeadingRead[] = []

  // Render only the windowed slice. ``lastHeadingId`` / ``lastPath``
  // are recomputed from the slice start every pass, so slicing the
  // array (vs. slicing rendered JSX) keeps the heading-break sequence
  // identical to the un-windowed output for the rows we DO show.
  const rowsToRender = filteredArticles.slice(0, visibleCount)

  return (
    <div className="space-y-4">
      {rowsToRender.map((a) => {
        const headingId = a.heading_id ?? null
        const showBreak = headingId !== lastHeadingId
        lastHeadingId = headingId

        const path = getPath(headingId)
        let divergeIdx = 0
        while (
          divergeIdx < path.length &&
          divergeIdx < lastPath.length &&
          path[divergeIdx].id === lastPath[divergeIdx].id
        ) {
          divergeIdx++
        }
        const newSegments = path.slice(divergeIdx)
        if (showBreak) lastPath = path

        // Hidden by collapse? (Search active suspends collapse.)
        const hiddenByAncestor =
          !q && path.some((h) => collapsed.has(h.id))

        return (
          <div key={a.id ?? `${a.number}`}>
            {showBreak &&
              newSegments.map((h) => {
                // Accordion rule: a heading row hides entirely when
                // any *strict* ancestor is collapsed. Combined with
                // the cascading toggle, closing LOI N° 2 hides its
                // chapter chips + their article cards in one click;
                // re-opening LOI N° 2 brings the subtree back.
                const headingPath = pathByHeadingId.get(h.id) ?? [h]
                const strictAncestors = headingPath.slice(0, -1)
                const hiddenByCollapsedAncestor =
                  !q && strictAncestors.some((a) => collapsed.has(a.id))
                if (hiddenByCollapsedAncestor) return null

                // Banner-vs-chip is decided by *structural depth*,
                // not by the position in the diverge list. A
                // heading with ``parent_id === null`` is a root row
                // (Livre, Titre, LOI N°, Part, …) and always gets
                // the banner card; everything else gets the
                // centered chip. So in Code Civil every LOI row is
                // a banner; every Chapitre/Section under it is a
                // chip — even when the diverge list contains both
                // at once.
                const isRoot = h.parent_id == null
                const collapsedNow = collapsed.has(h.id)
                const lvl =
                  getLevelLabel(
                    h.level,
                    lang,
                    codeSubcategory ?? null,
                  ) ?? h.level
                const numberLabel = h.number ? `${lvl} ${h.number}` : lvl
                const headingTitle =
                  (lang === 'ht' && (h as any).title_ht
                    ? (h as any).title_ht
                    : (h as any).title_fr) ?? null
                // Indent chips by their tree depth — direct child of
                // root sits at 2rem, grandchild at 4rem, etc. Root
                // banners stay at the content-area left edge so
                // article cards line up with them.
                const depth = headingPath.length - 1
                return isRoot ? (
                  <HeadingBanner
                    key={h.id}
                    headingId={h.id}
                    numberLabel={numberLabel}
                    title={headingTitle}
                    collapsed={collapsedNow}
                    onToggle={onToggleCollapsed}
                  />
                ) : (
                  <HeadingChip
                    key={h.id}
                    headingId={h.id}
                    depth={depth}
                    numberLabel={numberLabel}
                    title={headingTitle}
                    collapsed={collapsedNow}
                    onToggle={onToggleCollapsed}
                  />
                )
              })}

            {hiddenByAncestor ? null : (
              <ArticleCard
                article={a}
                headingPath={path}
                codeSubcategory={codeSubcategory ?? null}
                lawSlug={lawSlug}
                lawShortTitle={lawShortTitle}
                lawPublicationDate={lawPublicationDate ?? null}
                isFr={isFr}
                lang={lang}
                isEditor={isEditor}
                lawId={lawId ?? null}
                siblingArticles={siblingArticles}
                onArticleChanged={onArticleChanged}
                onEditArticle={onEditArticle}
                showInitialVersion={showInitialVersion}
                initialV1={
                  showInitialVersion && a.id != null
                    ? (initialV1ById?.get(a.id) ?? null)
                    : null
                }
              />
            )}
          </div>
        )
      })}

      {/* Render-window sentinel. Sits just below the last mounted row;
          when it scrolls within ~600px of the viewport the observer
          grows the window by one chunk. Only present while more rows
          remain, so a fully-rendered list has no trailing element. */}
      {canGrow && (
        <div
          ref={sentinelRef}
          aria-hidden
          className="h-px w-full"
          data-testid="article-window-sentinel"
        />
      )}
    </div>
  )
}

// ─── Heading banner (top level — Titre / Livre / Part) ────────────
const HeadingBanner = memo(function HeadingBanner({
  headingId,
  numberLabel,
  title,
  collapsed,
  onToggle,
}: {
  headingId: number
  numberLabel: string
  title: string | null
  collapsed: boolean
  onToggle: (id: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(headingId)}
      aria-expanded={!collapsed}
      className={cn(
        'group/heading w-full text-left flex items-start gap-3 transition-colors',
        'mt-10 mb-4 first:mt-0',
        'rounded-xl border border-primary/20 dark:border-slate-700 bg-gradient-to-r from-primary/[0.05] to-transparent dark:from-slate-800/60 dark:to-transparent',
        'px-4 py-3 hover:border-primary/40 dark:hover:border-slate-600',
      )}
    >
      <ChevronDown
        className={cn(
          'w-4 h-4 flex-shrink-0 mt-0.5 transition-transform text-primary/60 group-hover/heading:text-primary',
          collapsed && '-rotate-90',
        )}
        aria-hidden
      />
      {/* Number + title — stack on mobile so a long title (e.g.
          "DE LA REPUBLIQUE D'HAÏTI: SON EMBLÈME – SES SYMBOLES")
          doesn't squash next to the chip. From sm up we keep the
          inline "TITRE I — title" reading. */}
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
        <span className="font-bold uppercase tracking-[0.18em] text-sm text-primary whitespace-nowrap">
          {numberLabel}
        </span>
        {title && (
          <span className="leading-snug text-base font-semibold text-slate-800 dark:text-slate-100">
            <span className="hidden sm:inline">— </span>
            {title}
          </span>
        )}
      </div>
    </button>
  )
})

// ─── Heading chip (Chapitre / Section / …) ────────────────────────
// Left-aligned text + chevron, indented by tree depth so children
// visually sit under their parents. Article cards stay at the
// content-area left edge so they line up with the banner above.
const HeadingChip = memo(function HeadingChip({
  headingId,
  depth,
  numberLabel,
  title,
  collapsed,
  onToggle,
}: {
  headingId: number
  /** Depth in the heading tree — 1 for a direct child of a root
   *  heading, 2 for a grandchild, etc. Drives the left indent. */
  depth: number
  numberLabel: string
  title: string | null
  collapsed: boolean
  onToggle: (id: number) => void
}) {
  return (
    <div
      className="mt-6 mb-3 flex items-center"
      style={{ paddingLeft: `${depth * 2}rem` }}
    >
      <button
        type="button"
        onClick={() => onToggle(headingId)}
        aria-expanded={!collapsed}
        className={cn(
          'inline-flex items-start gap-2 px-3 py-1.5 rounded-md max-w-full',
          'text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
        )}
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-transform text-slate-400',
            collapsed && '-rotate-90',
          )}
          aria-hidden
        />
        {/* Mirror the banner: stack on mobile so the chip stays
            compact when a section title is long. */}
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2 text-left">
          <span className="font-semibold uppercase tracking-[0.16em] text-[12px] text-primary/80 whitespace-nowrap">
            {numberLabel}
          </span>
          {title && (
            <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              <span className="hidden sm:inline">— </span>
              {title}
            </span>
          )}
        </div>
      </button>
    </div>
  )
})

// ─── Article card ─────────────────────────────────────────────────
interface ArticleCardProps {
  article: ArticleEmbed
  /** Ancestor heading chain — rendered as the article's breadcrumb
   *  ("Loi N° 2 › Chapitre II › Art. 23") so the reader keeps
   *  their bearings even when scrolling past heading rows. */
  headingPath: HeadingRead[]
  /** Drives the level-label dictionary (loi / livre / titre →
   *  rendered text), passed through to the breadcrumb. */
  codeSubcategory: string | null
  lawSlug: string
  lawShortTitle?: string
  /** Effective-from fallback for v1 article versions in the
   *  expandable VersionsPanel. */
  lawPublicationDate: string | null
  isFr: boolean
  lang: 'fr' | 'ht'
  isEditor: boolean
  lawId: number | null
  siblingArticles: Array<{ id: number; number: string; slug: string }>
  onArticleChanged?: () => void
  /** Editor-only: focus + open this article's editor in the
   *  single-article view (edit-from-any-view). */
  onEditArticle?: (article: any) => void
  /** When true, the card swaps content + title to the V1 body. */
  showInitialVersion?: boolean
  /** V1 body for an amended article — null on V1-only articles
   *  (their current text is V1) or when initial mode is off. */
  initialV1?: {
    text_fr: string | null
    text_ht: string | null
    title_fr: string | null
    title_ht: string | null
    effective_from: string | null
  } | null
}

const ArticleCard = memo(function ArticleCard({
  article,
  headingPath,
  codeSubcategory,
  lawSlug,
  lawShortTitle,
  lawPublicationDate,
  isFr,
  lang,
  isEditor,
  lawId,
  siblingArticles,
  onArticleChanged,
  onEditArticle,
  showInitialVersion = false,
  initialV1,
}: ArticleCardProps) {
  const a = article
  const numStr = String(a.number ?? '')
  const numLabel = articleNumberLabel(numStr, lang)
  const isAbrogated = a.status === 'abrogated'
  // When the user picked "Accéder à la version initiale" and this
  // article has a V1 body fetched, render that body instead of the
  // current ``content_fr / content_ht``. V1-only articles fall
  // through and keep their current text (which is their V1 anyway).
  const useInitial = showInitialVersion && !!initialV1
  const body = useInitial
    ? (((lang === 'ht' ? initialV1!.text_ht : null) ??
        initialV1!.text_fr) ??
      '')
    : ((lang === 'ht' ? a.content_ht : null) ?? a.content_fr ?? '')
  const title = useInitial
    ? ((lang === 'ht' ? initialV1!.title_ht : null) ??
      initialV1!.title_fr ??
      null)
    : (lang === 'ht' ? (a as any).title_ht : null) ??
    (a as any).title_fr ??
    null
  const versionDate = (a as any).effective_from ?? null
  const articleUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`
      : `https://www.lexhaiti.org/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`

  // Compact breadcrumb of the heading chain ending in the article
  // number — keeps the reader oriented when the heading rows above
  // have scrolled out of view, and survives a focused share where
  // only one card is in the screenshot. Always includes the article
  // number as the last crumb so the header row reads "Art. premier"
  // even on flat decrees with no heading parents.
  const breadcrumbCrumbs = useMemo(() => {
    const crumbs: Array<{ key: string; label: string }> = []
    for (const h of headingPath) {
      const lvl =
        getLevelLabel(h.level, lang, codeSubcategory) ?? h.level
      crumbs.push({
        key: `h-${h.id}`,
        label: h.number ? `${lvl} ${h.number}` : lvl,
      })
    }
    crumbs.push({ key: 'art', label: numLabel })
    return crumbs
  }, [headingPath, lang, codeSubcategory, numLabel])

  return (
    <article
      id={`article-${numStr}`}
      className={cn(
        // ``article-cv`` (content-visibility:auto) lives on the CARD,
        // not the list wrapper — so a collapsed heading (card not
        // rendered) reserves zero space instead of an intrinsic-size
        // placeholder, which was leaving big gaps between headings.
        'article-cv group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6',
        'transition-shadow hover:shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]',
        // Scroll-margin keeps the article title clear of the sticky
        // header + toolbar (~80px header + ~50px tools row = ~130px)
        // when we ``scrollIntoView(block:'start')`` from the URL
        // ?article=N jump. 8rem = 128px — close enough.
        'scroll-mt-32',
        isAbrogated && 'opacity-70',
      )}
    >
      {/* Single header row — heading-path breadcrumb on the left
          (always visible, doubles as the article-number label since
          its last crumb is "Art. premier"), action buttons on the
          right (hover-visible). The previous version repeated the
          article number as a bold "ART. PREMIER" row right under
          the breadcrumb — pure duplication, gone. */}
      <header className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {breadcrumbCrumbs.length > 0 && (
            <nav
              aria-label={
                isFr ? 'Position dans le texte' : 'Pozisyon nan tèks la'
              }
              className="flex items-center gap-1.5 min-w-0 text-[12px] text-slate-500 dark:text-slate-400"
            >
              {/* Ancestors as ONE truncating string — shows leading text
                  + ellipsis on narrow screens (e.g. "Titre I › Chapi…")
                  instead of collapsing each label to nothing, while the
                  article number (pinned, below) stays fully visible. */}
              {breadcrumbCrumbs.length > 1 && (
                <>
                  <span className="font-medium truncate min-w-0">
                    {breadcrumbCrumbs
                      .slice(0, -1)
                      .map((c) => c.label)
                      .join('  ›  ')}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0"
                  />
                </>
              )}
              {/* Article number — always fully visible. */}
              <span className="font-bold uppercase tracking-widest text-primary text-[12px] tabular-nums whitespace-nowrap flex-shrink-0">
                {breadcrumbCrumbs[breadcrumbCrumbs.length - 1].label}
              </span>
            </nav>
          )}
          {(isAbrogated || title) && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {isAbrogated && (
                <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                  {isFr ? 'Abrogé' : 'Abwoje'}
                </span>
              )}
              {title && (
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {title}
                </h3>
              )}
            </div>
          )}
        </div>
        <div className="hidden sm:inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {lawShortTitle && (
            <CiteArticleButton
              articleNumber={numStr}
              lawShortTitle={lawShortTitle}
              versionDate={versionDate}
              url={articleUrl}
              lang={lang}
            />
          )}
          <Link
            href={`/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            aria-label={
              isFr
                ? `Vue article unique — ${numStr}`
                : `Vi sèl atik — ${numStr}`
            }
            title={
              isFr
                ? 'Ouvrir cet article en mode focus (URL partageable)'
                : 'Louvri atik sa a an mòd fokis (URL pou pataje)'
            }
          >
            {isFr ? 'Vue article unique' : 'Vi sèl atik'}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {body ? (
        <div
          className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-slate-800 dark:prose-p:text-slate-200 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 article-html"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : (
        <p className="text-sm italic text-slate-400 dark:text-slate-500">
          {isFr ? 'Texte indisponible.' : 'Tèks pa disponib.'}
        </p>
      )}

      <PlainExplainerBox
        explainerFr={(a as any).explainer_fr ?? null}
        explainerHt={(a as any).explainer_ht ?? null}
        lang={lang}
      />

      {a.id != null && (
        <ArticleAccordions
          articleId={a.id}
          articleNumber={numStr}
          versionNumber={a.version_number ?? 1}
          currentTextFr={a.content_fr ?? null}
          currentTextHt={a.content_ht ?? null}
          currentTitleFr={(a as any).title_fr ?? null}
          currentEffectiveFrom={versionDate}
          sourceAmendmentSlug={
            (a as any).source_amendment_slug ?? null
          }
          sourceAmendmentTitleFr={
            (a as any).source_amendment_title_fr ?? null
          }
          sourceAmendmentTitleHt={
            (a as any).source_amendment_title_ht ?? null
          }
          sourceAmendmentArticleNumber={
            (a as any).source_amendment_article_number ?? null
          }
          lawId={lawId}
          lawPublicationDate={lawPublicationDate}
          lawSlug={lawSlug}
          siblingArticles={siblingArticles}
          isEditor={isEditor}
          currentLang={lang}
          onArticleChanged={onArticleChanged}
          onEdit={onEditArticle ? () => onEditArticle(a) : undefined}
        />
      )}
    </article>
  )
})
