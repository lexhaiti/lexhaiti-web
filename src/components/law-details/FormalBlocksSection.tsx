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
  preambleRef: React.RefObject<HTMLDivElement | null>
  visasRef: React.RefObject<HTMLDivElement | null>
  /** Controlled expand of the Préambule block — synced with the
   *  sommaire's "Préambule" entry (open in one place opens both). */
  preambleExpanded: boolean
  onPreambleExpandedChange: (next: boolean) => void
  /** Controlled expand of the combined "Partie introductive" block —
   *  synced with the sommaire's "Partie introductive" entry. */
  introExpanded: boolean
  onIntroExpandedChange: (next: boolean) => void
  showInitialVersion?: boolean
  refetch: () => void
}

/**
 * Pre-article formal blocks. Préambule renders on its own; the rest of
 * the introductory part — visas + considérants + mentions + the
 * enacting formula — is ONE combined "Partie introductive" stored in
 * ``intro_fr/ht``: read-only for the public, a single editable field
 * for editors. The legacy per-kind columns were dropped in migration
 * 0046, so ``intro_fr/ht`` is now the sole source.
 */
export function FormalBlocksSection({
  law,
  currentLang,
  isEditor,
  preambleDisplay,
  preambleRef,
  visasRef,
  preambleExpanded,
  onPreambleExpandedChange,
  introExpanded,
  onIntroExpandedChange,
  showInitialVersion = false,
  refetch,
}: FormalBlocksSectionProps) {
  const introFr = law.intro_fr
  const introHt = law.intro_ht

  const shouldShow = isEditor || law.preamble_fr || introFr || introHt

  if (!shouldShow) return null

  // The introductory part is one combined field per language; the public
  // render takes the active-language value (falling back to FR).
  const combinedIntro = (
    (currentLang === 'ht' ? (introHt ?? introFr) : introFr) ?? ''
  ).trim()
  const introParts = combinedIntro ? [combinedIntro] : []

  const PreambleBlock = (
    <div ref={preambleRef} className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={currentLang === 'fr' ? 'Préambule' : 'Premye koze'}
        expanded={preambleExpanded}
        onExpandedChange={onPreambleExpandedChange}
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
        expanded={introExpanded}
        onExpandedChange={onIntroExpandedChange}
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
        <div ref={visasRef} className="scroll-mt-24">
          <IntroductoryPart
            parts={introParts}
            lang={currentLang}
            expanded={introExpanded}
            onExpandedChange={onIntroExpandedChange}
          />
        </div>
      )}
    </div>
  )
}
