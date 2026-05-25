'use client'

import { Scale, User } from 'lucide-react'

import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import type { DecisionParty } from '@/lib/api/endpoints'
import { partyRoleLabel } from './_labels'

interface Props {
  party: DecisionParty
  /** Compact density for inline lists. */
  compact?: boolean
  className?: string
}

/** Render a single party — name, role, optional qualifier + counsel. */
export function PartyBlock({ party, compact = false, className }: Props) {
  const { t } = useT()
  const role = partyRoleLabel(t, party.role)

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-200 bg-white',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div
        className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary"
        aria-hidden
      >
        <User className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        {role && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
            {role}
          </p>
        )}
        <p className="text-sm font-bold text-slate-900 break-words">
          {party.name}
          {party.qualifier && (
            <span className="font-normal text-slate-500">
              {' '}
              — {party.qualifier}
            </span>
          )}
        </p>
        {party.counsel && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Scale className="h-3 w-3" aria-hidden />
            {party.counsel}
          </p>
        )}
      </div>
    </div>
  )
}
