'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { useT } from '@/i18n/useT'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { cn } from '@/lib/utils'
import type { DecisionDetail } from '@/lib/api/endpoints'

import { DecisionHero } from '@/components/jurisprudence/DecisionHero'
import { DecisionTOC, type TocEntry } from '@/components/jurisprudence/DecisionTOC'
import { PartyBlock } from '@/components/jurisprudence/PartyBlock'
import { MoyenAccordion } from '@/components/jurisprudence/MoyenAccordion'
import { JudgesList } from '@/components/jurisprudence/JudgesList'
import { ProceduralTimeline } from '@/components/jurisprudence/ProceduralTimeline'
import { CitedArticleLink } from '@/components/jurisprudence/CitedArticleLink'

// Editor-only review bar (+ the decision editor it carries). Rendered
// solely for signed-in editors and irrelevant to SSR/SEO, so it loads
// on demand instead of weighing down the public decision page.
const DecisionEditorBar = dynamic(
  () =>
    import('@/components/jurisprudence/DecisionEditorBar').then((m) => ({
      default: m.DecisionEditorBar,
    })),
  { ssr: false },
)

interface Props {
  decision: DecisionDetail
}

/**
 * Interactive shell for the decision detail page. Owns the scroll-spy
 * TOC, the moyens accordion expand/collapse, and the full-text reveal.
 * Wrapped by the RSC route which emits metadata + JSON-LD.
 */
