'use client'

import { Gavel } from 'lucide-react'

import { useT } from '@/i18n/useT'
import type { DecisionJudge } from '@/lib/api/endpoints'
import { judgeRoleLabel } from './_labels'

interface Props {
  judges: DecisionJudge[]
  className?: string
}

/** Vertical list of magistrates with their roles. Compact card layout. */
export function JudgesList({ judges, className }: Props) {
  const { t } = useT()
  if (!judges || judges.length === 0) return null

  return (
    <ul className={className}>
      {judges.map((judge, i) => (
        <li
          key={judge.id ?? `${judge.name}-${i}`}
          className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0"
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"
            aria-hidden
          >
            <Gavel className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">{judge.name}</p>
            <p className="text-xs text-slate-500">
              {judgeRoleLabel(t, judge.role)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
