'use client'

import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import dynamic from 'next/dynamic'

import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { isHtmlEffectivelyEmpty, looksLikeHtml } from './_editor/utils'
import {
  SECTION_TYPE_LABELS,
  createSection,
  deleteSection,
  reorderSections,
  sectionLabel,
  updateSection,
  type LegalTextSectionInput,
  type LegalTextSectionRead,
  type SectionType,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

// Lazy-load the Tiptap editor — public readers never open the section
// dialog, so they shouldn't pay for the editor bundle.
const RichArticleEditor = dynamic(
  () =>
    import('./_editor/RichArticleEditor').then((m) => ({
      default: m.RichArticleEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[140px] rounded-md border border-slate-200 bg-slate-50/60 animate-pulse" />
    ),
  },
)

const TYPE_ORDER: SectionType[] = [
  'promulgation',
  'adoption',
  'ratification',
  'resolution',
  'approbation',
  'autre',
]

/** Strip tags + collapse whitespace into a one-line header preview —
 *  mirrors EditableFormalBlock so sections read the same on the page. */
function previewSnippet(value: string | null, limit = 90): string {
  if (!value) return ''
  const plain = value
    .replace(/<\/(p|li|blockquote|h[1-6])>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= limit) return plain
  return plain.slice(0, limit).trimEnd() + '…'
}

interface FinalSectionsProps {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  refetch: () => void
}

/**
 * "Partie finale" sections — editor-added labelled rich-text blocks
 * (résolution du Sénat, ratification, acte de promulgation, approbation,
 * or a free `autre` block) rendered after the articles, below the main
 * FinalPart (closing formula + signatures).
 *
 * Each section renders exactly like the "Signataires et formule de
 * clôture" block — a single collapsible card, no extra chrome. All
 * editing (type + label + rich content) happens in a popup
 * (`SectionFormDialog`); the block header carries only compact
 * editor-only icons (edit / reorder / delete). Public readers see the
 * read-only blocks; the same view shows in "Aperçu public".
 */
export function FinalSections({
  law,
  currentLang,
  isEditor,
  refetch,
}: FinalSectionsProps) {
  const sections = (((law as any).sections ?? []) as LegalTextSectionRead[])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const isFr = currentLang === 'fr'

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LegalTextSectionRead | null>(null)

  if (sections.length === 0 && !isEditor) return null

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (s: LegalTextSectionRead) => {
    setEditing(s)
    setFormOpen(true)
  }

  return (
    <div className="mt-10 space-y-4">
      {sections.map((s, i) => (
        <SectionBlock
          key={s.id}
          law={law}
          section={s}
          index={i}
          total={sections.length}
          order={sections.map((x) => x.id)}
          currentLang={currentLang}
          isEditor={isEditor}
          onEdit={() => openEdit(s)}
          refetch={refetch}
        />
      ))}

      {isEditor && (
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <Plus className="w-4 h-4" />
          {isFr ? 'Ajouter une section finale' : 'Ajoute yon seksyon final'}
        </button>
      )}

      {isEditor && (
        <SectionFormDialog
          key={`${editing?.id ?? 'new'}:${formOpen}`}
          open={formOpen}
          onOpenChange={setFormOpen}
          law={law}
          currentLang={currentLang}
          section={editing}
          refetch={refetch}
        />
      )}
    </div>
  )
}

interface SectionBlockProps {
  law: LegalTextRead
  section: LegalTextSectionRead
  index: number
  total: number
  order: number[]
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  onEdit: () => void
  refetch: () => void
}

/**
 * One "partie finale" section, rendered as a collapsible block matching
 * the Signataires block. Read-only display (content edited via the
 * popup); the header carries compact editor-only controls.
 */
function SectionBlock({
  law,
  section,
  index,
  total,
  order,
  currentLang,
  isEditor,
  onEdit,
  refetch,
}: SectionBlockProps) {
  const isFr = currentLang === 'fr'
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const content =
    currentLang === 'ht'
      ? section.content_ht || section.content_fr || ''
      : section.content_fr || ''
  const hasContent = !!content && !isHtmlEffectivelyEmpty(content)
  const title = sectionLabel(section, currentLang)
  const snippet = previewSnippet(content)

  // Hide empty sections from the public; editors always see them so they
  // can fill or remove them.
  if (!hasContent && !isEditor) return null

  const move = async (delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= total) return
    const next = order.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    setBusy(true)
    try {
      await reorderSections(law.slug, next)
      refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'group rounded-xl border bg-white dark:bg-slate-900 transition-all duration-200 overflow-hidden',
        expanded
          ? 'border-slate-200 dark:border-slate-700 shadow-sm'
          : 'border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm',
      )}
    >
      {/* Header row — toggle button (left) + editor icons (right) as
          siblings so the icons never trigger the accordion. */}
      <div
        className={cn(
          'relative flex items-stretch',
          expanded
            ? 'bg-gradient-to-r from-primary/5 via-white to-white dark:from-primary/15 dark:via-slate-900 dark:to-slate-900'
            : 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/60',
        )}
      >
        {/* Left accent rail — spans the whole header row. */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-0 top-0 bottom-0 w-[3px] transition-colors',
            expanded ? 'bg-primary' : 'bg-transparent group-hover:bg-slate-200',
          )}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left"
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200',
              expanded ? 'rotate-0 text-primary' : '-rotate-90',
            )}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200 flex-shrink-0">
            {title}
          </span>
          {!expanded && hasContent && (
            <span className="text-sm text-slate-500 dark:text-slate-400 italic truncate min-w-0 flex-1">
              {snippet}
            </span>
          )}
          {!expanded && !hasContent && (
            <span className="text-xs text-slate-400 italic truncate">
              {isFr ? 'Vide — à compléter' : 'Vid — pou ranpli'}
            </span>
          )}
        </button>

        {isEditor && (
          <div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
            {busy && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400 mr-0.5" />
            )}
            <button
              type="button"
              onClick={onEdit}
              aria-label={isFr ? 'Modifier la section' : 'Modifye seksyon'}
              title={isFr ? 'Modifier' : 'Modifye'}
              className="p-1.5 text-slate-400 hover:text-primary transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={busy || index === 0}
              aria-label={isFr ? 'Monter' : 'Monte'}
              title={isFr ? 'Monter' : 'Monte'}
              className="p-1.5 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={busy || index === total - 1}
              aria-label={isFr ? 'Descendre' : 'Desann'}
              title={isFr ? 'Descendre' : 'Desann'}
              className="p-1.5 text-slate-400 hover:text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              disabled={busy}
              aria-label={isFr ? 'Supprimer la section' : 'Efase seksyon'}
              title={isFr ? 'Supprimer' : 'Efase'}
              className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded body — read-only content. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1">
              {hasContent ? (
                looksLikeHtml(content) ? (
                  <div
                    className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed formal-block-html"
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {content}
                  </div>
                )
              ) : isEditor ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/40 px-4 py-2 text-sm italic text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {isFr
                    ? `Ajouter le contenu — ${title.toLowerCase()}`
                    : `Ajoute kontni — ${title.toLowerCase()}`}
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(false)}
        onConfirm={async () => {
          await deleteSection(section.id)
          setConfirmDel(false)
          refetch()
        }}
        title={isFr ? 'Supprimer cette section ?' : 'Efase seksyon sa a ?'}
        description={
          isFr
            ? 'Cette section finale sera définitivement supprimée.'
            : 'Seksyon final sa a ap efase nèt.'
        }
        confirmLabel={isFr ? 'Supprimer' : 'Efase'}
        cancelLabel={isFr ? 'Annuler' : 'Anile'}
        destructive
      />
    </div>
  )
}