export default function DecisionDetailClient({ decision }: Props) {
  const { t, language } = useT()
  const lang: 'fr' | 'ht' = language === 'ht' ? 'ht' : 'fr'
  const { isEditor, user } = useEditorMode()
  const router = useRouter()

  // Section presence flags — drive both the TOC and the in-page
  // section rendering. We don't render headings for sections that
  // have no data; the TOC greys them out but doesn't link.

  // The ministère public is a court officer (renders conclusions),
  // not a partie au litige. Filter it out of the parties list so it
  // only appears under "Composition de la juridiction" where the
  // substitut belongs. Same for any stray "representant" entries
  // that older seeds might have stuffed into parties.
  const litigantParties =
    decision.parties?.filter(
      (p) => p.role !== 'ministere_public' && p.role !== 'representant',
    ) ?? []
  const hasParties = litigantParties.length > 0
  const hasProcedure = (decision.procedural_history?.length ?? 0) > 0
  const hasMoyens = (decision.moyens?.length ?? 0) > 0
  const hasDispositif = Boolean(
    decision.dispositif_fr || decision.dispositif_ht,
  )
  const hasJudges = (decision.judges?.length ?? 0) > 0
  const hasCitations = (decision.cited_articles?.length ?? 0) > 0
  const hasFullText = Boolean(decision.full_text_fr || decision.full_text_ht)
  const summary = lang === 'ht' ? decision.summary_ht : decision.summary_fr
  const headnotes = lang === 'ht' ? decision.headnotes_ht : decision.headnotes_fr
  const hasSummary = Boolean(summary)
  const hasHeadnotes = Boolean(headnotes)

  const tocEntries: TocEntry[] = [
    {
      id: 'section-summary',
      labelKey: 'jurisprudence.toc.summary',
      active: hasSummary || hasHeadnotes,
    },
    {
      id: 'section-parties',
      labelKey: 'jurisprudence.toc.parties',
      active: hasParties,
      count: litigantParties.length,
    },
    {
      id: 'section-procedure',
      labelKey: 'jurisprudence.toc.procedure',
      active: hasProcedure,
    },
    {
      id: 'section-moyens',
      labelKey: 'jurisprudence.toc.moyens',
      active: hasMoyens,
      count: decision.moyens?.length,
    },
    {
      id: 'section-dispositif',
      labelKey: 'jurisprudence.toc.dispositif',
      active: hasDispositif,
    },
    {
      id: 'section-magistrates',
      labelKey: 'jurisprudence.toc.magistrates',
      active: hasJudges,
      count: decision.judges?.length,
    },
    {
      id: 'section-citations',
      labelKey: 'jurisprudence.toc.citations',
      active: hasCitations,
      count: decision.cited_articles?.length,
    },
    {
      id: 'section-fulltext',
      labelKey: 'jurisprudence.toc.fullText',
      active: hasFullText,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50/30">
      <DecisionHero decision={decision} />

      <div className="container py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-12">
          {/* TOC column */}
          <DecisionTOC entries={tocEntries} />

          {/* Content column */}
          <article className="min-w-0">
            {(hasSummary || hasHeadnotes) && (
              <Section
                id="section-summary"
                title={t('jurisprudence.sections.summaryTitle')}
              >
                {hasHeadnotes && (
                  <div className="mb-6 rounded-2xl border-l-4 border-amber-400 bg-amber-50/40 p-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                      {t('jurisprudence.sections.headnotesTitle')}
                    </p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                      {headnotes}
                    </p>
                  </div>
                )}
                {hasSummary && (
                  <p className="text-base leading-relaxed text-slate-700 whitespace-pre-line">
                    {summary}
                  </p>
                )}
              </Section>
            )}

            {hasParties && (
              <Section
                id="section-parties"
                title={t('jurisprudence.sections.partiesTitle')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {litigantParties.map((p, i) => (
                    <PartyBlock key={p.id ?? `${p.name}-${i}`} party={p} />
                  ))}
                </div>
              </Section>
            )}

            {hasProcedure && (
              <Section
                id="section-procedure"
                title={t('jurisprudence.sections.procedureTitle')}
              >
                <ProceduralTimeline steps={decision.procedural_history!} />
              </Section>
            )}

            {hasMoyens && (
              <Section
                id="section-moyens"
                title={t('jurisprudence.sections.moyensTitle')}
                intro={t('jurisprudence.sections.moyensIntro')}
              >
                <div className="space-y-3">
                  {decision.moyens!.map((m, i) => (
                    <MoyenAccordion
                      key={m.id ?? `${m.number}-${i}`}
                      moyen={m}
                      // First moyen opens by default — most readers
                      // want the gist immediately.
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              </Section>
            )}

            {hasDispositif && (
              <Section
                id="section-dispositif"
                title={t('jurisprudence.sections.dispositifTitle')}
                intro={t('jurisprudence.sections.dispositifIntro')}
              >
                <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-6">
                  <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                    {(lang === 'ht' && decision.dispositif_ht) ||
                      decision.dispositif_fr}
                  </p>
                </div>
              </Section>
            )}

            {hasJudges && (
              <Section
                id="section-magistrates"
                title={t('jurisprudence.sections.magistratesTitle')}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <JudgesList judges={decision.judges!} />
                </div>
              </Section>
            )}

            {hasCitations && (
              <Section
                id="section-citations"
                title={t('jurisprudence.sections.citationsTitle')}
                intro={t('jurisprudence.sections.citationsIntro')}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {decision.cited_articles!.map((c, i) => (
                    <CitedArticleLink
                      key={c.id ?? `${c.article_number}-${i}`}
                      citation={c}
                    />
                  ))}
                </div>
              </Section>
            )}

            {hasFullText && (
              <Section
                id="section-fulltext"
                title={t('jurisprudence.sections.fullTextTitle')}
              >
                <CollapsibleFullText
                  text={
                    (lang === 'ht' && decision.full_text_ht) ||
                    decision.full_text_fr ||
                    ''
                  }
                />
              </Section>
            )}
          </article>
        </div>
      </div>

      {isEditor && (
        <DecisionEditorBar
          decision={decision}
          editorEmail={user?.email ?? null}
          onChanged={() => {
            // Public route is RSC-rendered — easiest way to pull a
            // fresh copy after the editor edits / publishes is to ask
            // Next to re-fetch this segment. The editor bar's own
            // delete / status flips already navigate away.
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

interface SectionProps {
  id: string
  title: string
  intro?: string
  children: React.ReactNode
}

function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section id={id} className="mb-12 scroll-mt-28">
      <header className="mb-5">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          {title}
        </h2>
        {intro && <p className="mt-1 text-sm text-slate-500">{intro}</p>}
      </header>
      {children}
    </section>
  )
}

/** Reveal-on-demand full-text reader. Defaults to collapsed because
 *  the full text of a Cour de cassation arrêt can run several thousand
 *  words and bury the structured content above. */
function CollapsibleFullText({ text }: { text: string }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-slate-800 transition-colors',
          open ? 'border-b border-slate-100' : 'hover:bg-slate-50',
        )}
      >
        <span>
          {open
            ? t('jurisprudence.sections.fullTextToggleHide')
            : t('jurisprudence.sections.fullTextToggleShow')}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-slate-500 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.2 },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 py-6">
              <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-slate-800">
                {text}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
