'use client'

import React from 'react'
import { EditableFormalBlock } from './EditableFormalBlock'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import type { BilingualDisplay } from './_helpers/lawDetailTypes'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

interface FormalBlocksSectionProps {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  preambleDisplay: BilingualDisplay
  visasDisplay: BilingualDisplay
  considerantsDisplay: BilingualDisplay
  mentionsProceduralesDisplay: BilingualDisplay
  enactingDisplay: BilingualDisplay
  preambleRef: React.RefObject<HTMLDivElement | null>
  visasRef: React.RefObject<HTMLDivElement | null>
  considerantsRef: React.RefObject<HTMLDivElement | null>
  refetch: () => void
}

/**
 * Pre-article formal blocks: Preambule, Visas, Considerants,
 * Mentions procedurales, Formule d'adoption.
 * Editable in-place for editors via EditableFormalBlock; read-only
 * for the public.
 */
export function FormalBlocksSection({
  law,
  currentLang,
  isEditor,
  preambleDisplay,
  visasDisplay,
  considerantsDisplay,
  mentionsProceduralesDisplay,
  enactingDisplay,
  preambleRef,
  visasRef,
  considerantsRef,
  refetch,
}: FormalBlocksSectionProps) {
  const shouldShow =
    isEditor ||
    law.preamble_fr ||
    law.visas_fr ||
    law.considerants_fr ||
    law.enacting_formula_fr

  if (!shouldShow) return null

  // Per-document toggle: modern drafting (default) prints considérants
  // BEFORE mentions procédurales. 19th-century Haitian laws often
  // invert this — see ``mentions_procedurales_before_considerants``
  // on LegalText. The two blocks below are rendered as inline JSX
  // constants then placed in the right order in the JSX tree.
  const mpFirst = !!(law as any).mentions_procedurales_before_considerants

  const PreambleBlock = (
    <div ref={preambleRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={currentLang === 'fr' ? 'Préambule' : 'Premye koze'}
        value={preambleDisplay.value}
        valueHt={law.preamble_ht ?? null}
        fallbackToFr={preambleDisplay.fallback}
        lawSlug={law.slug}
        lawId={law.id}
        blockKind="preamble"
        onSave={async (v) => {
          const field = currentLang === 'ht' ? 'preamble_ht' : 'preamble_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )

  const VisasBlock = (
    <div ref={visasRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={currentLang === 'fr' ? 'Visas' : 'Viza'}
        hint={currentLang === 'fr' ? 'Vu les articles...' : 'Wi atik yo...'}
        value={visasDisplay.value}
        valueHt={law.visas_ht ?? null}
        fallbackToFr={visasDisplay.fallback}
        lawSlug={law.slug}
        lawId={law.id}
        blockKind="visa"
        onSave={async (v) => {
          const field = currentLang === 'ht' ? 'visas_ht' : 'visas_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )

  const MentionsBlock = (
    <div className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={
          currentLang === 'fr' ? 'Mentions procédurales' : 'Mansyon pwosedi'
        }
        hint={
          currentLang === 'fr'
            ? 'Sur le rapport du… ; Et après délibération…'
            : 'Sou rapò… ; Epi apre deliberasyon…'
        }
        value={mentionsProceduralesDisplay.value}
        valueHt={(law as any).mentions_procedurales_ht ?? null}
        fallbackToFr={mentionsProceduralesDisplay.fallback}
        lawSlug={law.slug}
        lawId={law.id}
        onSave={async (v) => {
          const field =
            currentLang === 'ht'
              ? 'mentions_procedurales_ht'
              : 'mentions_procedurales_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )

  const ConsiderantsBlock = (
    <div ref={considerantsRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={currentLang === 'fr' ? 'Considérants' : 'Konsideran'}
        hint={
          currentLang === 'fr' ? 'Considérant que...' : 'Konsidere ke...'
        }
        value={considerantsDisplay.value}
        valueHt={law.considerants_ht ?? null}
        fallbackToFr={considerantsDisplay.fallback}
        lawSlug={law.slug}
        lawId={law.id}
        blockKind="considerant"
        onSave={async (v) => {
          const field =
            currentLang === 'ht' ? 'considerants_ht' : 'considerants_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )

  return (
    <div className="mb-8 space-y-3">
      {PreambleBlock}
      {VisasBlock}
      {/* Order flipped when the law sets
          mentions_procedurales_before_considerants = true. */}
      {mpFirst ? (
        <>
          {MentionsBlock}
          {ConsiderantsBlock}
        </>
      ) : (
        <>
          {ConsiderantsBlock}
          {MentionsBlock}
        </>
      )}

      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        variant="compact"
        title={currentLang === 'fr' ? "Formule d'adoption" : "Fòmil adopsyon"}
        value={enactingDisplay.value}
        valueHt={law.enacting_formula_ht ?? null}
        fallbackToFr={enactingDisplay.fallback}
        lawSlug={law.slug}
        lawId={law.id}
        blockKind="enacting_formula"
        align={
          (law.enacting_formula_align as
            | 'left'
            | 'center'
            | undefined) ?? 'left'
        }
        onAlignChange={async (next) => {
          await updateLegalTextMetadata(law.slug, {
            enacting_formula_align: next,
          } as any)
          refetch()
        }}
        onSave={async (v) => {
          const field = currentLang === 'ht' ? 'enacting_formula_ht' : 'enacting_formula_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )
}
