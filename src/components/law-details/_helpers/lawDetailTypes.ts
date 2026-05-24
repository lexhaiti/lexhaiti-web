/**
 * Shared types for the LawDetail page and its sub-components.
 */
import type { ArticleEmbed } from '@/lib/api/endpoints'

/** Whatever ``law.articles[i]`` is -- centralises the type so
 *  navigation + breadcrumb + selection callbacks stay honest
 *  instead of leaking ``any``. */
export type SelectedArticle = ArticleEmbed

/** The TOC component carries a structurally narrower ``Heading``
 *  (no ``legal_text_id``, all fields except id/key optional) and
 *  that's what its callbacks emit. */
export type HeadingAnchorRow = {
  id: number
  key: string
  parent_id?: number | null
  level?: string | null
  number?: string | null
  title_fr?: string | null
  title_ht?: string | null
  position?: number
}

/** Add-heading modal anchor. ``anchor`` selects the insertion mode:
 *  - { kind: 'after', heading } slots after that heading at the same
 *    level (most common -- TOC + on a heading row)
 *  - { kind: 'child', heading } appends under that heading (rare;
 *    reserved for a future "+ child" affordance)
 *  - { kind: 'root' } creates a top-level heading (TOC header +)
 */
export type HeadingAnchor =
  | { kind: 'after'; heading: HeadingAnchorRow }
  | { kind: 'child'; heading: HeadingAnchorRow }
  | { kind: 'root' }

/** Bilingual picker result for formal blocks (preamble, visas,
 *  considerants, enacting formula). When the page is in Kreyol
 *  and a Kreyol version exists, show it; otherwise fall back to
 *  French. */
export interface BilingualDisplay {
  value: string | null
  fallback: boolean
}

/** Bilingual picker for formal blocks. */
export function pickBilingual(
  fr: string | null | undefined,
  ht: string | null | undefined,
  currentLang: 'fr' | 'ht',
): BilingualDisplay {
  if (currentLang === 'ht') {
    if (ht && ht.trim()) return { value: ht, fallback: false }
    if (fr && fr.trim()) return { value: fr, fallback: true }
    return { value: null, fallback: false }
  }
  return { value: fr ?? null, fallback: false }
}
