'use client'

import { Calendar, Hash, Landmark, Scale } from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { formatLongDate } from '@/lib/format/date'
import type { DecisionDetail } from '@/lib/api/endpoints'

import {
  courtLabel,
  decisionTitle,
  outcomeBadgeClass,
  outcomeLabel,
} from './_labels'

interface Props {
  decision: DecisionDetail
}

/**
 * Dark navy hero band at the top of the decision detail page. Mirrors
 * the visual language of LawHero (same gradient, same grid pattern,
 * same h-20 spacer for the fixed menu) — but tailored to a court
 * decision: court · section eyebrow, "Arrêt du <date>" headline,
 * parties title, outcome + subject chips.
 */
export function DecisionHero({ decision }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'

  const court = courtLabel(t, decision.court)
  const courtShort = courtLabel(t, decision.court, { short: true })
  const dateStr = formatLongDate(
    decision.decision_date,
    lang,
    decision.decision_date,
  )
  const title = decisionTitle(decision, lang, `${t('jurisprudence.decisionOf').replace('{date}', dateStr)}`)
  const outcome = outcomeLabel(t, decision.outcome)
  const subjects = decision.subject_tags ?? []
  const homeLabel = lang === 'fr' ? 'Accueil' : 'Akèy'

  return (
    <div className="relative bg-primary text-white overflow-hidden border-b border-white/5">
      {/* Background decorative elements — copied verbatim from LawHero
          so the page reads as a sibling surface. */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Fixed-menu clearance. */}
      <div aria-hidden className="h-20" />

      <div className="relative z-10 container py-10 lg:py-16">
        <Breadcrumb
          className="mb-6"
          items={[
            { label: homeLabel, href: '/' },
            { label: t('jurisprudence.breadcrumb'), href: '/jurisprudence' },
            { label: courtShort },
          ]}
        />

        {/* Court eyebrow — small uppercase tag with section if any */}
        <div className="animate-in fade-in slide-in-from-top-3 duration-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-widest text-amber-300/90 mb-5">
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            {court}
          </span>
          {decision.chamber && (
            <span className="text-white/60">· {decision.chamber}</span>
          )}
          {decision.formation && (
            <span className="text-white/60">· {decision.formation}</span>
          )}
        </div>

        {/* "Arrêt du <date>" headline */}
        <p className="animate-in fade-in slide-in-from-top-3 duration-500 delay-100 fill-mode-both text-xl lg:text-2xl font-bold text-white/80 mb-4">
          {t('jurisprudence.decisionOf').replace('{date}', dateStr)}
        </p>

        {/* Main title — parties */}
        <h1 className="animate-in fade-in slide-in-from-top-3 duration-500 delay-150 fill-mode-both text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight text-white drop-shadow-sm break-words mb-6">
          {title}
        </h1>

        {/* Outcome + subject chips */}
        {(decision.outcome || subjects.length > 0) && (
          <div className="animate-in fade-in duration-500 delay-200 fill-mode-both flex flex-wrap items-center gap-2 mb-8">
            {decision.outcome && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                  // Override the bg/text inside the dark hero so the
                  // pill stays legible: solid colored background.
                  outcomeBadgeClass(decision.outcome),
                )}
              >
                <Scale className="h-3.5 w-3.5" />
                {outcome}
              </span>
            )}
            {subjects.map((s) => {
              const label =
                (lang === 'ht' && s.label_ht) || s.label_fr || s.key
              return (
                <span
                  key={s.key}
                  className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 ring-1 ring-white/10"
                >
                  {label}
                </span>
              )
            })}
          </div>
        )}

        {/* Metadata strip — case number + date */}
        <div className="animate-in fade-in duration-500 delay-300 fill-mode-both flex flex-wrap items-center gap-x-8 gap-y-4">
          {decision.case_number && (
            <MetadataChip
              icon={<Hash className="w-5 h-5 text-slate-400" />}
              label={t('jurisprudence.caseNumberLabel')}
              value={decision.case_number}
            />
          )}
          <MetadataChip
            icon={<Calendar className="w-5 h-5 text-slate-400" />}
            label={lang === 'fr' ? 'Date' : 'Dat'}
            value={dateStr}
          />
          {decision.parties_anonymized && (
            <p className="text-[11px] italic text-white/60 max-w-md leading-relaxed">
              {t('jurisprudence.anonymized')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetadataChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-4 min-w-0 max-w-full">
      <div className="p-3 bg-white/5 rounded-full border border-white/10" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
          {label}
        </p>
        <p className="text-white font-bold truncate max-w-[18rem]">{value}</p>
      </div>
    </div>
  )
}
