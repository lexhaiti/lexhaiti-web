'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, ChevronDown, MinusCircle, XCircle } from 'lucide-react'

import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import type { DecisionMoyen } from '@/lib/api/endpoints'
import { moyenOutcomeClass, moyenOutcomeLabel } from './_labels'

interface Props {
  moyen: DecisionMoyen
  /** Whether to render the moyen expanded by default. */
  defaultOpen?: boolean
}

function OutcomeIcon({ outcome }: { outcome: string | null | undefined }) {
  if (outcome === 'accepted') return <CheckCircle2 className="h-3.5 w-3.5" />
  if (outcome === 'rejected') return <XCircle className="h-3.5 w-3.5" />
  return <MinusCircle className="h-3.5 w-3.5" />
}

/**
 * Collapsible card for a single moyen (ground of appeal). Header
 * shows the moyen number/title + outcome badge; the body holds the
 * petitioner's argument and the court's response side-by-side on
 * desktop, stacked on mobile.
 */
export function MoyenAccordion({ moyen, defaultOpen = false }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Field names match the backend Pydantic Moyen schema (see
  // schemas/decision.py): ``title``, ``body_fr/ht``, ``court_response_fr/ht``.
  // The frontend used to look for ``title_fr`` / ``argument_fr`` / ``response_fr``
  // which never matched anything coming off the API and rendered every
  // moyen as an empty card.
  const m = moyen as DecisionMoyen & {
    title?: string | null
    body_fr?: string | null
    body_ht?: string | null
    court_response_fr?: string | null
    court_response_ht?: string | null
  }
  const title =
    m.title ||
    (lang === 'ht' && m.title_ht) ||
    m.title_fr ||
    `${t('jurisprudence.moyen.ground')} ${m.number}`
  const argument =
    (lang === 'ht' && (m.body_ht || m.argument_ht)) ||
    m.body_fr ||
    m.argument_fr ||
    null
  const response =
    (lang === 'ht' && (m.court_response_ht || m.response_ht)) ||
    m.court_response_fr ||
    m.response_fr ||
    null

  return (
    <div
      className={cn(
        'rounded-xl border bg-white overflow-hidden transition-all duration-200',
        isOpen
          ? 'border-primary/30 shadow-[0_6px_16px_-8px_rgba(13,27,76,0.12)]'
          : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
          isOpen ? 'bg-primary/[0.03]' : 'hover:bg-slate-50',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold tabular-nums">
            {moyen.number}
          </span>
          <span className="text-sm font-bold text-slate-900 line-clamp-2">
            {title}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          {moyen.outcome && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                moyenOutcomeClass(moyen.outcome),
              )}
            >
              <OutcomeIcon outcome={moyen.outcome} />
              {moyenOutcomeLabel(t, moyen.outcome)}
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.2 },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-slate-100 px-5 pb-5 pt-5">
              <div className="grid gap-5 md:grid-cols-2">
                {argument && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                      {t('jurisprudence.moyen.petitionerArgument')}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                      {argument}
                    </p>
                  </div>
                )}
                {response && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
                      {t('jurisprudence.moyen.courtResponse')}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                      {response}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
