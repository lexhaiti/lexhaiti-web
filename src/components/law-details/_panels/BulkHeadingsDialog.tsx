'use client'

/**
 * Editor dialog - paste a JSON array of structural headings (titres,
 * chapitres, sections, sous-sections) and add them all in one atomic
 * batch.
 *
 * Items can reference each other via ``parent_key`` so a single
 * payload can describe a nested TOC: a Titre plus its child Sections
 * plus a Sous-section under section 2, all inserted at once.
 *
 * Workflow:
 *
 *   1. (Optional) Editor picks a parent heading from the dropdown.
 *      All items in the batch attach under that parent unless they
 *      override with their own ``parent_key``.
 *   2. Editor pastes a JSON array of headings, each with
 *      ``{key, level, number?, title_fr?, parent_key?}``.
 *   3. Submit -> POST ``/editorial/legal-texts/{slug}/headings/bulk``.
 *      Atomic: any failure rolls back the whole batch.
 */
import { useMemo, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast-simple'
import {
  bulkInsertHeadings,
  type BulkHeadingItem,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type Heading = components['schemas']['LegalHeadingRead']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  lawSlug: string
  headings: Heading[]
  onCreated?: (count: number) => void
}

const ROOT_LEVEL = '__root__'
const VALID_LEVELS = new Set([
  'part',
  'book',
  'title',
  'chapter',
  'section',
  'subsection',
  // French aliases - accepted in the JSON paste, normalised to the
  // English enum below.
  'partie',
  'livre',
  'titre',
  'chapitre',
  'sous-section',
])

const LEVEL_ALIASES: Record<string, BulkHeadingItem['level']> = {
  partie: 'part',
  livre: 'book',
  titre: 'title',
  chapitre: 'chapter',
  'sous-section': 'subsection',
  // English passes through.
  part: 'part',
  book: 'book',
  title: 'title',
  chapter: 'chapter',
  section: 'section',
  subsection: 'subsection',
}

type ParseResult =
  | { ok: true; items: BulkHeadingItem[] }
  | { ok: false; error: string }

function parsePaste(raw: string): ParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'JSON vide' }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${(e as Error).message}` }
  }
  let candidate: unknown = parsed
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray((parsed as { items?: unknown }).items)
  ) {
    candidate = (parsed as { items: unknown[] }).items
  }
  if (!Array.isArray(candidate)) {
    return {
      ok: false,
      error: 'Attendu : tableau JSON ou objet {"items":[...]}.',
    }
  }
  if (candidate.length === 0) {
    return { ok: false, error: 'Liste vide.' }
  }
  if (candidate.length > 200) {
    return {
      ok: false,
      error: `Trop de blocs (${candidate.length}) - maximum 200.`,
    }
  }
  const items: BulkHeadingItem[] = []
  const seenKeys = new Set<string>()
  for (let i = 0; i < candidate.length; i += 1) {
    const raw = candidate[i] as Record<string, unknown>
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Bloc #${i + 1} : objet attendu.` }
    }
    const key = typeof raw.key === 'string' ? raw.key.trim() : ''
    if (!key) {
      return {
        ok: false,
        error: `Bloc #${i + 1} : champ \`key\` manquant.`,
      }
    }
    if (seenKeys.has(key)) {
      return {
        ok: false,
        error: `Bloc ${key} : clé en double dans le lot.`,
      }
    }
    seenKeys.add(key)
    const rawLevel =
      typeof raw.level === 'string' ? raw.level.trim().toLowerCase() : ''
    if (!VALID_LEVELS.has(rawLevel)) {
      return {
        ok: false,
        error: `Bloc ${key} : niveau invalide ${JSON.stringify(rawLevel)}. Attendu: titre, chapitre, section, sous-section.`,
      }
    }
    items.push({
      key,
      level: LEVEL_ALIASES[rawLevel],
      number: typeof raw.number === 'string' ? raw.number : null,
      title_fr: typeof raw.title_fr === 'string' ? raw.title_fr : null,
      title_ht: typeof raw.title_ht === 'string' ? raw.title_ht : null,
      content_fr: typeof raw.content_fr === 'string' ? raw.content_fr : null,
      content_ht: typeof raw.content_ht === 'string' ? raw.content_ht : null,
      parent_key:
        typeof raw.parent_key === 'string' ? raw.parent_key : null,
    })
  }
  return { ok: true, items }
}

