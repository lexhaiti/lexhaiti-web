'use client'

import React from 'react'
import { EditableFormalBlock } from './EditableFormalBlock'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

interface ClosingAddendumProps {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  refetch: () => void
}

/**
 * Closing addendum -- free-form callout below SIGNATAIRES
 * for historic texts that carry a post-signature statement.
 * Bilingual; rendered only when content exists or the editor
 * is signed in.
 */
export function ClosingAddendum({
  law,
  currentLang,
  isEditor,
  refetch,
}: ClosingAddendumProps) {
  const addendumFr = (law as any).closing_addendum_fr as
    | string
    | null
    | undefined
  const addendumHt = (law as any).closing_addendum_ht as
    | string
    | null
    | undefined
  const displayValue =
    currentLang === 'ht'
      ? addendumHt || addendumFr || null
      : addendumFr || null
  const fallback =
    currentLang === 'ht' && !addendumHt && !!addendumFr

  if (!displayValue && !isEditor) return null

  return (
    <div className="scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={
          currentLang === 'fr'
            ? 'Approbation / Mention finale'
            : 'Apwobasyon / Mansyon final'
        }
        hint={
          currentLang === 'fr'
            ? "Texte d'approbation, déclaration finale ou autre mention qui suit les signatures (rare — historique)."
            : "Tèks apwobasyon, deklarasyon final oswa lòt mansyon ki vini apre siyati yo (ra — istorik)."
        }
        value={displayValue}
        valueHt={addendumHt ?? null}
        fallbackToFr={fallback}
        lawSlug={law.slug}
        lawId={law.id}
        onSave={async (v) => {
          const field =
            currentLang === 'ht'
              ? 'closing_addendum_ht'
              : 'closing_addendum_fr'
          await updateLegalTextMetadata(law.slug, {
            [field]: v,
          } as any)
          refetch()
        }}
      />
    </div>
  )
}
