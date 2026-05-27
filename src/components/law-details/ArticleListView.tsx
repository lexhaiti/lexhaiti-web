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

import { memo, useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelLabel } from '@/lib/legal/headingLabels'
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
  /** Search filter — when populated, the list shows only articles
   *  matching the query under the selected scope. ``sommaire`` is
   *  the default; matches against article number + ancestor heading
   *  titles. ``code`` adds the article body to the haystack. */
  searchQuery?: string
  searchScope?: 'sommaire' | 'code'
  /** When true, articles with status === 'abrogated' are hidden
   *  (and heading rows whose subtree has nothing else visible
   *  collapse too). Controlled by the DocumentToolbar above. */
  hideAbrogated?: boolean
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
  searchQuery,
  searchScope = 'sommaire',
  hideAbrogated = false,
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

  // ─── Collapse state ──────────────────────────────────────────────
  // Precompute the descendants of each heading once per (headings)
  // change. Powers two interactions:
  //   - Collapsing a parent → cascade all descendants into the
  //     collapsed Set, so the entire subtree is hidden in one click.
  //   - Hiding an article → just check whether any ancestor is in
  //     the collapsed Set, no walks at render time.
  const descendantsByHeadingId = useMemo(() => {
    const childrenByParent = new Map<number | null, HeadingRead[]>()
    for (const h of headings) {
      const key = h.parent_id ?? null
      const list = childrenByParent.get(key)
      if (list) list.push(h)
      else childrenByParent.set(key, [h])
    }
    const m = new Map<number, number[]>()
    for (const h of headings) {
      const out: number[] = []
      const stack = [h.id]
      while (stack.length) {
        const id = stack.pop()!
        out.push(id)
        const kids = childrenByParent.get(id)
        if (kids) for (const k of kids) stack.push(k.id)
      }
      m.set(h.id, out)
    }
    return m
  }, [headings])

  // Set<headingId> the user has clicked closed. First load starts
  // empty (everything open). Toggle is asymmetric:
  //   - Collapse → cascade descendants into the set. The whole
  //     subtree disappears in one click.
  //   - Expand → remove only the clicked heading. Descendants keep
  //     whatever state they had — so re-opening LOI N° 2 after a
  //     collapse reveals its chapter chips, but each chapter is
  //     still collapsed (chevron right, articles hidden). The user
  //     drills in level by level, table-of-contents style.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleCollapsed = (id: number) => {
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(id)) {
        next.delete(id)
      } else {
        const descendants = descendantsByHeadingId.get(id) ?? [id]
        for (const d of descendants) next.add(d)
      }
      return next
    })
  }

  // ─── Search filter ───────────────────────────────────────────────
  // Defer the query — the input stays interactive while the
  // filter + re-render runs as a low-priority update. Critical on
  // Code-scale corpora where 2 000+ articles re-render per keystroke.
  const deferredQuery = useDeferredValue(searchQuery ?? '')
  const q = normalize(deferredQuery.trim())

  const filteredArticles = useMemo(() => {
    let base = articles
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
  }, [articles, q, searchScope, lang, pathByHeadingId, hideAbrogated])

  // ─── Empty state ─────────────────────────────────────────────────
  if (filteredArticles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center text-sm text-slate-500">
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

  return (
    <div className="space-y-4">
      {/* Tout fermer / Tout ouvrir — bulk-collapse + bulk-expand
          for the whole law. Only renders when the law has actual
          hierarchy to collapse; flat decrees skip the toolbar. The
          two buttons sit at the right edge so they don't compete
          with the first heading banner below. */}
      {headings.length > 0 && (
        <div className="flex items-center justify-end gap-1 -mt-2">
          <button
            type="button"
            onClick={() =>
              setCollapsed(new Set(headings.map((h) => h.id)))
            }
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors"
            title={isFr ? 'Tout fermer' : 'Fèmen tout'}
          >
            <Minimize2 className="w-3.5 h-3.5" aria-hidden />
            {isFr ? 'Tout fermer' : 'Fèmen tout'}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-primary transition-colors"
            title={isFr ? 'Tout ouvrir' : 'Louvri tout'}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden />
            {isFr ? 'Tout ouvrir' : 'Louvri tout'}
          </button>
        </div>
      )}

      {filteredArticles.map((a) => {
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
                    onToggle={toggleCollapsed}
                  />
                ) : (
                  <HeadingChip
                    key={h.id}
                    headingId={h.id}
                    depth={depth}
                    numberLabel={numberLabel}
                    title={headingTitle}
                    collapsed={collapsedNow}
                    onToggle={toggleCollapsed}
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
              />
            )}
          </div>
        )
      })}
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
        'group/heading w-full text-left flex items-center gap-3 transition-colors',
        'mt-10 mb-4 first:mt-0',
        'rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.05] to-transparent',
        'px-4 py-3 hover:border-primary/40',
      )}
    >
      <ChevronDown
        className={cn(
          'w-4 h-4 flex-shrink-0 transition-transform text-primary/60 group-hover/heading:text-primary',
          collapsed && '-rotate-90',
        )}
        aria-hidden
      />
      <span className="font-bold uppercase tracking-[0.18em] text-sm text-primary">
        {numberLabel}
      </span>
      {title && (
        <span className="leading-snug min-w-0 text-base font-semibold text-slate-800">
          — {title}
        </span>
      )}
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
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md',
          'text-slate-700 hover:text-primary hover:bg-slate-100 transition-colors',
        )}
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 transition-transform text-slate-400',
            collapsed && '-rotate-90',
          )}
          aria-hidden
        />
        <span className="font-semibold uppercase tracking-[0.16em] text-[12px] text-primary/80">
          {numberLabel}
        </span>
        {title && (
          <span className="text-[13px] font-medium text-slate-700">
            — {title}
          </span>
        )}
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
}: ArticleCardProps) {
  const a = article
  const numStr = String(a.number ?? '')
  const numLabel = articleNumberLabel(numStr, lang)
  const isAbrogated = a.status === 'abrogated'
  const body =
    (lang === 'ht' ? a.content_ht : null) ?? a.content_fr ?? ''
  const title =
    (lang === 'ht' ? (a as any).title_ht : null) ??
    (a as any).title_fr ??
    null
  const versionDate = (a as any).effective_from ?? null
  const articleUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`
      : `https://lexhaiti.org/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`

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
        'group rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6',
        'transition-shadow hover:shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]',
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
              className="flex items-center gap-1.5 flex-wrap text-[12px] text-slate-500"
            >
              {breadcrumbCrumbs.map((c, idx) => {
                const isLast = idx === breadcrumbCrumbs.length - 1
                return (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        isLast
                          ? 'font-bold uppercase tracking-widest text-primary text-[12px] tabular-nums'
                          : 'font-medium',
                      )}
                    >
                      {c.label}
                    </span>
                    {!isLast && (
                      <ChevronRight
                        aria-hidden
                        className="w-3 h-3 text-slate-300"
                      />
                    )}
                  </span>
                )
              })}
            </nav>
          )}
          {(isAbrogated || title) && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {isAbrogated && (
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 border border-red-200">
                  {isFr ? 'Abrogé' : 'Abwoje'}
                </span>
              )}
              {title && (
                <h3 className="text-sm font-semibold text-slate-700 truncate">
                  {title}
                </h3>
              )}
            </div>
          )}
        </div>
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-primary px-2 py-1 hover:bg-slate-100 rounded-md transition-colors"
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
          className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-800 prose-strong:text-slate-900 article-html"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : (
        <p className="text-sm italic text-slate-400">
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
        />
      )}
    </article>
  )
})