const EXAMPLE_JSON = `[
  {
    "key": "titre-1",
    "level": "titre",
    "number": "I",
    "title_fr": "Dispositions générales"
  },
  {
    "key": "titre-1-section-1",
    "level": "section",
    "number": "1",
    "title_fr": "Champ d'application",
    "parent_key": "titre-1"
  }
]`

export function BulkHeadingsDialog({
  open,
  onOpenChange,
  lawSlug,
  headings,
  onCreated,
}: Props) {
  const { toast } = useToast()
  const [parentId, setParentId] = useState<string>(ROOT_LEVEL)
  const [paste, setPaste] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo<ParseResult | null>(() => {
    if (!paste.trim()) return null
    return parsePaste(paste)
  }, [paste])

  const itemCount = parsed?.ok ? parsed.items.length : 0
  const canSubmit = !!parsed && parsed.ok && itemCount > 0 && !pending
  const insertAtRoot = parentId === ROOT_LEVEL

  function resetState() {
    setParentId(ROOT_LEVEL)
    setPaste('')
    setError(null)
  }

  async function handleSubmit() {
    if (!parsed || !parsed.ok) return
    setPending(true)
    setError(null)
    try {
      const result = await bulkInsertHeadings(lawSlug, {
        parent_id: insertAtRoot ? null : Number(parentId),
        items: parsed.items,
      })
      toast(
        `✓ ${result.length} bloc${result.length > 1 ? 's' : ''} ajouté${
          result.length > 1 ? 's' : ''
        }.`,
      )
      onCreated?.(result.length)
      resetState()
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur serveur.'
      setError(msg)
    } finally {
      setPending(false)
    }
  }

  const headingsWithIndent = useMemo(() => {
    const byId = new Map<number, Heading>()
    headings.forEach((h) => byId.set(h.id, h))
    function depth(h: Heading, seen = new Set<number>()): number {
      if (!h.parent_id || seen.has(h.id)) return 0
      seen.add(h.id)
      const parent = byId.get(h.parent_id)
      return parent ? depth(parent, seen) + 1 : 0
    }
    return headings.map((h) => ({ ...h, _indent: depth(h) }))
  }, [headings])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter des titres / sections</DialogTitle>
          <DialogDescription>
            Collez un tableau JSON de blocs structurels (titre,
            chapitre, section, sous-section). Les blocs peuvent se
            référencer entre eux via {`"parent_key"`} pour décrire un
            arbre complet en une seule fois. Insertion atomique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Parent heading selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-parent"
              className="text-sm font-medium text-slate-700"
            >
              Parent par défaut (optionnel)
            </label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger id="bulk-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT_LEVEL}>
                  <span className="italic">
                    Aucun parent - racine du texte
                  </span>
                </SelectItem>
                {headingsWithIndent.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {'    '.repeat(h._indent)}
                    {h.number ? `${h.number} - ` : ''}
                    {h.title_fr || h.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Les blocs sans {`"parent_key"`} dans le JSON seront
              attachés ici. Avec {`"parent_key"`} ils peuvent se
              nester sous un autre bloc du même lot ou un bloc déjà
              présent dans le texte.
            </p>
          </div>

          {/* Paste textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-headings-paste"
              className="text-sm font-medium text-slate-700"
            >
              JSON des blocs
            </label>
            <Textarea
              id="bulk-headings-paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={EXAMPLE_JSON}
              className="font-mono text-xs min-h-[260px] max-h-[420px]"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 text-xs">
              {parsed === null && (
                <span className="text-slate-500">
                  Niveaux acceptés : titre, chapitre, section,
                  sous-section. Jusqu&apos;à 200 blocs par lot.
                </span>
              )}
              {parsed && parsed.ok && (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {itemCount} bloc{itemCount > 1 ? 's' : ''} prêt
                  {itemCount > 1 ? 's' : ''} à insérer.
                </span>
              )}
              {parsed && !parsed.ok && (
                <span className="text-red-700 inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {parsed.error}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 inline-flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {pending
              ? 'Insertion...'
              : `Ajouter ${itemCount > 0 ? `${itemCount} bloc${itemCount > 1 ? 's' : ''}` : 'les blocs'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
