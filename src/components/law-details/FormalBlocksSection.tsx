'use client'

import React from 'react'
import { EditableFormalBlock } from './EditableFormalBlock'
import { IntroductoryPart } from './IntroductoryPart'
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
  showInitialVersion?: boolean
  refetch: () => void
}

/**
 * Pre-article formal blocks. Préambule renders on its own; the rest of
 * the introductory part — visas + considérants + mentions + the
 * enacting formula — is ONE combined "Partie introductive": read-only
 * for the public, a single editable field (``intro_fr/ht``) for
 * editors. The legacy per-kind columns survive only as a render
 * fallback for data not yet on the combined field.
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
  showInitialVersion = false,
  refetch,
}: FormalBlocksSectionProps) {
  const introFr = (law as any).intro_fr as string | null | undefined
  const introHt = (law as any).intro_ht as string | null | undefined

  const shouldShow =
    isEditor ||
    law.preamble_fr ||
    introFr ||
    law.visas_fr ||
    law.considerants_fr ||
    law.enacting_formula_fr

  if (!shouldShow) return null

  // Reading-order parts for the public combined render, losing no data
  // across the model's transitional shapes: the consolidated
  // ``intro_*`` field first (it already includes the enacting formula),
  // else the ordered ``intro_blocks`` rows (older API) + enacting, else
  // the flat visas/considérants/mentions columns + enacting.
  const mpFirst = !!(law as any).mentions_procedurales_before_considerants
  const combinedIntro = (
    (currentLang === 'ht' ? (introHt ?? introFr) : introFr) ?? ''
  ).trim()
  const introBlockTexts: (string | null | undefined)[] = (
    ((law as any).intro_blocks ?? []) as Array<{
      text_fr?: string | null
      text_ht?: string | null
    }>
  ).map((b) => (currentLang === 'ht' ? (b.text_ht ?? b.text_fr) : b.text_fr))
  const introParts = combinedIntro
    ? [combinedIntro]
    : introBlockTexts.length > 0
      ? [...introBlockTexts, enactingDisplay.value]
      : mpFirst
        ? [
            visasDisplay.value,
            mentionsProceduralesDisplay.value,
            considerantsDisplay.value,
            enactingDisplay.value,
          ]
        : [
            visasDisplay.value,
            considerantsDisplay.value,
            mentionsProceduralesDisplay.value,
            enactingDisplay.value,
          ]

  const PreambleBlock = (
    <div ref={preambleRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={currentLang === 'fr' ? 'Préambule' : 'Premye koze'}
        value={preambleDisplay.value}
        valueHt={law.preamble_ht ?? null}
        fallbackToFr={preambleDisplay.fallback}
        showInitialVersion={showInitialVersion}
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

  // Single combined introductory part — what editors actually edit.
  const introEditValue =
    (currentLang === 'ht' ? (introHt ?? introFr) : introFr) ?? null
  const IntroEditorBlock = (
    <div ref={visasRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={
          currentLang === 'fr' ? 'Partie introductive' : 'Pati entwodiktif'
        }
        hint={
          currentLang === 'fr'
            ? 'Vu… ; Considérant que… ; … a rendu / arrête…'
            : 'Wi… ; Konsidere ke… ; … rezoud / dekrè…'
        }
        value={introEditValue}
        valueHt={introHt ?? null}
        lawSlug={law.slug}
        lawId={law.id}
        onSave={async (v) => {
          const field = currentLang === 'ht' ? 'intro_ht' : 'intro_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v })
          refetch()
        }}
      />
    </div>
  )

  return (
    // ``mb-4`` + ``space-y-4`` so préambule + the partie introductive
    // sit at the SAME 16px rhythm as the TITRE accordions below.
    <div className="mb-4 space-y-4">
      {PreambleBlock}
      {isEditor ? (
        IntroEditorBlock
      ) : (
        <IntroductoryPart parts={introParts} lang={currentLang} />
      )}
    </div>
  )
}
