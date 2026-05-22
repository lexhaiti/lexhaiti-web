'use client'

/**
 * Editor dialog — paste a JSON array of articles and add them all to a
 * single heading in one atomic batch.
 *
 * Workflow:
 *
 *   1. Editor picks a target heading from the dropdown (the dialog
 *      lists the current text's headings as ``Number — Titre`` rows).
 *   2. Editor pastes a JSON array of articles (each with ``number``,
 *      ``text_fr``, optional ``title_fr`` / ``text_ht`` / ``title_ht``).
 *      The dialog also accepts a single-object wrapper ``{"items": […]}``
 *      so JSON copied from a planning doc with metadata around the
 *      list still works.
 *   3. Submit → POST ``/editorial/legal-texts/{slug}/articles/bulk``.
 *      Atomic: any item failure rolls back the whole batch.
 *
 * The dialog is intentionally low-chrome — no per-article editor, no
 * preview table. The bulk-paste workflow is for editors who already
 * have a curated JSON; they don't need a form to construct it. For
 * single-article inserts use ``AddArticleDialog`` instead.
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
  bulkInsertArticles,
  type BulkArticleItem,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type Heading = components['schemas']['LegalHeadingRead']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  lawSlug: string
  /** Headings tree (flat list) from the current law's TOC. The dialog
   *  shows them in document order; ``parent_id`` is used only to
   *  prefix the child indent visually. Empty array ⇒ only the
   *  "root-level" option is available. */
  headings: Heading[]
  /** Source-law id for amendment-mode inserts. When set, every
   *  inserted article gets a ``LegalChange`` row pointing at this
   *  law. ``null`` ⇒ parser-correction (no change graph rows). */
  sourceLegalTextId?: number | null
  onCreated?: (count: number) => void
}

/** Sentinel value the heading dropdown emits for "no heading — insert
 *  at the text root". Distinct from the empty string (which Select
 *  treats as "not chosen yet" and disables the submit button). */
const ROOT_LEVEL = '__root__'

type ParseResult =
  | { ok: true; items: BulkArticleItem[] }
  | { ok: false; error: string }

/**
 * Parse + validate the editor's pasted JSON.
 *
 * Accepts two shapes for resilience:
 *
 *   - Bare array: ``[{number, text_fr, …}, …]``
 *   - Wrapped: ``{"items": [{…}, …]}`` — useful when the editor
 *     copies their full planning doc and only wants the list extracted.
 */
function parsePaste(raw: string): ParseResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: 'JSON vide' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${(e as Error).message}` }
  }
  // Unwrap ``{items: [...]}`` shape if present.
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
      error:
        'Attendu : un tableau JSON d’articles, ou un objet `{"items":[…]}`.',
    }
  }
  if (candidate.length === 0) {
    return { ok: false, error: 'Liste vide — aucun article à insérer.' }
  }
  if (candidate.length > 200) {
    return {
      ok: false,
      error: `Trop d’articles (${candidate.length}) — maximum 200 par lot.`,
    }
  }
  const items: BulkArticleItem[] = []
  for (let i = 0; i < candidate.length; i += 1) {
    const raw = candidate[i] as Record<string, unknown>
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `Article #${i + 1} : objet attendu.` }
    }
    const number = typeof raw.number === 'string' ? raw.number.trim() : ''
    if (!number) {
      return {
        ok: false,
        error: `Article #${i + 1} : champ \`number\` manquant ou vide.`,
      }
    }
    const text_fr =
      typeof raw.text_fr === 'string' ? raw.text_fr.trim() : ''
    if (!text_fr) {
      return {
        ok: false,
        error: `Article ${number} : champ \`text_fr\` manquant ou vide.`,
      }
    }
    items.push({
      number,
      text_fr,
      title_fr:
        typeof raw.title_fr === 'string' ? raw.title_fr : null,
      title_ht:
        typeof raw.title_ht === 'string' ? raw.title_ht : null,
      text_ht: typeof raw.text_ht === 'string' ? raw.text_ht : null,
      comment:
        typeof raw.comment === 'string' ? raw.comment : null,
    })
  }
  return { ok: true, items }
}

const EXAMPLE_JSON = `[
  {
    "number": "1",
    "title_fr": "Article premier",
    "text_fr": "<p>Texte de l'article…</p>"
  },
  {
    "number": "2",
    "text_fr": "<p>Texte de l'article 2…</p>"
  }
]`

