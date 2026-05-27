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
 * status pill (if non-default), body, and a small "Détails" deep-link
 * back to the focused viewer for power users who want the full
 * article surface.
 *
 * Heading break-rows: when consecutive articles cross a heading
 * boundary (Livre/Titre/Chapitre/…), the list inserts a small sticky-
 * ish heading label so the reader keeps their bearings without
 * needing the sidebar.
 *
 * Editor mode: this view is read-only on purpose. Editors get the
 * full ArticleViewer affordances by clicking "Détails" on any row.
 * Keeping bulk-view non-editorial avoids one-click destructive
 * actions on a long scroll.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
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
}

/** Lowercase + strip diacritics for substring matching. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
  onArticleChanged,
  searchQuery,
  searchScope = 'sommaire',
}: Props) {
  const lang = currentLang
  const isFr = lang === 'fr'

  const headingsById = useMemo(
    () => new Map(headings.map((h) => [h.id, h])),
    [headings],
  )

  // Walk up from a heading id, returning the full chain. Hoisted so
  // both the search filter and the render loop can reuse it.
  const headingPath = useMemo(() => {
    return (id: number | null | undefined): HeadingRead[] => {
      if (!id) return []
      const path: HeadingRead[] = []
      let cur = headingsById.get(id)
      let safety = 10
      while (cur && safety-- > 0) {
        path.unshift(cur)
        cur = cur.parent_id ? headingsById.get(cur.parent_id) : undefined
      }
      return path
    }
  }, [headingsById])

  // Click-to-collapse a heading group by its id. State is local to
  // the list view — search queries override it (collapsed sections
  // re-open when a match lands inside them).
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const toggleCollapsed = (id: number) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Search filter — applies to ``articles`` before any rendering.
  // Sommaire scope matches the article number, the article title,
  // and any ancestor heading title. Code scope adds the body text.
  // The user can search for "DISPOSITIONS FINALES" and the list
  // collapses to the articles under that heading.
  const q = normalize((searchQuery ?? '').trim())
  const filteredArticles = useMemo(() => {
    if (!q) return articles
    return articles.filter((a) => {
      const num = normalize(String(a.number ?? ''))
      if (num.includes(q)) return true
      const aTitle =
        (lang === 'ht' ? (a as any).title_ht : (a as any).title_fr) ?? ''
      if (aTitle && normalize(aTitle).includes(q)) return true
      const path = headingPath(a.heading_id)
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
        // Strip HTML tags before matching so the user doesn't get
        // false hits on <p>/<strong> markup.
        const text = body.replace(/<[^>]+>/g, ' ')
        if (normalize(text).includes(q)) return true
      }
      return false
    })
  }, [articles, q, searchScope, lang, headingPath])

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

  // Track the heading path most-recently printed so we can show only
  // the levels that *changed* on each break-row — repeating "Titre I"
  // for every chapter under it would be visual noise on a long Code.
  let lastHeadingId: number | null = -1
  let lastPath: HeadingRead[] = []
  // When the user has clicked a heading to collapse it, hide its
  // articles. Active search overrides collapse — the user is looking
  // for something so we surface matching rows regardless.
  const isCollapsed = (a: ArticleEmbed) => {
    if (q) return false
    const path = headingPath(a.heading_id)
    return path.some((h) => collapsed.has(h.id))
  }

  return (
    <div className="space-y-4">
      {filteredArticles.map((a) => {
        const headingId = a.heading_id ?? null
        const showBreak = headingId !== lastHeadingId
        lastHeadingId = headingId

        const path = headingPath(headingId)
        // Find the first level that changed since the last break —
        // only print from there down. Same Titre across consecutive
        // chapters → Titre row is skipped on subsequent breaks.
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

        // Pick the bilingual body — fall back to FR if HT is empty.
        const body =
          (lang === 'ht' ? a.content_ht : null) ?? a.content_fr ?? ''
        const title =
          (lang === 'ht' ? (a as any).title_ht : null) ??
          (a as any).title_fr ??
          null

        const numStr = String(a.number ?? '')
        const numLabel = /^article|^atik/i.test(numStr)
          ? numStr
          : lang === 'ht'
            ? `Atik ${numStr === 'premier' ? '1' : numStr}`
            : `Art. ${numStr}`

        const isAbrogated = a.status === 'abrogated'

        // Skip rendering articles inside a manually-collapsed
        // section. Break rows still render so the user can re-open
        // the section. Active search disables this.
        const hidden = isCollapsed(a)

        return (
          <div key={a.id ?? `${a.number}`}>
            {showBreak && newSegments.length > 0 && (
              <div className="mt-8 mb-4 first:mt-0 space-y-2">
                {newSegments.map((h, idx) => {
                  const lvl =
                    getLevelLabel(
                      h.level,
                      lang,
                      codeSubcategory ?? null,
                    ) ?? h.level
                  const numberLabel = h.number
                    ? `${lvl} ${h.number}`
                    : lvl
                  const headingTitle =
                    (lang === 'ht' && (h as any).title_ht
                      ? (h as any).title_ht
                      : (h as any).title_fr) ?? null
                  // First newly-printed level gets the most
                  // prominent banner-card treatment; deeper levels
                  // step down to a quieter inset row.
                  const isTopRow = idx === 0
                  const headingCollapsed = collapsed.has(h.id)
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleCollapsed(h.id)}
                      aria-expanded={!headingCollapsed}
                      className={cn(
                        'group/heading w-full text-left flex items-center gap-3 transition-colors',
                        isTopRow
                          ? // Top-level: card-like banner with navy
                            // accent. Borders + padding give it
                            // enough mass to anchor the section.
                            'rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.05] to-transparent px-4 py-3 hover:border-primary/40'
                          : // Deeper levels: subtle inset row,
                            // gold-rule accent on the left.
                            'rounded-md pl-4 pr-3 py-2 border-l-[3px] border-amber-400/70 bg-amber-50/30 hover:bg-amber-50/60',
                        idx > 0 && 'ml-4',
                      )}
                    >
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 flex-shrink-0 transition-transform',
                          'text-primary/60 group-hover/heading:text-primary',
                          headingCollapsed && '-rotate-90',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'font-bold uppercase tracking-[0.18em]',
                          isTopRow
                            ? 'text-sm text-primary'
                            : 'text-[11px] text-primary/80',
                        )}
                      >
                        {numberLabel}
                      </span>
                      {headingTitle && (
                        <span
                          className={cn(
                            'leading-snug min-w-0',
                            isTopRow
                              ? 'text-base font-semibold text-slate-800'
                              : 'text-[13px] font-medium text-slate-700',
                          )}
                        >
                          — {headingTitle}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {hidden ? null : (
            <article
              id={`article-${numStr}`}
              className={cn(
                'group rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6',
                'transition-shadow hover:shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]',
                isAbrogated && 'opacity-70',
              )}
            >
              <header className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <span className="text-[12px] font-bold uppercase tracking-widest text-primary tabular-nums">
                    {numLabel}
                  </span>
                  {isAbrogated && (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700 border border-red-200">
                      {isFr ? 'Abrogé' : 'Abwoje'}
                    </span>
                  )}
                  {title && (
                    <h3 className="text-sm font-semibold text-slate-700 truncate">
                      — {title}
                    </h3>
                  )}
                </div>
                <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {lawShortTitle && (
                    <CiteArticleButton
                      articleNumber={numStr}
                      lawShortTitle={lawShortTitle}
                      versionDate={(a as any).effective_from ?? null}
                      url={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`
                          : `https://lexhaiti.org/loi/${lawSlug}?view=article&article=${encodeURIComponent(numStr)}`
                      }
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
                        ? "Ouvrir cet article en mode focus (URL partageable)"
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

              {/* Plain-language explainer slot — only renders when the
                  editor has filled an explainer_fr / explainer_ht field
                  on this article. Reads ``(a as any).explainer_*`` so
                  it works gracefully today (no fields present, no
                  render) and lights up automatically once the backend
                  schema is extended. */}
              <PlainExplainerBox
                explainerFr={(a as any).explainer_fr ?? null}
                explainerHt={(a as any).explainer_ht ?? null}
                lang={lang}
              />

              {/* Unified action row — Textes liés / Versions /
                  Comparer pills + expandable panels. Same visual
                  vocabulary as the focused ArticleViewer. Each chip
                  lazy-loads its own data; the public visibility
                  rule hides chips with no content (editors always
                  see them so empty articles can be diagnosed). */}
              {a.id != null && (
                <ArticleAccordions
                  articleId={a.id}
                  articleNumber={String(a.number ?? '')}
                  versionNumber={a.version_number ?? 1}
                  currentTextFr={a.content_fr ?? null}
                  currentTextHt={a.content_ht ?? null}
                  currentTitleFr={(a as any).title_fr ?? null}
                  lawId={lawId ?? null}
                  lawSlug={lawSlug}
                  siblingArticles={articles.map((x) => ({
                    id: x.id,
                    number: x.number,
                    slug: x.slug,
                  }))}
                  isEditor={isEditor}
                  currentLang={lang}
                  onArticleChanged={onArticleChanged}
                />
              )}
            </article>
            )}
          </div>
        )
      })}
    </div>
  )
}
