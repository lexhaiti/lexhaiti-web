/**
 * Article-number canonicalization for matching across data shapes.
 *
 * French legal practice uses two interchangeable notations for
 * sub-articles:
 *
 *   - Dash form  ``11-1``  — the common modern convention in French
 *                            civil law (Code civil, etc.) and in the
 *                            LexHaïti Constitution corpus.
 *   - Dot form   ``11.1``  — used in constitutional citations and
 *                            most academic / parliamentary writing
 *                            (e.g. "L'article 11.1 dispose que …").
 *
 * Both refer to the same article. When the linkifier scans body text
 * it captures whichever the author wrote, so an amending law can emit
 * ``?article=11.1`` while the destination Constitution stores the
 * article as ``number = "11-1"``. A naïve ``===`` comparison misses.
 *
 * This helper collapses dots to dashes so equal-modulo-separator
 * forms compare equal. Use it on **both** sides of any article-number
 * comparison, lookup, or DOM-id construction.
 *
 *   normalizeArticleNumber("11.1")  === "11-1"
 *   normalizeArticleNumber("11-1")  === "11-1"
 *   normalizeArticleNumber("295")   === "295"
 *   normalizeArticleNumber(null)    === ""
 *
 * Pure, no I/O. Cheap enough to call on every render.
 */
export function normalizeArticleNumber(
  s: string | number | null | undefined,
): string {
  if (s == null) return ''
  return String(s).trim().replace(/\./g, '-')
}

/**
 * True when two article numbers refer to the same article modulo
 * separator convention. Use in place of ``a === b`` when matching
 * a ``?article=`` URL param against an article's ``number`` field.
 */
export function articleNumberEquals(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  return normalizeArticleNumber(a) === normalizeArticleNumber(b)
}
