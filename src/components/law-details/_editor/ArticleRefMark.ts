/**
 * Tiptap mark for the editor-inserted article reference link.
 *
 * Renders the same anchor shape the backend linkifier
 * (``services/text/linkify.py``) emits, so the markup round-trips
 * through ``_sanitize_article_html`` (api: ``services/editorial/service.py``)
 * untouched:
 *
 *   - Same-law (relative):
 *     ``<a class="rt-art-ref" data-article="N" href="?article=N">…</a>``
 *   - Cross-text (absolute, when ``targetSlug`` is set):
 *     ``<a class="rt-art-ref" data-article="N" data-target="SLUG"
 *        href="/loi/SLUG?article=N">…</a>``
 *
 * The sanitizer enforces ``href`` to match one of those two shapes
 * exactly (``\d+(?:[-.]\d+)*`` for the number; ``[a-z0-9-]+`` for the
 * slug). We do the same up-front normalisation here so editors can
 * type a free-form input ("art. 9 bis") and we still emit a valid
 * anchor that survives the sanitizer.
 *
 * The mark is paste-safe: ``parseHTML`` matches anchors that already
 * carry the ``rt-art-ref`` class, so loading a previously-saved body
 * round-trips through the editor with all attributes preserved.
 */
import { Mark, mergeAttributes } from '@tiptap/react'

export interface ArticleRefAttributes {
  /** The article number as typed by the editor — e.g. "295", "267.2",
   *  "1382-1". Only the ``\d+(?:[-.]\d+)*`` portion ends up in
   *  ``href``/``data-article``; anything else is stripped. */
  articleNumber: string
  /** Slug of the target legal text for cross-text links. ``null``
   *  (or empty) means same-law — the anchor uses the relative
   *  ``?article=N`` shape. */
  targetSlug: string | null
}

/** Extract the canonical article number ("267.2", "1382-1") from a
 *  free-form input. Returns null when no digit run is found.
 *  Matches the regex the backend sanitizer accepts on ``href``. */
export function normalizeArticleNumber(input: string): string | null {
  if (!input) return null
  const m = /\d+(?:[-.]\d+)*/.exec(input.trim())
  return m ? m[0] : null
}

/** True when the slug matches the sanitizer's ``data-target`` /
 *  ``href`` slug alphabet (lowercase ASCII letters, digits, hyphens). */
export function isValidTargetSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

export const ArticleRefMark = Mark.create({
  name: 'articleRef',

  // Inclusive — typing at the right edge of the mark extends it, the
  // same UX as for links in a typical Tiptap setup.
  inclusive: true,

  // Stand it ahead of the inline marks (bold/italic) so the anchor
  // wraps the formatted run rather than the other way around — keeps
  // the sanitizer happy (``<a><strong>…</strong></a>`` is valid; the
  // inverse trips no rules but reads worse in the DOM).
  priority: 1000,

  addAttributes() {
    return {
      articleNumber: {
        default: '',
        // Read from ``data-article`` so the round-trip from a saved
        // anchor is loss-less.
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-article') ?? '',
        // ``renderHTML`` is handled in ``renderHTML`` below — we need
        // both ``data-article`` and ``href`` derived from the same
        // value, plus the optional ``data-target`` / absolute ``href``
        // when ``targetSlug`` is set. Returning ``{}`` from each
        // attribute's renderer keeps Tiptap from double-stamping.
        renderHTML: () => ({}),
      },
      targetSlug: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-target') || null,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      {
        // Match anchors that carry the ``rt-art-ref`` class — both
        // linkifier-emitted (data-article present) and editor-inserted
        // (same shape). Tiptap's matcher walks every ``<a>``; the
        // ``getAttrs`` predicate filters down to ours and pulls the
        // attribute set for the mark.
        tag: 'a.rt-art-ref',
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false
          const articleNumber = node.getAttribute('data-article') || ''
          if (!articleNumber) return false
          const targetSlug = node.getAttribute('data-target') || null
          return { articleNumber, targetSlug }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, mark }) {
    const { articleNumber, targetSlug } = mark.attrs as ArticleRefAttributes
    const num = normalizeArticleNumber(articleNumber) ?? ''
    const slug =
      targetSlug && isValidTargetSlug(targetSlug) ? targetSlug : null

    // The relative shape is the default; cross-text uses the absolute
    // path so the sanitizer's strict allowlist accepts both forms
    // without further config.
    const href = slug
      ? `/loi/${slug}?article=${num}`
      : `?article=${num}`

    const attrs: Record<string, string> = {
      class: 'rt-art-ref',
      'data-article': num,
      href,
    }
    if (slug) attrs['data-target'] = slug

    return ['a', mergeAttributes(HTMLAttributes, attrs), 0]
  },
})
