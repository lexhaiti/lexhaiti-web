/**
 * Display helpers specific to Le Moniteur issues.
 */

/**
 * Prepend `N°` only when an issue number starts with a digit. Avoids
 * "N° Spécial N° 5" double-prefix when the stored number already
 * carries an edition word (e.g. "Spécial N° 5", "Extraordinaire 12").
 */
export function smartIssueNumber(raw: string): string {
  return /^[0-9]/.test(raw) ? `N° ${raw}` : raw
}

/**
 * Moniteur document categories that promote to a standalone LegalText.
 * Mirror of the backend `PROMOTABLE_TYPES` (schemas/enums.py). A
 * promotable act is always a *primary* sommaire item — never a nested
 * accompaniment — even if an import wired it under a parent entry.
 */
export const PROMOTABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'constitution',
  'code',
  'loi',
  'decret',
  'arrete',
  'convention',
  'ordonnance',
])

/**
 * True when an entry should be nested under its parent in the sommaire:
 * a real accompaniment (promulgation letter, errata, communiqué…) that
 * carries a `parent_entry_id` AND is *not* a promotable act. Promotable
 * / standalone acts stay top-level so they appear in the rollup and as
 * their own sommaire card — the import sometimes nests a substantive act
 * (e.g. an arrêté under a résolution); this keeps it visible.
 */
export function isNestedAccompaniment(entry: {
  parent_entry_id?: number | null
  detected_category?: string | null
}): boolean {
  return (
    entry.parent_entry_id != null &&
    !PROMOTABLE_CATEGORIES.has(entry.detected_category ?? '')
  )
}