export function BulkArticlesDialog({
  open,
  onOpenChange,
  lawSlug,
  headings,
  sourceLegalTextId = null,
  onCreated,
}: Props) {
  const { toast } = useToast()
  const [headingId, setHeadingId] = useState<string>('')
  const [paste, setPaste] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate live so the editor sees parse errors before submitting,
  // and the submit button can be disabled on bad JSON.
  const parsed = useMemo<ParseResult | null>(() => {
    if (!paste.trim()) return null
    return parsePaste(paste)
  }, [paste])

  const itemCount = parsed?.ok ? parsed.items.length : 0
  const canSubmit =
    !!headingId && !!parsed && parsed.ok && itemCount > 0 && !pending
  const insertAtRoot = headingId === ROOT_LEVEL

  function resetState() {
    setHeadingId('')
    setPaste('')
    setError(null)
  }

  async function handleSubmit() {
    if (!parsed || !parsed.ok || !headingId) return
    setPending(true)
    setError(null)
    try {
      // ``ROOT_LEVEL`` sentinel ⇒ omit heading_id so the backend
      // mode 3 ("append at text root") path applies.
      const result = await bulkInsertArticles(lawSlug, {
        heading_id: insertAtRoot ? null : Number(headingId),
        items: parsed.items,
        source_legal_text_id: sourceLegalTextId,
      })
      toast(
        `✓ ${result.length} article${result.length > 1 ? 's' : ''} ajouté${
          result.length > 1 ? 's' : ''
        } au bloc sélectionné.`,
      )
      onCreated?.(result.length)
      resetState()
      onOpenChange(false)
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Erreur inconnue côté serveur.'
      setError(msg)
    } finally {
      setPending(false)
    }
  }

  // Visual indent in the dropdown so child sections sit under their
  // parent titre. We don't render a real tree (would explode the
  // select component) — just a "→ " prefix per nesting level.
  const headingsWithIndent = useMemo(() => {
    const byId = new Map<number, Heading>()
    headings.forEach((h) => byId.set(h.id, h))
    function depth(h: Heading, seen = new Set<number>()): number {
      if (!h.parent_id || seen.has(h.id)) return 0
      seen.add(h.id)
      const parent = byId.get(h.parent_id)
      return parent ? depth(parent, seen) + 1 : 0
    }
    return headings.map((h) => ({
      ...h,
      _indent: depth(h),
    }))
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
          <DialogTitle>Ajouter un bloc d’articles</DialogTitle>
          <DialogDescription>
            Collez un tableau JSON d’articles ci-dessous. Tous les
            articles seront ajoutés au bloc sélectionné (titre, section…)
            dans l’ordre du document. Insertion atomique : si un seul
            article échoue, aucun n’est ajouté.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Heading selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-heading"
              className="text-sm font-medium text-slate-700"
            >
              Bloc cible (titre / section)
            </label>
            <Select value={headingId} onValueChange={setHeadingId}>
              <SelectTrigger id="bulk-heading" className="w-full">
                <SelectValue placeholder="Sélectionner un bloc…" />
              </SelectTrigger>
              <SelectContent>
                {/* Root-level option - articles attach directly
                    to the text, no heading. Used for proclamations,
                    discours, actes that have no structural TOC. */}
                <SelectItem value={ROOT_LEVEL}>
                  <span className="italic">
                    Aucun bloc - racine du texte
                  </span>
                </SelectItem>
                {headingsWithIndent.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {'    '.repeat(h._indent)}
                    {h.number ? `${h.number} — ` : ''}
                    {h.title_fr || h.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {insertAtRoot && (
              <p className="text-xs text-slate-500">
                Articles attaches directement au texte (pas de titre
                ni de section). Pour proclamations, discours, actes.
              </p>
            )}
          </div>

          {/* Paste textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="bulk-paste"
              className="text-sm font-medium text-slate-700"
            >
              JSON des articles
            </label>
            <Textarea
              id="bulk-paste"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={EXAMPLE_JSON}
              className="font-mono text-xs min-h-[260px] max-h-[420px]"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 text-xs">
              {parsed === null && (
                <span className="text-slate-500">
                  Tableau JSON ou objet {`{"items": [...]}`}, jusqu’à
                  200 articles par lot.
                </span>
              )}
              {parsed && parsed.ok && (
                <span className="text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {itemCount} article{itemCount > 1 ? 's' : ''} prêt
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

          {/* Server-side error */}
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
              ? 'Insertion…'
              : `Ajouter ${itemCount > 0 ? `${itemCount} article${itemCount > 1 ? 's' : ''}` : 'les articles'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
