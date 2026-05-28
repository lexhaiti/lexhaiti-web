'use client'

import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'

import { EditableFormalBlock } from './EditableFormalBlock'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { looksLikeHtml } from './_editor/utils'
import {
  SECTION_TYPE_LABELS,
  createSection,
  deleteSection,
  reorderSections,
  sectionLabel,
  updateSection,
  type LegalTextSectionRead,
  type SectionType,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

const TYPE_ORDER: SectionType[] = [
  'promulgation',
  'adoption',
  'ratification',
  'resolution',
  'approbation',
  'autre',
]

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
 * FinalPart (closing formula + signatures). Public reads them; editors
 * add / type / label / reorder / delete + edit each body via the rich
 * editor.
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

  if (sections.length === 0 && !isEditor) return null

  if (!isEditor) {
    // ── Public read view ──────────────────────────────────────────
    return (
      <div className="mt-10 space-y-8">
        {sections.map((s) => {
          const content =
            currentLang === 'ht'
              ? s.content_ht || s.content_fr || ''
              : s.content_fr || ''
          if (!content.trim()) return null
          return (
            <section key={s.id} className="scroll-mt-24">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                {sectionLabel(s, currentLang)}
              </h3>
              {looksLikeHtml(content) ? (
                <div
                  className="formal-block-html text-sm text-slate-700 leading-relaxed [&_strong]:text-slate-900"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {content}
                </div>
              )}
            </section>
          )
        })}
      </div>
    )
  }

  // ── Editor view ───────────────────────────────────────────────────
  return (
    <div className="mt-10 space-y-6">
      {sections.map((s, i) => (
        <SectionEditorCard
          key={s.id}
          law={law}
          section={s}
          index={i}
          total={sections.length}
          order={sections.map((x) => x.id)}
          currentLang={currentLang}
          refetch={refetch}
        />
      ))}

      <button
        type="button"
        onClick={async () => {
          await createSection(law.slug, {
            section_type: 'autre',
            content_fr: '',
          })
          refetch()
        }}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="w-4 h-4" />
        {isFr ? 'Ajouter une section finale' : 'Ajoute yon seksyon final'}
      </button>
    </div>
  )
}

interface SectionEditorCardProps {
  law: LegalTextRead
  section: LegalTextSectionRead
  index: number
  total: number
  order: number[]
  currentLang: 'fr' | 'ht'
  refetch: () => void
}

function SectionEditorCard({
  law,
  section,
  index,
  total,
  order,
  currentLang,
  refetch,
}: SectionEditorCardProps) {
  const isFr = currentLang === 'fr'
  const [labelDraft, setLabelDraft] = useState(
    (isFr ? section.label_fr : section.label_ht) ?? '',
  )
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

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

  const saveType = async (section_type: SectionType) => {
    setBusy(true)
    try {
      await updateSection(section.id, { section_type })
      refetch()
    } finally {
      setBusy(false)
    }
  }

  const saveLabel = async () => {
    const field = isFr ? 'label_fr' : 'label_ht'
    const value = labelDraft.trim() || null
    const current = (isFr ? section.label_fr : section.label_ht) ?? null
    if (value === current) return
    setBusy(true)
    try {
      await updateSection(section.id, { [field]: value })
      refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Meta row — type + label + reorder/delete */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <select
          aria-label={isFr ? 'Type de section' : 'Tip seksyon'}
          value={section.section_type}
          disabled={busy}
          onChange={(e) => saveType(e.target.value as SectionType)}
          className="h-8 rounded border border-slate-200 bg-white px-1.5 text-xs font-semibold text-slate-700 outline-none disabled:opacity-50"
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {SECTION_TYPE_LABELS[t][currentLang]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={labelDraft}
          disabled={busy}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={saveLabel}
          placeholder={
            SECTION_TYPE_LABELS[section.section_type][currentLang]
          }
          className="h-8 flex-1 min-w-[8rem] rounded border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-primary disabled:opacity-50"
        />
        {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={busy || index === 0}
          aria-label={isFr ? 'Monter' : 'Monte'}
          className="p-1 text-slate-400 hover:text-primary disabled:opacity-30"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={busy || index === total - 1}
          aria-label={isFr ? 'Descendre' : 'Desann'}
          className="p-1 text-slate-400 hover:text-primary disabled:opacity-30"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDel(true)}
          disabled={busy}
          aria-label={isFr ? 'Supprimer la section' : 'Efase seksyon'}
          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Body — bilingual rich content via the shared editor */}
      <div className="p-3">
        <EditableFormalBlock
          isFr={isFr}
          isEditor
          defaultExpanded
          title={sectionLabel(section, currentLang)}
          value={
            currentLang === 'ht'
              ? section.content_ht || section.content_fr || null
              : section.content_fr || null
          }
          valueHt={section.content_ht ?? null}
          lawSlug={law.slug}
          lawId={law.id}
          onSave={async (v) => {
            const field = isFr ? 'content_fr' : 'content_ht'
            await updateSection(section.id, { [field]: v })
            refetch()
          }}
        />
      </div>

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
