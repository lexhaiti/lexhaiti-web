'use client'

import React from 'react'
import { EditableFormalBlock } from './EditableFormalBlock'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

interface FinalPartProps {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  refetch: () => void
}

/**
 * "Partie finale" — the closing formula (Donné au… / Fait le…) AND the
 * signatures, as ONE rich-text field (``closing_fr`` / ``closing_ht``).
 * Mirrors the "Partie introductive" model: a single editable block that
 * adapts to any signer layout (French ministerial chain, Haitian
 * Chambre/Sénat double-signing block, …) instead of a rigid structured
 * signers grid. Read-only for the public, a single Tiptap field for
 * editors. The rare "Approbation / Mention finale" stays its own block
 * (ClosingAddendum) below this one.
 */
export function FinalPart({
  law,
  currentLang,
  isEditor,
  refetch,
}: FinalPartProps) {
  const closingFr = (law as any).closing_fr as string | null | undefined
  const closingHt = (law as any).closing_ht as string | null | undefined
  const value =
    currentLang === 'ht'
      ? closingHt || closingFr || null
      : closingFr || null
  const fallback = currentLang === 'ht' && !closingHt && !!closingFr

  if (!value && !isEditor) return null

  return (
    <div className="mt-12 pt-8 pb-6 border-t border-slate-200 scroll-mt-24">
      <EditableFormalBlock
        isFr={currentLang === 'fr'}
        isEditor={isEditor}
        title={
          currentLang === 'fr'
            ? 'Signataires et formule de clôture'
            : 'Siyatè ak fòmil fèmti'
        }
        hint={
          currentLang === 'fr'
            ? 'Formule de clôture (Donné au… / Fait le…) et signatures, en texte libre — une mise en forme libre pour tout type de bloc de signataires.'
            : 'Fòmil fèmti (Bay nan… / Fèt le…) ak siyati yo, an tèks lib — yon fòma lib pou tout kalite blòk siyatè.'
        }
        value={value}
        valueHt={closingHt ?? null}
        fallbackToFr={fallback}
        lawSlug={law.slug}
        lawId={law.id}
        onSave={async (v) => {
          const field = currentLang === 'ht' ? 'closing_ht' : 'closing_fr'
          await updateLegalTextMetadata(law.slug, { [field]: v } as any)
          refetch()
        }}
      />
    </div>
  )
}
