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

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
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
}: Props) {
  const lang = currentLang
  const isFr = lang === 'fr'

  if (articles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center text-sm text-slate-500">
        {emptyLabel ??
          (isFr
            ? 'Aucun article à afficher dans cette sélection.'
            : 'Pa gen atik nan seleksyon sa a.')}
      </div>
    )
  }

  const headingsById = new Map(headings.map((h) => [h.id, h]))

  // Walk from a heading up to the top, returning the chain as a flat
  // path. Used to label heading break-rows with the full lineage so
  // "Chapitre II" actually reads in context.
  const headingPath = (id: number | null | undefined): HeadingRead[] => {
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

  // Track which heading id was last printed so we know when to emit a
  // new break-row.
  let lastHeadingId: number | null = -1

  return (
    <div className="space-y-4">
      {articles.map((a) => {
        const headingId = a.heading_id ?? null
        const showBreak = headingId !== lastHeadingId
        lastHeadingId = headingId

        const path = headingPath(headingId)
        const breakLabel = path
          .map((h) => {
            const lvl =
              getLevelLabel(h.level, lang, codeSubcategory ?? null) ?? h.level
            return `${lvl} ${h.number ?? ''}`.trim()
          })
          .join(' › ')

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

        return (
          <div key={a.id ?? `${a.number}`}>
            {showBreak && breakLabel && (
              <div className="mt-6 mb-3 first:mt-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">
                  {breakLabel}
                </p>
                <div className="mt-1 h-px w-12 bg-amber-400/70" />
              </div>
            )}

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
                        ? `Détails de l'article ${numStr}`
                        : `Detay atik ${numStr}`
                    }
                  >
                    {isFr ? 'Détails' : 'Detay'}
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
          </div>
        )
      })}
    </div>
  )
}
