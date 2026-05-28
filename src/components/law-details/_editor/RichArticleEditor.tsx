'use client'

import { useEffect } from 'react'
import {
  EditorContent,
  Extension,
  Node,
  useEditor,
  type Editor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns2,
  Columns3,
  CornerDownLeft,
  Heading1,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  PilcrowLeft,
  Quote,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Custom Tiptap extension: paragraph-level indentation.
 *
 * Stores indent as ``margin-left: <N>em`` on the paragraph's
 * ``style`` attribute. The backend sanitizer's CSSSanitizer
 * allowlists ``margin-left``, so the value round-trips through
 * persistence. Tab adds 2em (max 8em); Shift-Tab removes 2em.
 *
 * Bound only to ``paragraph`` — lists already handle their own
 * indentation through ``Mod-]`` / ``Mod-[`` in StarterKit.
 */
const STEP_EM = 2
const MAX_EM = 8

const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = (el as HTMLElement).style.marginLeft
              if (!ml) return 0
              const m = /^(\d+(?:\.\d+)?)em$/.exec(ml.trim())
              return m ? Math.min(parseFloat(m[1]), MAX_EM) : 0
            },
            renderHTML: (attrs) => {
              const v = attrs.indent
              if (!v) return {}
              return { style: `margin-left: ${v}em` }
            },
          },
          // First-line indent ("retrait de première ligne") — the classic
          // legal-paragraph alinéa indent. Stored as ``text-indent`` so it
          // is independent of the block-level ``margin-left`` indent above
          // and round-trips through the sanitizer's text-indent allowance.
          firstLine: {
            default: 0,
            parseHTML: (el) => {
              const ti = (el as HTMLElement).style.textIndent
              if (!ti) return 0
              const m = /^(\d+(?:\.\d+)?)em$/.exec(ti.trim())
              return m ? Math.min(parseFloat(m[1]), MAX_EM) : 0
            },
            renderHTML: (attrs) => {
              const v = attrs.firstLine
              if (!v) return {}
              return { style: `text-indent: ${v}em` }
            },
          },
        },
      },
    ]
  },

  addKeyboardShortcuts() {
    // ``direction`` is +STEP_EM for Tab (increase indent), -STEP_EM
    // for Shift-Tab (decrease). When a multi-paragraph selection is
    // active, walks every paragraph touched by ``[from, to]`` and
    // applies the same delta to each, clamped to the [0, MAX_EM]
    // window. A single batched transaction keeps the change as one
    // undo step.
    const adjustIndent = (direction: 1 | -1) => () => {
      const { state, view } = this.editor
      const { from, to } = state.selection
      const tr = state.tr
      let mutated = false
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name !== 'paragraph') return true
        const current = (node.attrs.indent as number | undefined) ?? 0
        const next =
          direction > 0
            ? Math.min(current + STEP_EM, MAX_EM)
            : Math.max(current - STEP_EM, 0)
        if (next !== current) {
          tr.setNodeMarkup(pos, null, { ...node.attrs, indent: next })
          mutated = true
        }
        return false // paragraphs have no nested paragraphs to recurse into
      })
      if (mutated) view.dispatch(tr)
      // Always consume the Tab key — if every selected paragraph was
      // already at the clamp, returning ``false`` would let the
      // browser shift focus out of the editor, which is unwanted.
      return true
    }
    return {
      Tab: adjustIndent(1),
      'Shift-Tab': adjustIndent(-1),
    }
  },
})

/**
 * Ordered-list marker styles — the enumeration types editors can pick
 * (1. / a. / i. / A. / I.). Stored as a ``rt-ol-<style>`` class on the
 * ``<ol>`` (survives the sanitizer's class allowance); the global CSS
 * maps each class to a ``list-style-type``. ``decimal`` is the default
 * and renders no class.
 */
const ORDERED_LIST_STYLES = [
  { value: 'decimal', label: '1. 2. 3.' },
  { value: 'lower-alpha', label: 'a. b. c.' },
  { value: 'upper-alpha', label: 'A. B. C.' },
  { value: 'lower-roman', label: 'i. ii. iii.' },
  { value: 'upper-roman', label: 'I. II. III.' },
] as const

const _OL_STYLE_VALUES = ORDERED_LIST_STYLES.map((s) => s.value) as string[]

const OrderedListStyle = Extension.create({
  name: 'orderedListStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['orderedList'],
        attributes: {
          listStyle: {
            default: 'decimal',
            parseHTML: (el) => {
              const cls = (el as HTMLElement).getAttribute('class') || ''
              const m = /rt-ol-([a-z-]+)/.exec(cls)
              return m && _OL_STYLE_VALUES.includes(m[1]) ? m[1] : 'decimal'
            },
            renderHTML: (attrs) => {
              const v = attrs.listStyle
              if (!v || v === 'decimal') return {}
              return { class: `rt-ol-${v}` }
            },
          },
        },
      },
    ]
  },
})

