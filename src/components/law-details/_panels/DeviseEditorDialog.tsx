'use client'

/**
 * Editor dialog - modify the devise + désignation (emblem) of a single
 * legal text.
 *
 * The devise block is the "emblem" that opens every official Haitian
 * act on the law-detail page: the asterism (⁂), the motto in spaced
 * caps, and the "République d'Haïti" line beneath. Defaults to the
 * canonical "LIBERTÉ • ÉGALITÉ • FRATERNITÉ — République d'Haïti"
 * triad, but historic constitutions carry different mottos
 * (1843: "LIBERTÉ, ÉGALITÉ OU LA MORT", 1801: "Liberté ou la Mort",
 * 1805 Empire: "Dieu, Ma Patrie et mon Épée" …) and the editor can
 * set the override here.
 *
 * Storage on the LegalText row:
 *
 *   - ``devise_fr`` — multi-line. First line is the MOTTO (rendered
 *     with letter-spacing). Subsequent lines are DESIGNATIONS
 *     (regular weight, like the "République d'Haïti" line). Empty
 *     string ⇒ revert to the canonical default.
 *   - ``devise_ht`` — Kreyòl variant. Same rules.
 *
 * Live preview mirrors the actual ``DeviseBanner`` so the editor sees
 * the output before saving.
 */
import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast-simple'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import { DeviseBanner } from './DeviseBanner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  lawSlug: string
  initialFr: string | null
  initialHt: string | null
  onSaved?: () => void
}

const PLACEHOLDER_FR = `LIBERTÉ, ÉGALITÉ OU LA MORT
République d'Haïti`

const PLACEHOLDER_HT = `LIBÈTE, EGALITE OUBYEN LANMÒ
Repiblik Ayiti`

export function DeviseEditorDialog({
  open,
  onOpenChange,
  lawSlug,
  initialFr,
  initialHt,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [valueFr, setValueFr] = useState<string>(initialFr ?? '')
  const [valueHt, setValueHt] = useState<string>(initialHt ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setPending(true)
    setError(null)
    try {
      // Empty string ⇒ clear the override (revert to canonical
      // "LIBERTÉ • ÉGALITÉ • FRATERNITÉ — République d'Haïti").
      // Send ``null`` rather than ``""`` so the backend records the
      // intent as "no override" rather than "empty motto".
      await updateLegalTextMetadata(lawSlug, {
        devise_fr: valueFr.trim() ? valueFr.trim() : null,
        devise_ht: valueHt.trim() ? valueHt.trim() : null,
      } as any)
      toast('Devise mise à jour ✓')
      onSaved?.()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur serveur.')
    } finally {
      setPending(false)
    }
  }

  function handleClear() {
    setValueFr('')
    setValueHt('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'emblème (devise)</DialogTitle>
          <DialogDescription>
            La première ligne est la devise (rendue en capitales
            espacées). Les lignes suivantes sont des désignations
            (République d'Haïti, …). Laisser vide pour revenir à la
            devise canonique « Liberté • Égalité • Fraternité ».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Live preview — uses the actual DeviseBanner so the
              editor sees the exact rendering. Falls back to the
              canonical default when both fields are empty. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">
              Aperçu
            </p>
            <DeviseBanner
              size="default"
              lang="fr"
              customText={valueFr.trim() || null}
            />
            {valueHt.trim() && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">
                  Aperçu Kreyòl
                </p>
                <DeviseBanner
                  size="default"
                  lang="ht"
                  customText={valueHt.trim()}
                />
              </div>
            )}
          </div>

          {/* FR field */}
          <div className="space-y-1.5">
            <label
              htmlFor="devise-fr"
              className="text-sm font-medium text-slate-700"
            >
              Français (multi-ligne)
            </label>
            <Textarea
              id="devise-fr"
              value={valueFr}
              onChange={(e) => setValueFr(e.target.value)}
              placeholder={PLACEHOLDER_FR}
              className="font-mono text-sm min-h-[80px]"
              spellCheck={false}
            />
          </div>

          {/* HT field */}
          <div className="space-y-1.5">
            <label
              htmlFor="devise-ht"
              className="text-sm font-medium text-slate-700"
            >
              Kreyòl (optionnel)
            </label>
            <Textarea
              id="devise-ht"
              value={valueHt}
              onChange={(e) => setValueHt(e.target.value)}
              placeholder={PLACEHOLDER_HT}
              className="font-mono text-sm min-h-[80px]"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 inline-flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={pending || (!valueFr && !valueHt)}
            className="text-slate-600"
          >
            Effacer (devise par défaut)
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
