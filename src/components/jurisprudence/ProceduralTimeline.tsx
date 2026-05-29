'use client'

import { Landmark } from 'lucide-react'

import { useT } from '@/i18n/useT'
import { formatLongDate } from '@/lib/format/date'
import type { DecisionProceduralStep } from '@/lib/api/endpoints'
import { courtLabel } from './_labels'

interface Props {
  steps: DecisionProceduralStep[]
}

/**
 * Vertical timeline of prior procedural steps — typically TPI →
 * Cour d'appel → Cour de cassation. Each node renders the court,
 * date, optional label and outcome. Rendered chronologically (the
 * order in which the backend returns them; the backend is
 * responsible for sorting).
 */
export function ProceduralTimeline({ steps }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'
  if (!steps || steps.length === 0) return null

  return (
    <ol className="relative space-y-6 pl-6">
      {/* Vertical line. */}
      <span
        aria-hidden
        className="absolute left-2.5 top-2 bottom-2 w-px bg-gradient-to-b from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700"
      />
      {steps.map((step, i) => {
        const label =
          (lang === 'ht' && step.label_ht) || step.label_fr || null
        return (
          <li
            key={step.id ?? `${step.date}-${i}`}
            className="relative"
          >
            <span
              aria-hidden
              className="absolute -left-[1.4rem] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900 ring-2 ring-primary/40"
            >
              <Landmark className="h-2.5 w-2.5 text-primary" />
            </span>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                {courtLabel(t, step.court)}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {label ?? formatLongDate(step.date, lang, step.date)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {label
                  ? formatLongDate(step.date, lang, step.date)
                  : null}
                {step.case_number && (
                  <span className="ml-2 inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    · N° {step.case_number}
                  </span>
                )}
              </p>
              {step.outcome && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 italic">
                  {step.outcome}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