interface SectionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  /** Section being edited, or null to create a new one. */
  section: LegalTextSectionRead | null
  refetch: () => void
}

/**
 * Create / edit popup for a "partie finale" section: type, label, and
 * the rich-text content (for the active language) in one modal. Mounted
 * fresh per open (parent keys it), so lazy initial state seeds cleanly
 * from the target section.
 */
function SectionFormDialog({
  open,
  onOpenChange,
  law,
  currentLang,
  section,
  refetch,
}: SectionFormDialogProps) {
  const isFr = currentLang === 'fr'
  const isEdit = !!section

  const [type, setType] = useState<SectionType>(
    section?.section_type ?? 'autre',
  )
  const [label, setLabel] = useState<string>(
    (isFr ? section?.label_fr : section?.label_ht) ?? '',
  )
  const [content, setContent] = useState<string>(
    (currentLang === 'ht' ? section?.content_ht : section?.content_fr) ?? '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleanContent = isHtmlEffectivelyEmpty(content.trim())
        ? ''
        : content.trim()
      const labelValue = label.trim() || null
      const body: LegalTextSectionInput = { section_type: type }
      if (isFr) body.label_fr = labelValue
      else body.label_ht = labelValue
      if (currentLang === 'ht') body.content_ht = cleanContent
      else body.content_fr = cleanContent

      if (isEdit && section) {
        await updateSection(section.id, body)
      } else {
        await createSection(law.slug, body)
      }
      refetch()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? isFr
                ? 'Modifier la section finale'
                : 'Modifye seksyon final'
              : isFr
                ? 'Nouvelle section finale'
                : 'Nouvo seksyon final'}
          </DialogTitle>
          <DialogDescription>
            {isFr
              ? 'Type, intitulé et contenu (résolution, ratification, acte de promulgation, approbation…).'
              : 'Tip, tit ak kontni (rezolisyon, ratifikasyon, akt pwomilgasyon, apwobasyon…).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isFr ? 'Type' : 'Tip'}
            </label>
            <select
              value={type}
              disabled={saving}
              onChange={(e) => setType(e.target.value as SectionType)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary disabled:opacity-50"
            >
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SECTION_TYPE_LABELS[t][currentLang]}
                </option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isFr ? 'Intitulé' : 'Tit'}
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                {isFr ? '(facultatif)' : '(opsyonèl)'}
              </span>
            </label>
            <input
              type="text"
              value={label}
              disabled={saving}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={SECTION_TYPE_LABELS[type][currentLang]}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-primary disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-400">
              {isFr
                ? 'Laissez vide pour utiliser l’intitulé par défaut du type.'
                : 'Kite vid pou itilize tit pa defo a.'}
            </p>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isFr ? 'Contenu' : 'Kontni'}
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">
                {currentLang === 'ht' ? '(Kreyòl)' : '(Français)'}
              </span>
            </label>
            <RichArticleEditor
              value={content}
              onChange={setContent}
              placeholder={
                isFr
                  ? 'Tapez ou collez le contenu de la section…'
                  : 'Tape oswa kole kontni seksyon an…'
              }
              ariaLabel={isFr ? 'Contenu de la section' : 'Kontni seksyon'}
              tone="amber"
              disabled={saving}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
          >
            {isFr ? 'Annuler' : 'Anile'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit
              ? isFr
                ? 'Enregistrer'
                : 'Sove'
              : isFr
                ? 'Créer la section'
                : 'Kreye seksyon'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
