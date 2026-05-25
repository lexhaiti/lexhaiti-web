/**
 * Heading-level labels for Haitian legal texts.
 *
 * Most laws follow the canonical French legal hierarchy:
 *   Partie → Livre → Titre → Chapitre → Section → Sous-section
 *
 * A handful of codes use document-specific terminology. The Code civil
 * d'Haïti, for example, is a *compilation of 36 lois* — each top-level
 * structural unit is called « LOI » in the source text, not « Livre ».
 * We model the structural unit as `level: "book"` (because that's its
 * semantic role: a top-level subdivision of a code), and override the
 * displayed label here based on the legal text's `code_subcategory`.
 *
 * Schema reference: see backend/schemas/legal_text.py and the JSON
 * import schema documented in the editorial import panel.
 *
 * To add a new code-specific override:
 *   1. Add an entry to LEVEL_LABEL_OVERRIDES keyed by `code_subcategory`
 *   2. Map only the levels that diverge from the default — fall-through
 *      to DEFAULT_LEVEL_LABELS handles the rest
 */

export type HeadingLevel =
  | 'part'
  | 'book'
  | 'title'
  | 'chapter'
  | 'section'
  | 'subsection'

export type Lang = 'fr' | 'ht'

interface BilingualLabel {
  fr: string
  ht: string
}

/** Default label for each heading level. Used unless overridden below. */
export const DEFAULT_LEVEL_LABELS: Record<HeadingLevel, BilingualLabel> = {
  part: { fr: 'Partie', ht: 'Pati' },
  book: { fr: 'Livre', ht: 'Liv' },
  title: { fr: 'Titre', ht: 'Tit' },
  chapter: { fr: 'Chapitre', ht: 'Chapit' },
  section: { fr: 'Section', ht: 'Seksyon' },
  subsection: { fr: 'Sous-section', ht: 'Sou-seksyon' },
}

/**
 * Per-code overrides. Only list the levels that diverge from the
 * default — others fall through to DEFAULT_LEVEL_LABELS.
 *
 * The key is the `code_subcategory` value from the LegalText (see the
 * `code_subcategory` enum in the import schema).
 */
export const LEVEL_LABEL_OVERRIDES: Record<
  string,
  Partial<Record<HeadingLevel, BilingualLabel>>
> = {
  /**
   * The Haitian Code civil is a compilation of 36 lois rendered by the
   * Chambre des Représentants des Communes (1825–1826). The source
   * prints each top-level division as « LOI N° I — Sur la Promulgation… »,
   * « LOI N° II — De la Jouissance… », … so the TOC label includes the
   * « N° » abbreviation (numéro) before the numeral.
   *
   * To match the verbatim source you can switch the FR string to "Loi No"
   * (no degree symbol) — both are acceptable French legal typography;
   * « N° » with the masculine ordinal indicator is the standard form.
   */
  code_civil: {
    book: { fr: 'Loi N°', ht: 'Lwa N°' },
  },
}

/**
 * Resolve the displayed label for a heading level, taking the law's
 * `code_subcategory` into account.
 *
 * Returns `null` when the level is unknown or `null/undefined`.
 */
export function getLevelLabel(
  level: string | null | undefined,
  lang: Lang,
  codeSubcategory?: string | null,
): string | null {
  if (!level) return null

  if (codeSubcategory && LEVEL_LABEL_OVERRIDES[codeSubcategory]) {
    const override =
      LEVEL_LABEL_OVERRIDES[codeSubcategory][level as HeadingLevel]
    if (override) return override[lang]
  }

  const def = DEFAULT_LEVEL_LABELS[level as HeadingLevel]
  return def ? def[lang] : null
}

/**
 * Format a heading's display number with its level prefix.
 *
 *   formatHeadingNumber('book', 'I', 'fr')                  → "Livre I"
 *   formatHeadingNumber('book', 'I', 'fr', 'code_civil')    → "Loi I"
 *   formatHeadingNumber('title', 'Ier', 'fr')               → "Titre Ier"
 *   formatHeadingNumber(null, 'Premier', 'fr')              → "Premier"
 *
 * Empty / missing number returns an empty string.
 * Optional `numberTranslations` lets the caller pass a per-lang map
 * (e.g. for « Préliminaire » → « Preliminè »).
 */
export function formatHeadingNumber(
  level: string | null | undefined,
  number: string | null | undefined,
  lang: Lang,
  codeSubcategory?: string | null,
  numberTranslations?: Record<string, string>,
): string {
  const raw = (number ?? '').trim()
  if (!raw) return ''

  const localised =
    lang === 'ht' && numberTranslations?.[raw] ? numberTranslations[raw] : raw

  const label = getLevelLabel(level, lang, codeSubcategory)
  return label ? `${label} ${localised}` : localised
}
