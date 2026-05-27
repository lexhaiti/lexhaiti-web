/**
 * Detect the "shape" of a legal text so the law-detail page can pick
 * the right layout + view-mode affordances.
 *
 * Three shapes:
 *
 *  - ``'document'``   — flat (no chapter/section headings) AND short
 *                       (≤ FLAT_DOC_MAX_ARTICLES articles). Renders as
 *                       a printed-document layout: title + métadonnées
 *                       + préambule + articles inline + signature
 *                       block. No view-mode switcher (there's only one
 *                       sensible layout for a 6-article décret).
 *
 *  - ``'switchable'`` — anything else with parsed articles. Renders
 *                       the existing law-detail page plus a 2- or
 *                       3-mode switcher (Tous / Par chapitre / Un
 *                       article). The "Par chapitre" option is only
 *                       offered when the text actually has chapter
 *                       headings, so a flat-but-long décret-loi gets
 *                       Tous + Un article only.
 *
 *  - ``'richtext'``   — backend's ``display_mode === 'document'``: the
 *                       whole text is stored as a single HTML blob,
 *                       not as parsed articles. The existing
 *                       ``DocumentBody`` component handles it; this
 *                       module exists so callers can short-circuit
 *                       before bothering with article filtering.
 *
 * The detection is intentionally based on (hasHeadings, articleCount)
 * and NOT on the legal-text category. A décret-loi with a real TOC
 * gets the switchable layout exactly like a Code; a short décret
 * without headings gets the document layout. Category is irrelevant.
 */

const FLAT_DOC_MAX_ARTICLES = 30

export type LegalTextShape = 'document' | 'switchable' | 'richtext'

export interface ShapeInput {
  /** Backend ``display_mode`` field — 'document' means rich-text blob,
   *  anything else (default 'articles') means parsed structure. */
  displayMode?: string | null
  /** Number of parsed articles. 0 ⇒ no articles, treat as richtext or
   *  document with empty body. */
  articleCount: number
  /** Number of heading rows (Livre / Titre / Chapitre / Section / …). */
  headingCount: number
}

export function detectShape(input: ShapeInput): LegalTextShape {
  if ((input.displayMode ?? 'articles') === 'document') return 'richtext'
  if (input.articleCount === 0) return 'richtext'
  if (
    input.headingCount === 0 &&
    input.articleCount <= FLAT_DOC_MAX_ARTICLES
  ) {
    return 'document'
  }
  return 'switchable'
}

/**
 * Which view-mode buttons make sense for this shape.
 *
 *  - ``'document'`` and ``'richtext'`` get nothing (the layout already
 *    fits the shape).
 *  - ``'switchable'`` with chapters → all three modes.
 *  - ``'switchable'`` without chapters → only ``tous`` and ``article``.
 */
export type ViewMode = 'tous' | 'chapitre' | 'article'

export function availableViewModes(
  shape: LegalTextShape,
  hasChapters: boolean,
): ViewMode[] {
  if (shape !== 'switchable') return []
  if (hasChapters) return ['tous', 'chapitre', 'article']
  return ['tous', 'article']
}
