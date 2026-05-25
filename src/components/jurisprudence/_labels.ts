/**
 * Localized label helpers for decision-related enums (court type,
 * outcome, party role, judge role, moyen outcome). Each helper takes
 * the raw backend value + the active language and returns the
 * display string. Falls back to a humanized form of the raw value
 * (replace `_` with spaces, title-case the first letter) when the
 * key isn't in the i18n dictionary — that way the UI doesn't break
 * if the backend introduces a new enum variant.
 */

import type {
  CourtType,
  DecisionJudgeRole,
  DecisionOutcome,
  DecisionPartyRole,
  MoyenOutcome,
} from '@/lib/api/endpoints'

type Lang = 'fr' | 'ht'
type TFn = (key: string, opts?: { fallback?: string }) => string

function humanize(raw: string): string {
  if (!raw) return ''
  const spaced = raw.replace(/[_-]/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function courtLabel(t: TFn, court: CourtType | string | null | undefined, opts?: { short?: boolean }): string {
  if (!court) return ''
  const ns = opts?.short ? 'jurisprudence.courtsShort' : 'jurisprudence.courts'
  return t(`${ns}.${court}`, { fallback: humanize(court) })
}

export function outcomeLabel(t: TFn, outcome: DecisionOutcome | string | null | undefined): string {
  if (!outcome) return ''
  return t(`jurisprudence.outcomes.${outcome}`, { fallback: humanize(outcome) })
}

export function partyRoleLabel(t: TFn, role: DecisionPartyRole | string | null | undefined): string {
  if (!role) return ''
  return t(`jurisprudence.partyRoles.${role}`, { fallback: humanize(role) })
}

export function judgeRoleLabel(t: TFn, role: DecisionJudgeRole | string | null | undefined): string {
  if (!role) return ''
  return t(`jurisprudence.judgeRoles.${role}`, { fallback: humanize(role) })
}

export function moyenOutcomeLabel(t: TFn, outcome: MoyenOutcome | string | null | undefined): string {
  if (!outcome) return ''
  return t(`jurisprudence.moyen.${outcome}`, { fallback: humanize(outcome) })
}

/** Style class for an outcome badge — colored consistent with the
 *  semantic meaning. Returns base+text+border classes. */
export function outcomeBadgeClass(outcome: DecisionOutcome | string | null | undefined): string {
  switch (outcome) {
    case 'rejet':
      // Rejection of the appeal → the lower decision stands → neutral/positive
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'cassation':
    case 'cassation_partielle':
      // The appellate court overturns → notable, attention-grabbing
      return 'bg-red-50 text-red-700 border-red-200'
    case 'confirmation':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'infirmation':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'irrecevabilite':
      return 'bg-slate-100 text-slate-600 border-slate-200'
    case 'desistement':
      return 'bg-slate-50 text-slate-500 border-slate-200'
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  }
}

/** Style class for a moyen outcome (accepted / rejected / unaddressed). */
export function moyenOutcomeClass(outcome: MoyenOutcome | string | null | undefined): string {
  switch (outcome) {
    case 'accepted':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

/** Extract a short FR/HT-localized title from a list-item — prefers
 *  `title_*` when the backend has synthesized one (e.g. "Pétion-Ville
 *  Club S.A. c/ Jean Claude Noël"), falls back to the first line of
 *  the summary, then to a generic "Arrêt du <date>" label. */
export function decisionTitle(
  item: {
    title_fr?: string | null
    title_ht?: string | null
    summary_fr?: string | null
    summary_ht?: string | null
    decision_date?: string | null
  },
  lang: Lang,
  fallback: string,
): string {
  const title = lang === 'ht' ? item.title_ht : item.title_fr
  if (title?.trim()) return title.trim()
  const summary = lang === 'ht' ? item.summary_ht : item.summary_fr
  if (summary?.trim()) {
    const firstLine = summary.trim().split(/\n+/)[0]
    // Cap at ~140 chars so list rows stay one or two lines.
    return firstLine.length > 160 ? firstLine.slice(0, 157) + '…' : firstLine
  }
  return fallback
}

export type { Lang }
