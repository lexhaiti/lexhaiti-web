'use client'

import { useT } from '@/i18n/useT'
import type { DecisionJudge } from '@/lib/api/endpoints'
import { judgeRoleLabel } from './_labels'

interface Props {
  judges: DecisionJudge[]
  className?: string
}

/**
 * Composition de la juridiction — editorial layout grouped by function
 * (siège, ministère public, greffe). No icons; the typography does the
 * work. Reads like the masthead of a French legal journal:
 *
 *   JUGES DU SIÈGE
 *   ──────────────────────────────────────────────
 *     Jules Cantave              Vice-président
 *     Antoine Norgaisse          Juge
 *     …
 *
 *   MINISTÈRE PUBLIC
 *   ──────────────────────────────────────────────
 *     Joseph Emmanuel Saint-Amour  Substitut
 *
 *   GREFFE
 *   ──────────────────────────────────────────────
 *     Jean Fritz Satiné            Greffier
 *
 * Roles that don't fit a named group fall through to "Autres" so the
 * component degrades gracefully on incomplete data.
 */

type GroupKey = 'siege' | 'ministere' | 'greffe' | 'autres'

const GROUP_FOR_ROLE: Record<string, GroupKey> = {
  president: 'siege',
  vice_president: 'siege',
  juge: 'siege',
  rapporteur: 'siege',
  conseiller: 'siege',
  substitut: 'ministere',
  commissaire_gouvernement: 'ministere',
  avocat_general: 'ministere',
  procureur: 'ministere',
  procureur_general: 'ministere',
  greffier: 'greffe',
  greffier_en_chef: 'greffe',
}

const GROUP_TITLES: Record<GroupKey, { fr: string; ht: string }> = {
  siege: { fr: 'Juges du siège', ht: 'Jij syèj la' },
  ministere: { fr: 'Ministère public', ht: 'Ministè piblik' },
  greffe: { fr: 'Greffe', ht: 'Grèf' },
  autres: { fr: 'Autres', ht: 'Lòt' },
}

const GROUP_ORDER: GroupKey[] = ['siege', 'ministere', 'greffe', 'autres']

export function JudgesList({ judges, className }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'

  if (!judges || judges.length === 0) return null

  // Bucket judges by their functional group. The same role can be listed
  // multiple times (e.g. two substituts) so we use arrays, not sets.
  const groups: Record<GroupKey, DecisionJudge[]> = {
    siege: [],
    ministere: [],
    greffe: [],
    autres: [],
  }

  for (const j of judges) {
    const key: GroupKey = GROUP_FOR_ROLE[j.role ?? ''] ?? 'autres'
    groups[key].push(j)
  }

  return (
    <div className={className}>
      {GROUP_ORDER.filter((g) => groups[g].length > 0).map((groupKey, gi) => (
        <section
          key={groupKey}
          className={gi === 0 ? '' : 'mt-8 pt-8 border-t border-slate-200 dark:border-slate-800'}
        >
          {/* Group eyebrow + thin rule */}
          <div className="mb-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">
              {GROUP_TITLES[groupKey][lang]}
            </p>
            <div className="mt-2 h-px bg-gradient-to-r from-amber-200 via-slate-200 to-transparent dark:from-amber-500/40 dark:via-slate-700 dark:to-transparent"></div>
          </div>

          {/* Two-column layout: name on the left, role on the right */}
          <ul className="space-y-2.5">
            {groups[groupKey].map((judge, i) => (
              <li
                key={judge.id ?? `${judge.name}-${i}`}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-0.5"
              >
                <span className="font-serif text-base font-medium text-slate-900 dark:text-slate-100 leading-snug">
                  {judge.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {judgeRoleLabel(t, judge.role)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
