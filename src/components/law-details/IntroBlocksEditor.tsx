'use client'

/**
 * Editor for the ordered introductory part — add / edit / reorder /
 * delete the typed blocks (visa, considérant, mention procédurale,
 * autorité, rapport) that the public reader renders as one continuous
 * "partie introductive". Each mutation hits the editorial API, which
 * denormalises back onto the flat visas_fr / considerants_fr columns,
 * so nothing drifts.
 *
 * Reorder is via up/down controls (robust, keyboard-friendly) rather
 * than drag-and-drop. Text edits save on blur. Editor-only — the
 * parent gates rendering on ``isEditor``.
 */

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast-simple'
import {
  createIntroBlock,
  deleteIntroBlock,
  listIntroBlocks,
  reorderIntroBlocks,
  updateIntroBlock,
  type IntroBlockKind,
  type IntroBlockRead,
} from '@/lib/api/endpoints'

interface Props {
  slug: string
  lang: 'fr' | 'ht'
  initialBlocks: IntroBlockRead[]
  /** Called after any mutation so the parent can refetch the law. */
  onChanged?: () => void
}

// Kinds offered in the "add block" picker + label map. Enacting
// formula + préambule are intentionally excluded — they keep their
// own dedicated blocks outside the introductory part.
const KIND_LABELS: Record<string, { fr: string; ht: string }> = {
  author: { fr: 'Autorité', ht: 'Otorite' },
  report_mention: { fr: 'Rapport', ht: 'Rapò' },
  visa: { fr: 'Visa', ht: 'Viza' },
  considerant: { fr: 'Considérant', ht: 'Konsideran' },
  procedural_mention: { fr: 'Mention procédurale', ht: 'Mansyon pwosedi' },
  sovereignty_formula: { fr: 'Formule de souveraineté', ht: 'Fòmil souverènte' },
}
const ADDABLE_KINDS: IntroBlockKind[] = [
  'author',
  'report_mention',
  'visa',
  'considerant',
  'procedural_mention',
]

export function IntroBlocksEditor({ slug, lang, initialBlocks, onChanged }: Props) {
  const isFr = lang === 'fr'
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<IntroBlockRead[]>(initialBlocks)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<IntroBlockRead | null>(null)

  useEffect(() => setBlocks(initialBlocks), [initialBlocks])

  const refetch = async () => {
    try {
      const fresh = await listIntroBlocks(slug)
      setBlocks(fresh)
    } catch {
      /* keep optimistic state */
    }
    onChanged?.()
  }

  const kindLabel = (k: string) =>
    (isFr ? KIND_LABELS[k]?.fr : KIND_LABELS[k]?.ht) ?? k

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...blocks]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setBlocks(next) // optimistic
    setBusy(true)
    try {
      await reorderIntroBlocks(slug, next.map((b) => b.id))
      await refetch()
    } catch {
      toast(isFr ? 'Réordonnancement échoué.' : 'Reòdone echwe.')
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const saveText = async (
    block: IntroBlockRead,
    field: 'text_fr' | 'text_ht',
    value: string,
  ) => {
    const current = block[field] ?? ''
    if (value === current) return
    setBusy(true)
    try {
      await updateIntroBlock(block.id, { [field]: value || null })
      await refetch()
    } catch {
      toast(isFr ? 'Enregistrement échoué.' : 'Anrejistreman echwe.')
    } finally {
      setBusy(false)
    }
  }

  const changeKind = async (block: IntroBlockRead, kind: IntroBlockKind) => {
    setBusy(true)
    try {
      await updateIntroBlock(block.id, { kind })
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  const add = async (kind: IntroBlockKind) => {
    setBusy(true)
    try {
      await createIntroBlock(slug, { kind })
      await refetch()
    } catch {
      toast(isFr ? 'Ajout échoué.' : 'Ajoute echwe.')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (block: IntroBlockRead) => {
    setBusy(true)
    try {
      await deleteIntroBlock(block.id)
      await refetch()
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
      <header className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800">
          {isFr ? 'Partie introductive — édition' : 'Pati entwodiktif — edisyon'}
        </span>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />}
      </header>

      <ol className="space-y-2">
        {blocks.map((b, idx) => (
          <li
            key={b.id}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start gap-2">
              {/* Reorder controls */}
              <div className="flex flex-col items-center pt-0.5 text-slate-400">
                <GripVertical className="w-3.5 h-3.5 mb-1" aria-hidden />
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0 || busy}
                  aria-label={isFr ? 'Monter' : 'Monte'}
                  className="hover:text-primary disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === blocks.length - 1 || busy}
                  aria-label={isFr ? 'Descendre' : 'Desann'}
                  className="hover:text-primary disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={b.kind}
                    onChange={(e) =>
                      changeKind(b, e.target.value as IntroBlockKind)
                    }
                    disabled={busy}
                    className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 border border-slate-200 rounded-md px-2 py-1 bg-white"
                  >
                    {ADDABLE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabel(k)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(b)}
                    aria-label={isFr ? 'Supprimer' : 'Efase'}
                    className="ml-auto text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  defaultValue={b.text_fr ?? ''}
                  onBlur={(e) => saveText(b, 'text_fr', e.target.value)}
                  rows={2}
                  placeholder={isFr ? 'Texte (français)…' : 'Tèks (franse)…'}
                  className="w-full text-sm text-slate-800 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-primary resize-y"
                />
                <textarea
                  defaultValue={b.text_ht ?? ''}
                  onBlur={(e) => saveText(b, 'text_ht', e.target.value)}
                  rows={2}
                  placeholder={isFr ? 'Texte (créole)…' : 'Tèks (kreyòl)…'}
                  className="w-full text-sm text-slate-700 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>
          </li>
        ))}
        {blocks.length === 0 && (
          <li className="text-xs italic text-slate-500 py-2">
            {isFr
              ? 'Aucun bloc introductif. Ajoutez-en un ci-dessous.'
              : 'Pa gen blòk entwodiktif. Ajoute youn anba a.'}
          </li>
        )}
      </ol>

      {/* Add-block picker */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-amber-200">
        <span className="text-[11px] font-semibold text-amber-800">
          {isFr ? 'Ajouter :' : 'Ajoute :'}
        </span>
        {ADDABLE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => add(k)}
            disabled={busy}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]',
              'font-semibold bg-white text-amber-800 border border-amber-200',
              'hover:bg-amber-100 hover:border-amber-300 transition-colors disabled:opacity-50',
            )}
          >
            <Plus className="w-3 h-3" />
            {kindLabel(k)}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        onConfirm={async () => {
          if (pendingDelete) await doDelete(pendingDelete)
        }}
        title={isFr ? 'Supprimer ce bloc ?' : 'Efase blòk sa a?'}
        description={
          isFr
            ? 'Ce bloc introductif sera retiré. Le texte regroupé sera recalculé.'
            : 'Blòk entwodiktif sa a ap retire. Tèks la ap rekalkile.'
        }
        confirmLabel={isFr ? 'Supprimer' : 'Efase'}
        cancelLabel={isFr ? 'Annuler' : 'Anile'}
        destructive
        loading={busy}
      />
    </div>
  )
}
