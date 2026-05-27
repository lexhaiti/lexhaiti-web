/**
 * Pick a short, citation-friendly name for a legal text.
 *
 * Legal idiom in francophone systems abbreviates common codes:
 *   - Code civil      → C. civ.
 *   - Code pénal      → C. pén.
 *   - Code de procédure civile → C. pr. civ.
 *   - Constitution    → Const. (no real shortening, but consistent)
 *
 * For everything else (décrets, lois ordinaires, arrêtés…) we use the
 * full ``title_fr`` because there's no standard short cite — better to
 * be unambiguous than clever.
 *
 * Pure function, no I/O. Pass the FR title in.
 */
export function lawShortCite(titleFr: string | null | undefined): string {
  if (!titleFr) return ''
  const t = titleFr.trim()
  const lower = t.toLowerCase()

  // Order matters — match the more specific compounds first.
  if (lower.startsWith('code de procédure civile')) return 'C. pr. civ.'
  if (lower.startsWith('code de procédure pénale')) return 'C. pr. pén.'
  if (lower.startsWith('code de commerce')) return 'C. com.'
  if (lower.startsWith('code du travail')) return 'C. trav.'
  if (lower.startsWith('code civil')) return 'C. civ.'
  if (lower.startsWith('code pénal')) return 'C. pén.'
  if (lower.startsWith('code rural')) return 'C. rural'
  if (lower.startsWith('constitution')) return 'Const.'

  // Everything else — return the original title (callers can pass it
  // to the cite formatter unchanged).
  return t
}
