'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast-simple'
import {
  updateMoniteurIssue,
  type MoniteurIssueMetadataPatch,
  type MoniteurIssueWithEntries,
} from '@/lib/api/endpoints'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  issue: MoniteurIssueWithEntries
  /** Called with the saved patch so the page can merge it into local state. */
  onSaved: (patch: MoniteurIssueMetadataPatch) => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  )
}

export function MoniteurMetadataEditor({
  open,
  onOpenChange,
  issue,
  onSaved,
}: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [number, setNumber] = useState('')
  const [editionLabel, setEditionLabel] = useState('')
  const [pubDate, setPubDate] = useState('')
  const [year, setYear] = useState('')
  const [director, setDirector] = useState('')
  const [directorRole, setDirectorRole] = useState('')

  // Re-seed the form each time the dialog opens (or the issue changes).
  useEffect(() => {
    if (!open) return
    setNumber(issue.number ?? '')
    setEditionLabel(issue.edition_label ?? '')
    setPubDate((issue.publication_date ?? '').slice(0, 10))
    setYear(issue.year != null ? String(issue.year) : '')
    setDirector(issue.director ?? '')
    setDirectorRole(issue.director_role ?? '')
  }, [open, issue])

  async function handleSave() {
    const trimmedNumber = number.trim()
    if (!trimmedNumber) {
      toast('Le numéro ne peut pas être vide.')
      return
    }
    const yearNum = Number(year)
    const patch: MoniteurIssueMetadataPatch = {
      number: trimmedNumber,
      year: Number.isFinite(yearNum) && year.trim() ? yearNum : issue.year,
      publication_date: pubDate.trim() || null,
      edition_label: editionLabel.trim() || null,
      director: director.trim() || null,
      director_role: directorRole.trim() || null,
    }
    setSaving(true)
    try {
      await updateMoniteurIssue(issue.id, patch)
      onSaved(patch)
      toast('Métadonnées enregistrées.')
      onOpenChange(false)
    } catch {
      toast('Échec de l’enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Métadonnées de l’édition</DialogTitle>
          <DialogDescription>
            Corrigez le numéro, la date et les informations du Moniteur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Numéro (titre affiché)">
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Spécial No 51"
                autoFocus
              />
            </Field>
          </div>
          <Field label="Libellé d’édition">
            <Input
              value={editionLabel}
              onChange={(e) => setEditionLabel(e.target.value)}
              placeholder="Numéro spécial"
            />
          </Field>
          <Field label="Année">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025"
            />
          </Field>
          <Field label="Date de publication">
            <Input
              type="date"
              value={pubDate}
              onChange={(e) => setPubDate(e.target.value)}
            />
          </Field>
          <Field label="Directeur">
            <Input
              value={director}
              onChange={(e) => setDirector(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Fonction du directeur">
              <Input
                value={directorRole}
                onChange={(e) => setDirectorRole(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
