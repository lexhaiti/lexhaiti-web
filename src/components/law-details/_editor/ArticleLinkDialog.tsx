'use client'

/**
 * Dialog launched from the rich-article editor toolbar — lets editors
 * insert / edit an article-reference link.
 *
 * The dialog emits the same anchor shape the backend linkifier produces
 * (``rt-art-ref`` class, ``data-article``, optional ``data-target`` +
 * absolute ``href``), so the saved HTML round-trips through the API
 * sanitizer's strict ``_ARTICLE_HREF_RE`` allowlist.
 *
 * Three fields:
 *   1. Article number (required, free-form — "267.2", "1382-1", "9 bis")
 *   2. Display text (optional — defaults to the current selection /
 *      article number; this is what the reader sees)
 *   3. Target text (combobox; default = same law)
 *
 * Opening with the cursor inside an existing ``articleRef`` mark
 * pre-fills all three fields from the mark's attributes + the
 * surrounding text.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useT } from '@/i18n/useT'
import { listTexts, type LegalTextListItem } from '@/lib/api/endpoints'
import { normalizeArticleNumber } from './ArticleRefMark'

interface ArticleLinkDialogProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TargetOption =
  | { kind: 'self' }
  | { kind: 'text'; slug: string; titleFr: string; titleHt?: string | null }

const SELF_OPTION: TargetOption = { kind: 'self' }

/** True when an articleRef mark intersects the current selection. */
function isInArticleRef(editor: Editor): boolean {
  return editor.isActive('articleRef')
}

/** Pull the full text covered by the articleRef mark touching the
 *  cursor — used to seed "Texte affiché" when editing an existing
 *  link. Walks the resolved positions either side of ``from`` to
 *  find the mark's start/end. */
function getActiveMarkRange(
  editor: Editor,
): { from: number; to: number; text: string } | null {
  const { state } = editor
  const { $from } = state.selection
  const markType = state.schema.marks.articleRef
  if (!markType) return null
  const mark = $from.marks().find((m) => m.type === markType)
  if (!mark) return null

  // Walk left to the start of the run carrying this mark.
  let start = $from.pos
  while (start > 0) {
    const before = state.doc.resolve(start - 1)
    if (!before.marks().some((m) => m.type === markType)) break
    start -= 1
  }
  // And right to the end of the run.
  let end = $from.pos
  while (end < state.doc.content.size) {
    const after = state.doc.resolve(end + 1)
    if (!after.marks().some((m) => m.type === markType)) break
    end += 1
  }
  if (end <= start) return null
  return {
    from: start,
    to: end,
    text: state.doc.textBetween(start, end, '', ''),
  }
}

/** Snapshot the editor selection into the dialog's initial form
 *  values: existing-mark attributes when the cursor sits inside an
 *  ``articleRef`` mark, otherwise the surrounding selection (if any)
 *  as the display text. */
function seedFromEditor(editor: Editor): {
  articleNumber: string
  displayText: string
  target: TargetOption
} {
  if (isInArticleRef(editor)) {
    const range = getActiveMarkRange(editor)
    const attrs = editor.getAttributes('articleRef') as {
      articleNumber?: string
      targetSlug?: string | null
    }
    return {
      articleNumber: attrs.articleNumber ?? '',
      displayText: range?.text ?? '',
      target: attrs.targetSlug
        ? {
            kind: 'text',
            slug: attrs.targetSlug,
            titleFr: attrs.targetSlug,
          }
        : SELF_OPTION,
    }
  }
  const { from, to } = editor.state.selection
  return {
    articleNumber: '',
    displayText:
      from === to ? '' : editor.state.doc.textBetween(from, to, '', ''),
    target: SELF_OPTION,
  }
}

/**
 * Public entry — keyed re-mount on every open keeps initial-state
 * seeding (article number / display text / target) inside the lazy
 * ``useState`` initialisers of ``ArticleLinkDialogInner``, sidestepping
 * the "set state in effect" lint rule the rest of the codebase follows
 * (see ``FinalSections.SectionFormDialog`` for the same pattern).
 */