/**
 * Multi-column block — wraps its child blocks in a
 * ``<div class="rt-columns rt-columns-N">`` that the global CSS flows
 * into N newspaper-style columns (``column-count``). Used for dense
 * signer lists / side-by-side runs. The column count rides on the class
 * so it survives the sanitizer; ``wrapIn`` / ``lift`` (built-in
 * commands) create / remove the wrapper from the toolbar.
 */
const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: false,
  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (el) => {
          const cls = (el as HTMLElement).getAttribute('class') || ''
          const m = /rt-columns-(\d)/.exec(cls)
          const n = m ? parseInt(m[1], 10) : 2
          return n === 3 ? 3 : 2
        },
        renderHTML: (attrs) => ({
          class: `rt-columns rt-columns-${attrs.count === 3 ? 3 : 2}`,
        }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div.rt-columns' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0]
  },
})

/**
 * Minimal Tiptap-backed rich-text editor for article bodies.
 *
 * Toolbar exposes the formatting visitors of Haitian law actually
 * need on a single article: bold, italic, bullet/ordered lists, and
 * paragraph alignment. Output is HTML — the backend sanitizes it
 * through ``_sanitize_article_html`` before persistence, so we don't
 * have to do extra cleanup here.
 *
 * Legacy plain-text bodies (everything imported before Tiptap shipped)
 * get converted to a series of ``<p>`` blocks on mount so the editor
 * doesn't collapse paragraph breaks. ``onChange`` always emits HTML.
 */

interface RichArticleEditorProps {
  /** Initial body — accepts HTML or legacy plain text. */
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** Sticks the toolbar accents to the calling color scheme. The
   *  FR editor borders amber; the HT editor borders blue. */
  tone?: 'amber' | 'blue'
  ariaLabel?: string
  disabled?: boolean
}

const HTML_TAG_RE = /^\s*<[a-z][^>]*>/i

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert legacy plain-text bodies (``\n\n``-separated paragraphs) to
 * Tiptap-compatible HTML. Input already detected as HTML is returned
 * as-is so an editor round-trip is idempotent.
 */
function toEditorHtml(value: string): string {
  if (!value) return ''
  if (HTML_TAG_RE.test(value)) return value
  return value
    .split(/\n{2,}/)
    .map((para) => {
      const escaped = escapeHtml(para.trim()).replace(/\n/g, '<br />')
      return escaped ? `<p>${escaped}</p>` : ''
    })
    .filter(Boolean)
    .join('')
}

const TONE: Record<
  NonNullable<RichArticleEditorProps['tone']>,
  { border: string; ring: string; bg: string; toolbar: string; active: string }
> = {
  amber: {
    border: 'border-amber-200 focus-within:border-amber-500',
    ring: 'focus-within:ring-2 focus-within:ring-amber-100',
    bg: 'bg-amber-50/30',
    toolbar: 'border-amber-200 bg-amber-50/40',
    active: 'bg-amber-200 text-amber-900',
  },
  blue: {
    border: 'border-blue-200 focus-within:border-blue-500',
    ring: 'focus-within:ring-2 focus-within:ring-blue-100',
    bg: 'bg-blue-50/30',
    toolbar: 'border-blue-200 bg-blue-50/40',
    active: 'bg-blue-200 text-blue-900',
  },
}

