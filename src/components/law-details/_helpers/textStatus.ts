/**
 * Legal-text-level status helpers.
 *
 * The `LegalText` row carries a status that's distinct from the per-
 * article status (some articles can be abrogated independently of their
 * parent text). This module owns:
 *   - the type union of valid text-level statuses
 *   - the bilingual pill rendering metadata (label, classes, icon)
 *   - the text→article status mapping used to inherit the parent
 *     status when an article has no explicit override
 *
 * Extracted from LawDetail.tsx so the 1200-line file stops being the
 * only place that knows about status semantics.
 */
import {
  AlertTriangle,
  Archive,
  CheckCircle,
  FileText,
  PauseCircle,
  PenLine,
  ScrollText,
  ShieldOff,
  XCircle,
} from 'lucide-react'
import React from 'react'

export type TextStatus =
  | 'in_force'
  | 'abrogated'
  | 'suspended'
  | 'partially_abrogated'
  | 'historique'
  | 'draft'
  // Treaty-lifecycle statuses — only meaningful for international
  // agreements (``category === 'convention'``) but kept in the union
  // so a treaty row can render its own pill correctly.
  | 'signed'
  | 'ratified'
  | 'denounced'

export const TEXT_STATUS_PILL: Record<
  TextStatus,
  {
    label: { fr: string; ht: string }
    cls: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  in_force: {
    label: { fr: 'En vigueur', ht: 'An vigè' },
    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckCircle,
  },
  abrogated: {
    label: { fr: 'Abrogée', ht: 'Abwoje' },
    cls: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: XCircle,
  },
  suspended: {
    label: { fr: 'Suspendue', ht: 'Sispann' },
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    icon: PauseCircle,
  },
  partially_abrogated: {
    label: { fr: 'Partiellement abrogée', ht: 'Pasyèlman abwoje' },
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    icon: AlertTriangle,
  },
  historique: {
    label: { fr: 'Historique', ht: 'Istorik' },
    cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    icon: Archive,
  },
  draft: {
    label: { fr: 'Brouillon', ht: 'Bwouyon' },
    cls: 'bg-slate-500/15 text-slate-300 border-slate-400/30',
    icon: FileText,
  },
  // Treaty lifecycle: signature deposited but not yet ratified.
  // Amber = provisional (binding intent, not yet operative).
  signed: {
    label: { fr: 'Signée', ht: 'Siyen' },
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    icon: PenLine,
  },
  // Ratified by the legislator but not yet promulgated — committed
  // but not in force. Blue separates this state from both ``signed``
  // (provisional) and ``in_force`` (active).
  ratified: {
    label: { fr: 'Ratifiée', ht: 'Ratifye' },
    cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    icon: ScrollText,
  },
  // A party (Haiti or another signatory) has formally withdrawn —
  // treaty equivalent of an abrogated domestic act.
  denounced: {
    label: { fr: 'Dénoncée', ht: 'Denonse' },
    cls: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: ShieldOff,
  },
}

/**
 * Light-background variant of the status pill classes. The dark-themed
 * ``TEXT_STATUS_PILL`` above is tuned for the navy hero; this set is for
 * pills rendered on light surfaces (e.g. the pinned reader bar's gray
 * background) where translucent-on-dark colors would wash out.
 */
export const TEXT_STATUS_PILL_LIGHT: Record<TextStatus, string> = {
  in_force: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abrogated: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200',
  partially_abrogated: 'bg-amber-50 text-amber-700 border-amber-200',
  historique: 'bg-slate-100 text-slate-600 border-slate-300',
  draft: 'bg-slate-100 text-slate-600 border-slate-300',
  signed: 'bg-amber-50 text-amber-700 border-amber-200',
  ratified: 'bg-sky-50 text-sky-700 border-sky-200',
  denounced: 'bg-red-50 text-red-700 border-red-200',
}

/**
 * Map a legal-text status to the equivalent article-level status.
 * Used so individual articles inherit the parent text's status when no
 * per-article override is set in the data.
 */
export function mapTextStatusToArticleStatus(
  textStatus: string | null | undefined,
):
  | 'in_force'
  | 'abrogated'
  | 'suspended'
  | 'transferred'
  | 'obsolete'
  | undefined {
  if (!textStatus) return undefined
  switch (textStatus) {
    case 'in_force':
      return 'in_force'
    case 'abrogated':
      return 'abrogated'
    case 'suspended':
      return 'suspended'
    case 'historique':
      return 'obsolete'
    case 'partially_abrogated':
      // Default to in_force; per-article status overrides for the abrogated ones.
      return 'in_force'
    default:
      return undefined
  }
}