export function ArticleLinkDialog({
  editor,
  open,
  onOpenChange,
}: ArticleLinkDialogProps) {
  return (
    <ArticleLinkDialogInner
      key={`articleLink:${open}`}
      editor={editor}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

function ArticleLinkDialogInner({
  editor,
  open,
  onOpenChange,
}: ArticleLinkDialogProps) {
  const { t } = useT()

  // Seed initial state lazily from the editor selection at mount time.
  // Re-mount on every ``open`` toggle (see public wrapper) ensures the
  // seed reflects the current cursor / mark on each open.
  const seed = useMemo(() => seedFromEditor(editor), [editor])

  const [articleNumber, setArticleNumber] = useState(seed.articleNumber)
  const [displayText, setDisplayText] = useState(seed.displayText)
  const [target, setTarget] = useState<TargetOption>(seed.target)
  const [error, setError] = useState<string | null>(null)
  const numberInputRef = useRef<HTMLInputElement>(null)

  // Focus the number field on next paint so the autofocus survives
  // Radix's mount animation. Effect-only side effect (no setState).
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      numberInputRef.current?.focus()
      numberInputRef.current?.select()
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const submit = () => {
    const normalized = normalizeArticleNumber(articleNumber)
    if (!normalized) {
      setError(t('editor.articleLink.errors.invalidNumber'))
      return
    }

    const display = displayText.trim() || normalized
    const targetSlug = target.kind === 'text' ? target.slug : null

    const { state } = editor
    const { from, to } = state.selection
    const onArticleRef = isInArticleRef(editor)
    const attrs = { articleNumber: normalized, targetSlug }

    // Build the inserted node as a single text node carrying the
    // articleRef mark. Doing it in one ``insertContentAt`` step keeps
    // the transaction atomic — much easier on undo than a chain of
    // unsetMark / insertText / setMark steps and avoids the well-known
    // ``setMark`` race after ``insertContent`` (the mark is applied
    // before the text shows up in the doc).
    const markType = state.schema.marks.articleRef
    const insertedNode = state.schema.text(display, [markType.create(attrs)])

    // Pick the range to replace.
    //   - editing inside an existing mark → the full mark range
    //   - non-empty selection → the selection
    //   - empty selection → caret (insertion point)
    let range: { from: number; to: number }
    if (onArticleRef) {
      const r = getActiveMarkRange(editor)
      range = r ? { from: r.from, to: r.to } : { from, to }
    } else {
      range = { from, to }
    }

    editor
      .chain()
      .focus()
      .insertContentAt(range, insertedNode.toJSON())
      .setTextSelection(range.from + display.length)
      .run()

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('editor.articleLink.title')}</DialogTitle>
          <DialogDescription>
            {t('editor.articleLink.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="article-link-number"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {t('editor.articleLink.number')}
            </label>
            <input
              ref={numberInputRef}
              id="article-link-number"
              type="text"
              value={articleNumber}
              onChange={(e) => {
                setArticleNumber(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={t('editor.articleLink.numberPlaceholder')}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="article-link-display"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {t('editor.articleLink.display')}
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                {t('editor.articleLink.optional')}
              </span>
            </label>
            <input
              id="article-link-display"
              type="text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={t('editor.articleLink.displayPlaceholder')}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('editor.articleLink.target')}
            </label>
            <TargetCombobox value={target} onChange={setTarget} />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
          >
            {t('editor.articleLink.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            {t('editor.articleLink.insert')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface TargetComboboxProps {
  value: TargetOption
  onChange: (value: TargetOption) => void
}

/**
 * Lightweight searchable combobox for the destination law. Fetches
 * ``/legal-texts`` once on first focus (cached for the dialog's
 * lifetime) and filters client-side as the user types.
 *
 * Not a full Radix listbox — the editor toolbar already has its own
 * popover surface and we don't need keyboard a11y at the same level as
 * a public combobox. ``Escape`` closes the popover; clicks outside
 * close it via a global listener.
 */
function TargetCombobox({ value, onChange }: TargetComboboxProps) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<LegalTextListItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  /** Single close path — clears the query state alongside the open
   *  flag so the popover starts fresh next time. Keeps the lint rule
   *  happy by avoiding an effect just to reset ``query``. */
  const closePopover = () => {
    setOpen(false)
    setQuery('')
  }

  // Lazy-fetch the legal-texts list the first time the popover opens.
  // Limit=500 covers the current corpus comfortably; the call sits
  // behind the dialog so it doesn't tax the editor page. Network I/O
  // is the canonical "side-effect-with-state" pattern an effect is
  // built for — disable the lint here since the fetch can't move out
  // to render.
  useEffect(() => {
    if (!open || items !== null || loading) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    listTexts({ limit: 500, sort: 'alphabetical' })
      .then((res) => {
        if (cancelled) return
        setItems(res.items ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, items, loading])

  // Click-outside close.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const el = wrapperRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) closePopover()
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Focus the search input when the popover opens so editors can type
  // straight away.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const filtered = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    if (!q) return items.slice(0, 60)
    const tokens = q.split(/\s+/).filter(Boolean)
    return items
      .filter((it) => {
        const hay = `${it.title_fr ?? ''} ${it.title_ht ?? ''} ${it.slug}`.toLowerCase()
        return tokens.every((tok) => hay.includes(tok))
      })
      .slice(0, 60)
  }, [items, query])

  const triggerLabel =
    value.kind === 'self' ? t('editor.articleLink.targetSelf') : value.titleFr

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary"
      >
        <span className="flex-1 min-w-0 truncate text-left">
          {triggerLabel}
        </span>
        {value.kind === 'text' && (
          <span
            role="button"
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation()
              onChange(SELF_OPTION)
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      {value.kind === 'text' && (
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-mono">{value.slug}</span>
        </div>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 px-2 py-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('editor.articleLink.searchPlaceholder')}
                className="w-full h-8 pl-7 pr-2 text-xs rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary"
              />
            </div>
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(SELF_OPTION)
                  closePopover()
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800',
                  value.kind === 'self' && 'bg-primary/5 text-primary',
                )}
              >
                <Check
                  className={cn(
                    'w-3.5 h-3.5 flex-shrink-0',
                    value.kind === 'self' ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <span className="font-semibold">
                  {t('editor.articleLink.targetSelf')}
                </span>
              </button>
            </li>

            {loading && (
              <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('editor.articleLink.loading')}
              </li>
            )}

            {!loading && filtered.length === 0 && items !== null && (
              <li className="px-3 py-2 text-xs italic text-slate-400">
                {t('editor.articleLink.noResults')}
              </li>
            )}

            {!loading &&
              filtered.map((it) => {
                const selected =
                  value.kind === 'text' && value.slug === it.slug
                return (
                  <li key={it.slug}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({
                          kind: 'text',
                          slug: it.slug,
                          titleFr: it.title_fr,
                          titleHt: it.title_ht,
                        })
                        closePopover()
                      }}
                      className={cn(
                        'w-full flex items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800',
                        selected && 'bg-primary/5 text-primary',
                      )}
                    >
                      <Check
                        className={cn(
                          'w-3.5 h-3.5 flex-shrink-0 mt-0.5',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-slate-700 dark:text-slate-200">
                          {it.title_fr}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate">
                          {it.slug}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