export function RichArticleEditor({
  value,
  onChange,
  placeholder,
  tone = 'amber',
  ariaLabel,
  disabled = false,
}: RichArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      // StarterKit ships Heading, Blockquote, HorizontalRule, Strike,
      // HardBreak — all the long-form-prose primitives we need.
      // Apply text-align to headings as well so the alignment toolbar
      // also works on title lines.
      StarterKit,
      TextAlign.configure({
        types: ['paragraph', 'heading'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Underline,
      Subscript,
      Superscript,
      ParagraphIndent,
      OrderedListStyle,
      Columns,
      // Tables — non-resizable so the output stays clean HTML
      // (``<table class="rt-table">`` + colspan/rowspan only); the
      // global CSS handles borders + width. Signature grids and any
      // side-by-side content live here.
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: 'rt-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: toEditorHtml(value),
    editable: !disabled,
    immediatelyRender: false,
    // ``preserveWhitespace: 'full'`` keeps leading spaces / tabs /
    // line breaks from pasted text (Word, PDF, plain text). Legal
    // bodies in Haitian Codes often carry hand-typed indents on
    // enumerated items — without this option Tiptap collapses every
    // run of spaces to one, losing visual alignment on paste.
    parseOptions: { preserveWhitespace: 'full' },
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? 'Article body editor',
        class: cn(
          // ``whitespace-pre-wrap`` echoes the preserved-whitespace
          // parse so leading spaces show up while the editor is open.
          'prose prose-slate max-w-none px-4 py-3 outline-none min-h-[8rem]',
          'text-base leading-relaxed text-gray-900 whitespace-pre-wrap',
          'placeholder:text-slate-400 placeholder:italic',
          // Make empty ``<p></p>`` paragraphs render with a visible
          // height in the editor — otherwise the blank lines the
          // editor types collapse on screen and look as if the Enter
          // key did nothing. Matches the published DocumentBody.
          '[&_p:empty]:min-h-[1.5em]',
          '[&_p:has(>br:only-child)]:min-h-[1.5em]',
        ),
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate({ editor }) {
      // Always emit the HTML serialisation; empty docs come out as
      // ``<p></p>`` which the parent normalises to '' before posting.
      onChange(editor.getHTML())
    },
  })

  // Sync external value changes (e.g. cancel + reopen on a different
  // article) without rebuilding the editor. We compare against the
  // current HTML to avoid the keep-typing → cursor-jump bug.
  useEffect(() => {
    if (!editor) return
    const next = toEditorHtml(value)
    if (editor.getHTML() === next) return
    editor.commands.setContent(next, { emitUpdate: false })
  }, [value, editor])

  useEffect(() => {
    if (!editor) return
    if (editor.isEditable !== !disabled) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border min-h-[10rem]',
          TONE[tone].border,
          TONE[tone].bg,
        )}
      />
    )
  }

  const palette = TONE[tone]

  return (
    <div
      className={cn(
        'rounded-md border transition-colors',
        palette.border,
        palette.bg,
        palette.ring,
        disabled && 'opacity-60 pointer-events-none',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 px-2 py-1 border-b',
          palette.toolbar,
        )}
        role="toolbar"
        aria-label="Mise en forme"
      >
        {/* Block-type — Heading 1 / 2 / 3 + Blockquote. Headings come
            from StarterKit and round-trip through the sanitizer (we
            allow h1-h6 there). Blockquote is also StarterKit. */}
        <ToolbarButton
          icon={Heading1}
          label="Titre 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          tone={tone}
        />
        <ToolbarButton
          icon={Heading2}
          label="Titre 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          tone={tone}
        />
        <ToolbarButton
          icon={Heading3}
          label="Titre 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          tone={tone}
        />
        <ToolbarButton
          icon={Quote}
          label="Citation (blockquote)"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          tone={tone}
        />
        <ToolbarSeparator />
        {/* Inline marks — bold / italic / underline / strikethrough /
            sub / sup. ``u``, ``s``, ``sub``, ``sup`` are all on the
            backend allowlist. */}
        <ToolbarButton
          icon={Bold}
          label="Gras"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={Italic}
          label="Italique"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={UnderlineIcon}
          label="Souligné"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Barré"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={SuperscriptIcon}
          label="Exposant (1ᵉʳ)"
          active={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={SubscriptIcon}
          label="Indice"
          active={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          tone={tone}
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={List}
          label="Liste à puces"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Liste numérotée"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          tone={tone}
        />
        {/* Enumeration type for the active ordered list (1. / a. / i. /
            A. / I.). Disabled until the cursor is inside an ordered
            list. */}
        <select
          aria-label="Type de numérotation"
          title="Type de numérotation"
          value={
            (editor.getAttributes('orderedList').listStyle as string) ||
            'decimal'
          }
          disabled={!editor.isActive('orderedList')}
          onChange={(e) =>
            editor
              .chain()
              .focus()
              .updateAttributes('orderedList', { listStyle: e.target.value })
              .run()
          }
          className="h-8 rounded border border-slate-200 bg-white/70 px-1.5 text-xs text-slate-600 outline-none disabled:opacity-40"
        >
          {ORDERED_LIST_STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ToolbarSeparator />
        <ToolbarButton
          icon={AlignLeft}
          label="Aligner à gauche"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          tone={tone}
        />
        <ToolbarButton
          icon={AlignCenter}
          label="Centrer"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          tone={tone}
        />
        <ToolbarButton
          icon={AlignRight}
          label="Aligner à droite"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          tone={tone}
        />
        <ToolbarButton
          icon={AlignJustify}
          label="Justifier"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          tone={tone}
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={CornerDownLeft}
          label="Saut de ligne (Maj+Entrée)"
          onClick={() => editor.chain().focus().setHardBreak().run()}
          tone={tone}
        />
        <ToolbarButton
          icon={Minus}
          label="Ligne horizontale"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tone={tone}
        />
        <ToolbarSeparator />
        <ToolbarButton
          icon={IndentDecrease}
          label="Diminuer le retrait (Shift+Tab)"
          onClick={() => {
            editor.chain().focus().run()
            // Trigger the same keymap path used by Shift-Tab so the
            // toolbar button and the keyboard shortcut produce
            // identical document state.
            const ev = new KeyboardEvent('keydown', {
              key: 'Tab',
              shiftKey: true,
              bubbles: true,
            })
            editor.view.dom.dispatchEvent(ev)
          }}
          tone={tone}
        />
        <ToolbarButton
          icon={IndentIncrease}
          label="Augmenter le retrait (Tab)"
          onClick={() => {
            editor.chain().focus().run()
            const ev = new KeyboardEvent('keydown', {
              key: 'Tab',
              bubbles: true,
            })
            editor.view.dom.dispatchEvent(ev)
          }}
          tone={tone}
        />
        <ToolbarButton
          icon={PilcrowLeft}
          label="Retrait de première ligne (alinéa)"
          active={!!editor.getAttributes('paragraph').firstLine}
          onClick={() => {
            const cur = (editor.getAttributes('paragraph').firstLine as
              | number
              | undefined) ?? 0
            editor
              .chain()
              .focus()
              .updateAttributes('paragraph', { firstLine: cur ? 0 : 1.5 })
              .run()
          }}
          tone={tone}
        />

        <ToolbarSeparator />
        {/* Multi-column block — wrap the current block(s) into 2 or 3
            newspaper-style columns. Clicking the active count removes
            the wrapper. */}
        <ToolbarButton
          icon={Columns2}
          label="2 colonnes"
          active={editor.isActive('columns', { count: 2 })}
          onClick={() => toggleColumns(editor, 2)}
          tone={tone}
        />
        <ToolbarButton
          icon={Columns3}
          label="3 colonnes"
          active={editor.isActive('columns', { count: 3 })}
          onClick={() => toggleColumns(editor, 3)}
          tone={tone}
        />

        <ToolbarSeparator />
        {/* Tables — insert a 2×2 grid; cell/row/column ops appear once
            the cursor is inside a table. */}
        <ToolbarButton
          icon={TableIcon}
          label="Insérer un tableau"
          active={editor.isActive('table')}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 2, cols: 2, withHeaderRow: false })
              .run()
          }
          tone={tone}
        />
        {editor.isActive('table') && (
          <>
            <TextToolButton
              label="Ajouter une colonne"
              text="+ Col."
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            />
            <TextToolButton
              label="Ajouter une ligne"
              text="+ Lig."
              onClick={() => editor.chain().focus().addRowAfter().run()}
            />
            <TextToolButton
              label="Supprimer la colonne"
              text="− Col."
              onClick={() => editor.chain().focus().deleteColumn().run()}
            />
            <TextToolButton
              label="Supprimer la ligne"
              text="− Lig."
              onClick={() => editor.chain().focus().deleteRow().run()}
            />
            <TextToolButton
              label="Ligne d'en-tête"
              text="En-tête"
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            />
            <ToolbarButton
              icon={Trash2}
              label="Supprimer le tableau"
              onClick={() => editor.chain().focus().deleteTable().run()}
              tone={tone}
            />
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  onClick: () => void
  tone: NonNullable<RichArticleEditorProps['tone']>
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
  tone,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => {
        // Prevent the editor losing focus before the command runs —
        // otherwise the chain().focus() inside onClick doesn't catch
        // the same selection.
        e.preventDefault()
      }}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded text-slate-600',
        'hover:bg-white/70 transition-colors',
        active && TONE[tone].active,
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

function ToolbarSeparator() {
  return <span className="w-px h-5 bg-slate-200/80 mx-0.5" aria-hidden="true" />
}

/** Wrap the current block(s) in an N-column block, switch the count if
 *  already columned, or unwrap when the active count is clicked again. */
function toggleColumns(editor: Editor, n: number) {
  if (editor.isActive('columns')) {
    const cur = editor.getAttributes('columns').count as number | undefined
    if (cur === n) {
      editor.chain().focus().lift('columns').run()
    } else {
      editor.chain().focus().updateAttributes('columns', { count: n }).run()
    }
  } else {
    editor.chain().focus().wrapIn('columns', { count: n }).run()
  }
}

/** Compact text-label toolbar button — used for the table row/column
 *  operations that have no good single glyph. */
function TextToolButton({
  label,
  text,
  onClick,
}: {
  label: string
  text: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center h-8 px-1.5 rounded',
        'text-[11px] font-semibold text-slate-600 hover:bg-white/70',
        'transition-colors whitespace-nowrap',
      )}
    >
      {text}
    </button>
  )
}
