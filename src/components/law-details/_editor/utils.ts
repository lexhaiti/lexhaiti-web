/**
 * Shared utilities for rich-text editing on the law-detail surface.
 *
 * Kept tag-agnostic so the same helpers apply to article bodies and
 * formal blocks (préambule, visas, considérants, enacting formula).
 */

/**
 * Tiptap emits ``<p></p>`` (or nested empty tags) for a cleared
 * editor — a string truthiness check misses that. Strip tags + any
 * whitespace (including ``&nbsp;``) and check the remainder so "the
 * editor looks empty to the user" is what we measure, not "the HTML
 * string has any characters at all."
 */
export function isHtmlEffectivelyEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|\s+/g, '')
      .length === 0
  )
}

/**
 * Heuristic: does this body string look like HTML?
 *
 * True for any string that contains at least one HTML tag (opening
 * OR closing). Before, the regex only matched strings that *started*
 * with a tag — which broke linkified content like
 * ``"Vu les articles <a class=\"rt-art-ref\">282</a>, ..."`` (starts
 * with prose, has tags mid-string). Those were falling through to
 * the plain-text branch and rendering with the angle brackets
 * escaped.
 *
 * The new regex requires a tag with a letter immediately after ``<``
 * (so prose like ``"x < 5"`` doesn't false-positive). False for
 * legacy plain-text bodies imported before Tiptap shipped, so the
 * existing paragraph splitter stays in charge of those.
 */
const HTML_BODY_RE = /<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>/i

export function looksLikeHtml(value: string | null | undefined): boolean {
  if (!value) return false
  return HTML_BODY_RE.test(value)
}
