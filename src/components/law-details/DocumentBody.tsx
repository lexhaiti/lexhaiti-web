'use client'

/**
 * Bare rich-text body for ``display_mode === 'document'`` legal texts.
 *
 * No accordion, no box, no title bar — just the document content
 * inline on the page. The point of the document-viewer mode is that
 * the text IS the document, so wrapping it in a "Texte intégral"
 * collapsible reads as visual noise.
 *
 * Editor mode: a small PenLine icon appears on hover; clicking it
 * swaps the read-only HTML for the same Tiptap editor used by
 * articles and the formal blocks. Save persists via the parent's
 * ``onSave`` callback (PATCH ``/editorial/legal-texts/{slug}/metadata``).
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, Loader2, PenLine, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { isHtmlEffectivelyEmpty, looksLikeHtml } from './_editor/utils'

const RichArticleEditor = dynamic(
  () =>
    import('./_editor/RichArticleEditor').then((m) => ({
      default: m.RichArticleEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[200px] rounded-md border border-slate-200 bg-slate-50/60 animate-pulse" />
    ),
  },
)

interface DocumentBodyProps {
  value: string | null
  isEditor: boolean
  lang: 'fr' | 'ht'
  /** Indicates we're showing the FR text on the HT page because the
   *  Kreyòl variant is empty — surface a small "version FR" pill. */
  fallbackToFr?: boolean
  /** Called with the new HTML on Save. Parent owns the PATCH. */
  onSave: (next: string) => Promise<void>
}

export function DocumentBody({
  value,
  isEditor,
  lang,
  fallbackToFr = false,
  onSave,
}: DocumentBodyProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setDraft(value ?? '')
    setError(null)
    setEditing(true)
  }

  async function commit() {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditing(false)
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setDraft('')
    setError(null)
    setEditing(false)
  }

  const isEmpty = !value || isHtmlEffectivelyEmpty(value)
  const isHtml = !!value && looksLikeHtml(value)

  // ---- Edit mode ----------------------------------------------------
  if (editing) {
    return (
      <div className="space-y-3">
        <RichArticleEditor
          value={draft}
          onChange={setDraft}
          placeholder={
            lang === 'fr'
              ? 'Texte intégral du document…'
              : 'Tèks konplè dokiman an…'
          }
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            {lang === 'fr' ? 'Annuler' : 'Anile'}
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {lang === 'fr' ? 'Enregistrer' : 'Sove'}
          </button>
        </div>
      </div>
    )
  }

  // ---- Read-only -----------------------------------------------------
  // Public visitors with no content see nothing. Editors get a CTA.
  if (isEmpty) {
    if (!isEditor) return null
    return (
      <button
        type="button"
        onClick={startEdit}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/40 px-4 py-2 text-sm italic text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors"
      >
        <PenLine className="w-4 h-4" />
        {lang === 'fr'
          ? 'Ajouter le texte du document'
          : 'Mete tèks dokiman an'}
      </button>
    )
  }

  return (
    <div className="group/doc relative">
      {/* FR fallback pill — only on HT page when ht is empty */}
      {fallbackToFr && (
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 inline-flex">
          {lang === 'ht' ? 'Vèsyon franse' : 'Version française'}
        </p>
      )}
      {/* Editor-only inline edit affordance — small, top-right,
          hover-revealed so it doesn't compete with the document
          content visually. */}
      {isEditor && (
        <button
          type="button"
          onClick={startEdit}
          aria-label={lang === 'fr' ? 'Modifier le texte' : 'Modifye tèks la'}
          className={cn(
            'absolute -top-1 -right-1 opacity-0 group-hover/doc:opacity-100 transition-opacity',
            'inline-flex items-center justify-center w-8 h-8 rounded-full',
            'bg-white border border-slate-200 shadow-sm',
            'hover:bg-slate-50 hover:border-primary',
            'text-slate-500 hover:text-primary',
          )}
        >
          <PenLine className="w-4 h-4" />
        </button>
      )}
      {isHtml ? (
        <div
          className={cn(
            // ``prose`` typography — paragraphs, italics, lists.
            // ``prose-slate`` matches the page's body color.
            // ``max-w-none`` overrides prose's default narrow column
            // so the document flows across the available width.
            'prose prose-slate max-w-none',
            'prose-p:leading-relaxed prose-p:text-slate-800',
            'prose-strong:text-slate-900 prose-em:text-slate-700',
            // Empty paragraphs (``<p></p>``, ``<p><br></p>``) lose
            // their height in the normal flow because there's no
            // content to stretch the line-box. The editor uses them
            // to insert deliberate visual blank lines between
            // sections — make them render as one line of space.
            '[&_p:empty]:min-h-[1.5em]',
            // Tiptap stores Enter-on-blank-line as ``<p><br></p>``
            // sometimes; ``:has`` picks that up too.
            '[&_p:has(>br:only-child)]:min-h-[1.5em]',
          )}
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        // Plain-text fallback — preserve line breaks, no markup.
        <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-800 leading-relaxed">
          {value}
        </div>
      )}
    </div>
  )
}
