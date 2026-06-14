'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Flag,
  Loader2,
  Pencil,
  RotateCcw,
  ScanLine,
  Trash2,
  X,
} from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { useT } from '@/i18n/useT'
import {
  deleteMoniteurIssue,
  getMoniteurIssue,
  listMoniteurIssues,
  moniteurIssueSlug,
  parseMoniteurIssue,
  previewMoniteurEntrySplit,
  promoteMoniteurEntry,
  reviewMoniteurEntry,
  updateMoniteurEntryOcr,
  type MoniteurIssueRead,
  type MoniteurIssueWithEntries,
  type MoniteurEntryRead,
  type TranscriptPreview,
} from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'
import { EntryTranslationPanel } from './editor/EntryTranslationPanel'
import { ParserProfileChip } from './editor/ParserProfileChip'

// Copy lives at `editorial.moniteur.review.*` in i18n/{fr,ht}.ts.

// Centralised in @/lib/legal/labels — local alias for indexed lookups.
import { CATEGORY_LABELS as CATEGORY_LABEL } from '@/lib/legal/labels'

/** Keys used by the review pill — restricted to string-valued COPY entries. */
type PillCopyKey = 'pending' | 'promoted' | 'rejected' | 'deferred'

const REVIEW_PILL: Record<
  MoniteurEntryRead['review_status'],
  { cls: string; key: PillCopyKey }
> = {
  pending: { cls: 'bg-slate-100 text-slate-700 border-slate-200', key: 'pending' },
  accepted: {
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    key: 'promoted',
  },
  rejected: { cls: 'bg-red-50 text-red-700 border-red-200', key: 'rejected' },
  deferred: { cls: 'bg-amber-50 text-amber-800 border-amber-200', key: 'deferred' },
}

/** Entry categories that can be promoted to a full LegalText. */
const PROMOTABLE_CATEGORIES = new Set([
  'constitution',
  'code',
  'loi',
  'decret',
  'arrete',
  'convention',
  'ordonnance',
])

/** OCR-quality issue tags (Phase 1) + their French labels. */
const OCR_ISSUE_VALUES = [
  'BRUIT',
  'CROPPED_TEXT',
  'UNREADABLE_SECTIONS',
  'COMPLEX_LAYOUT',
  'TABLEAU',
  'MANUSCRIT',
] as const
const OCR_ISSUE_LABEL: Record<string, string> = {
  BRUIT: 'Bruit',
  CROPPED_TEXT: 'Texte coupé',
  UNREADABLE_SECTIONS: 'Sections illisibles',
  COMPLEX_LAYOUT: 'Mise en page complexe',
  TABLEAU: 'Tableau',
  MANUSCRIT: 'Manuscrit',
}

/** Colour-band a 0–1 OCR confidence score: green ≥0.85, amber ≥0.70, red. */
function ocrBadgeCls(score: number): string {
  if (score >= 0.85)
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
  if (score >= 0.7)
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300'
}

/** Risk-based review (Phase 2): badge styling + bilingual label for the
 *  derived review_risk tier. high → four-eyes; low/medium → single review. */
const RISK_BADGE: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  medium:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  high: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300',
}
function riskLabel(r: 'low' | 'medium' | 'high', lang: 'fr' | 'ht'): string {
  const fr = { low: 'risque faible', medium: 'risque moyen', high: 'risque élevé' }
  const ht = { low: 'ti risk', medium: 'risk mwayen', high: 'gwo risk' }
  return (lang === 'fr' ? fr : ht)[r]
}

type T = (key: string, opts?: { fallback?: string }) => string

type PanelProps = {
  issueId: number
  /** Whether to render the dedicated editorial hero (gradient + breadcrumb
   *  + page title). Off when the panel is embedded under another hero —
   *  the public /moniteur/{slug} page already provides its own chrome. */
  showHero?: boolean
}

/**
 * Editor work surface for one Moniteur issue. Mounted inline on
 * /moniteur/{slug} when the editor toggles into "Vue éditeur" — there
 * is no separate editorial route anymore. The hero stays conditional
 * (``showHero``) for the rare standalone callers (the all-issues
 * dashboard at /editorial/moniteur opens issues here via the public
 * URL with ``?view=editor``).
 */
export function MoniteurIssueEditorPanel({
  issueId,
  showHero = true,
}: PanelProps) {
  const id = issueId
  const { t, language } = useT()
  const lang = ((language as 'fr' | 'ht') ?? 'fr') as 'fr' | 'ht'

  const router = useRouter()
  const [issue, setIssue] = useState<MoniteurIssueWithEntries | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [parsing, setParsing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function confirmDeleteIssue() {
    if (!issue) return
    setDeleting(true)
    setError(null)
    try {
      await deleteMoniteurIssue(issue.id)
      router.push('/moniteur')
    } catch (e: any) {
      setError(e?.body?.detail ?? e?.message ?? String(e))
      setDeleting(false)
    }
  }

  // Inline edit state — keyed by candidate id so opening a different
  // card cancels the in-flight draft instead of carrying it across.
  const [editingFields, setEditingFields] = useState<{
    candidateId: number
    detected_category: string
    detected_title: string
    detected_number: string
    detected_date: string
  } | null>(null)
  const [savingFields, setSavingFields] = useState(false)

  function startEditFields(c: MoniteurEntryRead) {
    setEditingFields({
      candidateId: c.id,
      detected_category: c.detected_category ?? '',
      detected_title: c.detected_title ?? '',
      detected_number: c.detected_number ?? '',
      detected_date: c.detected_date ?? '',
    })
  }
  function cancelEditFields() {
    setEditingFields(null)
  }
  async function saveEditFields() {
    if (!editingFields) return
    setSavingFields(true)
    setError(null)
    try {
      // Send the four detected_* fields PLUS keep ``display_title``
      // in sync with the editor's ``detected_title``. The public
      // ``/moniteur/[id]`` page renders ``display_title ||
      // detected_title`` — when an editor edits the title here, both
      // columns need to update or the public view keeps reading the
      // pre-edit value. Leave ``review_status`` unset so the backend
      // doesn't flip pending → something else by accident.
      const editedTitle = editingFields.detected_title || null
      await reviewMoniteurEntry(editingFields.candidateId, {
        detected_category: (editingFields.detected_category || null) as any,
        detected_title: editedTitle,
        display_title: editedTitle,
        detected_number: editingFields.detected_number || null,
        detected_date: editingFields.detected_date || null,
      })
      setEditingFields(null)
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setSavingFields(false)
    }
  }

  // Inline date save — separate from the full Modifier panel so the
  // editor can fix a missing date on a pending/deferred entry without
  // entering edit mode. ``dateSaving`` carries the candidate id of an
  // in-flight save so the input renders a spinner while waiting.
  const [dateSaving, setDateSaving] = useState<number | null>(null)
  async function saveInlineDate(c: MoniteurEntryRead, value: string) {
    setDateSaving(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, {
        detected_date: value || null,
      })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setDateSaving(null)
    }
  }

  // Inline raw_text edit state — separate from `editingFields` so the
  // editor can correct the OCR transcription without losing in-progress
  // metadata edits, and vice versa. Keyed by candidate id.
  const [editingText, setEditingText] = useState<{
    candidateId: number
    raw_text: string
  } | null>(null)
  const [savingText, setSavingText] = useState(false)
  // Live structural preview while the editor is typing in edit mode.
  // Debounced (350ms) to avoid hammering the backend on every keystroke.
  const [preview, setPreview] = useState<TranscriptPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)

  function startEditText(c: MoniteurEntryRead) {
    setEditingText({ candidateId: c.id, raw_text: c.raw_text ?? '' })
    setPreview(null)
  }
  function cancelEditText() {
    setEditingText(null)
    setPreview(null)
  }
  async function saveEditText() {
    if (!editingText) return
    setSavingText(true)
    setError(null)
    try {
      await reviewMoniteurEntry(editingText.candidateId, {
        raw_text: editingText.raw_text,
      })
      setEditingText(null)
      setPreview(null)
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setSavingText(false)
    }
  }

  // OCR-annotation edit state (reviewer remark + issue tags + needs-review
  // flag). One entry at a time, mirroring the editingText pattern.
  const [editingOcr, setEditingOcr] = useState<{
    candidateId: number
    ocr_remark: string
    ocr_issues: string[]
    needs_ocr_review: boolean
  } | null>(null)
  const [savingOcr, setSavingOcr] = useState(false)

  function startEditOcr(c: MoniteurEntryRead) {
    setEditingOcr({
      candidateId: c.id,
      ocr_remark: c.ocr_remark ?? '',
      ocr_issues: c.ocr_issues ?? [],
      needs_ocr_review: !!c.needs_ocr_review,
    })
  }
  function cancelEditOcr() {
    setEditingOcr(null)
  }
  function toggleOcrIssue(v: string) {
    setEditingOcr((p) =>
      p
        ? {
            ...p,
            ocr_issues: p.ocr_issues.includes(v)
              ? p.ocr_issues.filter((x) => x !== v)
              : [...p.ocr_issues, v],
          }
        : p,
    )
  }
  async function saveEditOcr() {
    if (!editingOcr) return
    setSavingOcr(true)
    setError(null)
    try {
      const updated = await updateMoniteurEntryOcr(editingOcr.candidateId, {
        ocr_remark: editingOcr.ocr_remark.trim() || null,
        ocr_issues: editingOcr.ocr_issues.length ? editingOcr.ocr_issues : null,
        needs_ocr_review: editingOcr.needs_ocr_review,
      })
      onEntryUpdated(updated)
      setEditingOcr(null)
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setSavingOcr(false)
    }
  }

  // Debounced preview — fires whenever the editor pauses typing for
  // 350ms. The cleanup cancels the pending fetch and the in-flight
  // promise's result is discarded if a newer edit lands first.
  useEffect(() => {
    if (!editingText) return
    const { candidateId, raw_text } = editingText
    setPreviewing(true)
    let cancelled = false
    const handle = setTimeout(() => {
      previewMoniteurEntrySplit(candidateId, raw_text)
        .then((res) => {
          if (!cancelled) setPreview(res)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
        .finally(() => {
          if (!cancelled) setPreviewing(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [editingText])

  async function refresh() {
    try {
      const data = await getMoniteurIssue(id)
      setIssue(data)
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    }
  }

  // Candidate issues for the "translation source" picker — all other
  // issues the editor can attach as a Kreyòl companion. Loaded once
  // when the page mounts; we don't filter to "same year" because the
  // 36-a-style companion may be published well after the original.
  const [candidateIssues, setCandidateIssues] = useState<MoniteurIssueRead[]>([])
  useEffect(() => {
    let cancelled = false
    listMoniteurIssues({ only_published: false, limit: 500 })
      .then((res) => {
        if (!cancelled) setCandidateIssues(res.items)
      })
      .catch(() => {
        // Non-fatal — picker will just be empty.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Reflect a translation-pointer update back into the local entry list
  // without round-tripping the whole issue.
  const onEntryUpdated = (updated: MoniteurEntryRead) => {
    setIssue((prev) =>
      prev
        ? {
            ...prev,
            entries: prev.entries.map((e) => (e.id === updated.id ? updated : e)),
          }
        : prev,
    )
  }

  useEffect(() => {
    if (!Number.isFinite(id)) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleParseAgain() {
    setParsing(true)
    setError(null)
    try {
      const data = await parseMoniteurIssue(id)
      setIssue(data)
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setParsing(false)
    }
  }

  async function handleAccept(c: MoniteurEntryRead) {
    setBusyId(c.id)
    setError(null)
    try {
      await promoteMoniteurEntry(c.id)
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject(c: MoniteurEntryRead) {
    setBusyId(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, { review_status: 'rejected' })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDefer(c: MoniteurEntryRead) {
    setBusyId(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, { review_status: 'deferred' })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  /** Accept a non-promotable entry (résolution, avis, communiqué, note,
   *  correspondance, …) as a standalone sommaire item — no parent and no
   *  LegalText. This is the direct accept path so every entry can reach a
   *  terminal state and the issue can roll forward to reviewed/published,
   *  even when there is no parent text to attach it to. */
  async function handleAcceptStandalone(c: MoniteurEntryRead) {
    setBusyId(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, { review_status: 'accepted' })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  /** Attach a non-promotable entry (promulgation, communiqué, errata)
   *  to a parent entry in the same issue and mark it accepted. The
   *  parent is the legal text this entry accompanies — a promulgation
   *  letter attaches to the law it promulgates, an errata to the text
   *  it corrects. Setting parent_entry_id surfaces the child below
   *  the parent in the public sommaire (MoniteurDetailClient already
   *  renders child entries as flat rows under their parent card). */
  async function handleAttachToParent(c: MoniteurEntryRead, parentId: number) {
    setBusyId(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, {
        parent_entry_id: parentId,
        review_status: 'accepted',
      })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  /** Detach: drop the parent + flip back to pending so the editor can
   *  reconsider. Used when an attachment was wrong. */
  async function handleDetachFromParent(c: MoniteurEntryRead) {
    setBusyId(c.id)
    setError(null)
    try {
      await reviewMoniteurEntry(c.id, {
        parent_entry_id: null,
        review_status: 'pending',
      })
      await refresh()
    } catch (e: any) {
      setError(e?.body?.detail ?? String(e))
    } finally {
      setBusyId(null)
    }
  }

  // Outer wrapper differs by mode: standalone route gets the full-bleed
  // page chrome (min-h-screen + dark hero); embedded mode renders as a
  // fragment so it slots cleanly under the host page's own hero.
  const Wrapper = showHero ? 'div' : Fragment
  const wrapperProps = showHero
    ? { className: 'min-h-screen bg-white' }
    : {}

  return (
    <Wrapper {...wrapperProps}>
      {showHero && (
        <div className="relative bg-primary text-white overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
          </div>

          <div className="relative z-10 container py-12 lg:py-20 pt-28 lg:pt-36">
            <Breadcrumb
              className="mb-6"
              items={[
                { label: t('editorial.moniteur.review.crumbs.home'), href: '/' },
                { label: t('editorial.moniteur.review.crumbs.moniteur'), href: '/moniteur' },
                {
                  // Smart N° prefix: skip the prefix when the issue.number
                  // already starts with non-digit text like "Spécial N° 5".
                  label: issue
                    ? `${/^[0-9]/.test(issue.number) ? `N° ${issue.number}` : issue.number} / ${issue.year}`
                    : t('editorial.moniteur.review.crumbs.review'),
                },
              ]}
            />

            <div className="max-w-4xl">
              <h1 className="animate-in fade-in slide-in-from-top-2 duration-500 text-4xl lg:text-6xl font-black mb-4 leading-tight tracking-tight text-white">
                {t('editorial.moniteur.review.title')}
              </h1>
              <p className="animate-in fade-in duration-500 delay-100 fill-mode-both text-slate-300 text-lg leading-relaxed">
                {!issue
                  ? t('editorial.moniteur.review.loading')
                  : !issue.file_url
                    ? t('editorial.moniteur.review.subtitleNoFile')
                    : issue.entries.length === 0
                      ? t('editorial.moniteur.review.subtitleNoCandidates')
                      : t('editorial.moniteur.review.subtitlePending')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container py-12 lg:py-16">
        {issue && (
          <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
            {/* Status-summary chips — at-a-glance breakdown of pending /
                accepted / rejected counts so the editor knows progress
                without scanning every entry. */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const counts = {
                  pending: 0,
                  accepted: 0,
                  rejected: 0,
                  deferred: 0,
                }
                for (const e of issue.entries) counts[e.review_status]++
                const items: Array<{
                  key: keyof typeof counts
                  label: string
                  cls: string
                }> = [
                  {
                    key: 'pending',
                    label: lang === 'fr' ? 'En attente' : 'Annatant',
                    cls: 'bg-amber-50 text-amber-800 border-amber-200',
                  },
                  {
                    key: 'accepted',
                    label: lang === 'fr' ? 'Acceptés' : 'Aksepte',
                    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  },
                  {
                    key: 'rejected',
                    label: lang === 'fr' ? 'Rejetés' : 'Rejete',
                    cls: 'bg-red-50 text-red-700 border-red-200',
                  },
                  {
                    key: 'deferred',
                    label: lang === 'fr' ? 'Reportés' : 'Repòte',
                    cls: 'bg-slate-50 text-slate-600 border-slate-200',
                  },
                ]
                return items
                  .filter((i) => counts[i.key] > 0)
                  .map((i) => (
                    <span
                      key={i.key}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold uppercase tracking-wider',
                        i.cls,
                      )}
                    >
                      <span className="tabular-nums">{counts[i.key]}</span>
                      <span>{i.label}</span>
                    </span>
                  ))
              })()}
            </div>

            {/* Action buttons — re-parse, see public view, delete. */}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/moniteur/${moniteurIssueSlug(issue)}`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowRight className="w-4 h-4" />
                {lang === 'fr' ? 'Vue publique' : 'Vi piblik'}
              </Link>
              <button
                onClick={handleParseAgain}
                disabled={parsing}
                className="inline-flex items-center gap-2 rounded-md border border-primary/30 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/[0.04] disabled:opacity-50 transition-colors"
              >
                {parsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('editorial.moniteur.review.parseRunning')}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t('editorial.moniteur.review.runParseAgain')}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={parsing}
                className="inline-flex items-center gap-2 rounded-md border border-red-200 text-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {lang === 'fr' ? 'Supprimer ce numéro' : 'Efase nimewo sa'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <ErrorBanner density="compact" icon={AlertTriangle} className="mb-6">
            {error}
          </ErrorBanner>
        )}

        {issue && issue.entries.length === 0 && !parsing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-6 py-10 text-center text-sm text-slate-600">
            {t('editorial.moniteur.review.subtitleNoCandidates')}
          </div>
        )}

        <div className="space-y-5">
          {issue?.entries.map((c) => {
            const pill = REVIEW_PILL[c.review_status]
            const cat = c.detected_category
              ? (CATEGORY_LABEL[c.detected_category]?.[lang] ?? c.detected_category)
              : '—'
            const isBusy = busyId === c.id
            const isFinal = c.review_status === 'accepted' || c.review_status === 'rejected'
            return (
              <article
                key={c.id}
                className={cn(
                  'rounded-xl border bg-white p-6 lg:p-7 border-slate-200',
                  // Subtle visual demotion for accepted/rejected rows
                  // (keeps focus on pending ones) without locking them
                  // out — the Modifier button below still works.
                  isFinal && 'bg-slate-50/40',
                )}
              >
                <header className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex items-center flex-wrap gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md',
                        'border text-[11px] font-bold uppercase tracking-wider',
                        pill.cls,
                      )}
                    >
                      {t(`editorial.moniteur.review.${pill.key}`)}
                    </span>
                    {c.review_risk && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider',
                          RISK_BADGE[c.review_risk],
                        )}
                        title={
                          c.review_risk === 'high'
                            ? lang === 'fr'
                              ? 'Contenu à risque : second contrôle (quatre yeux) requis avant publication'
                              : 'Kontni a risk : dezyèm kontwòl (kat je) obligatwa anvan piblikasyon'
                            : lang === 'fr'
                              ? 'Une seule relecture suffit avant publication'
                              : 'Yon sèl reli ase anvan piblikasyon'
                        }
                      >
                        {c.review_risk === 'high' && (
                          <Flag className="w-3 h-3" aria-hidden="true" />
                        )}
                        {riskLabel(c.review_risk, lang)}
                      </span>
                    )}
                    {c.confidence && (
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {t('editorial.moniteur.review.cardConfidence')}: {Number(c.confidence).toFixed(2)}
                      </span>
                    )}
                    {c.ocr_confidence_score != null && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums',
                          ocrBadgeCls(Number(c.ocr_confidence_score)),
                        )}
                      >
                        <ScanLine className="w-3 h-3" aria-hidden="true" />
                        OCR {Math.round(Number(c.ocr_confidence_score) * 100)}%
                      </span>
                    )}
                    {c.needs_ocr_review && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <Flag className="w-3 h-3" aria-hidden="true" /> à vérifier
                      </span>
                    )}
                    {c.page_from && (
                      <span className="text-[11px] text-slate-400">
                        {t('editorial.moniteur.review.pages')} {c.page_from}
                        {c.page_to && c.page_to !== c.page_from
                          ? `–${c.page_to}`
                          : ''}
                      </span>
                    )}
                  </div>
                  <ParserProfileChip
                    entry={c}
                    disabled={isFinal}
                    onSaved={(next) => {
                      // Patch the entry in place so the rest of the
                      // card (raw_text, structure preview) reflects the
                      // refreshed content_ast without a full refetch.
                      setIssue((prev) =>
                        prev
                          ? {
                              ...prev,
                              entries: prev.entries.map((e) =>
                                e.id === next.id ? next : e,
                              ),
                            }
                          : prev,
                      )
                    }}
                  />
                </header>

                {editingFields?.candidateId === c.id ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary/65">
                          {t('editorial.moniteur.review.fieldCategory')}
                        </span>
                        <select
                          value={editingFields.detected_category}
                          onChange={(e) =>
                            setEditingFields((prev) =>
                              prev ? { ...prev, detected_category: e.target.value } : prev,
                            )
                          }
                          className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        >
                          <option value="">—</option>
                          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v[lang]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary/65">
                          {t('editorial.moniteur.review.fieldNumber')}
                        </span>
                        <input
                          type="text"
                          value={editingFields.detected_number}
                          onChange={(e) =>
                            setEditingFields((prev) =>
                              prev ? { ...prev, detected_number: e.target.value } : prev,
                            )
                          }
                          className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary/65">
                          {t('editorial.moniteur.review.fieldDate')}
                        </span>
                        <input
                          type="date"
                          value={editingFields.detected_date}
                          onChange={(e) =>
                            setEditingFields((prev) =>
                              prev ? { ...prev, detected_date: e.target.value } : prev,
                            )
                          }
                          className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-widest text-primary/65">
                        {t('editorial.moniteur.review.fieldTitle')}
                      </span>
                      <textarea
                        value={editingFields.detected_title}
                        onChange={(e) =>
                          setEditingFields((prev) =>
                            prev ? { ...prev, detected_title: e.target.value } : prev,
                          )
                        }
                        rows={2}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-primary leading-snug resize-y"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelEditFields}
                        disabled={savingFields}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 text-slate-700 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        {t('editorial.moniteur.review.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={saveEditFields}
                        disabled={savingFields}
                        className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                      >
                        {savingFields ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {savingFields ? t('editorial.moniteur.review.saving') : t('editorial.moniteur.review.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-sm">
                      <Detail label={t('editorial.moniteur.review.cardCategory')}>{cat}</Detail>
                      <Detail label={t('editorial.moniteur.review.cardNumber')}>
                        {c.detected_number || '—'}
                      </Detail>
                      <Detail label={t('editorial.moniteur.review.cardDate')}>
                        {/* Inline date picker — available on every entry
                            (pending, deferred, accepted, promoted). Lets
                            the editor fix a wrong date even after the
                            entry was promoted. The LegalText keeps its
                            own publication_date editable separately on
                            the law detail page; this one is the entry-
                            side record. */}
                        <span className="inline-flex items-center gap-2">
                          <input
                            type="date"
                            value={c.detected_date ?? ''}
                            disabled={dateSaving === c.id}
                            onChange={(e) =>
                              saveInlineDate(c, e.target.value)
                            }
                            aria-label={t('editorial.moniteur.review.cardDate')}
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
                          />
                          {dateSaving === c.id && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          )}
                        </span>
                      </Detail>
                    </div>

                    <Detail label={t('editorial.moniteur.review.cardTitle')}>
                      <p className="text-base font-semibold text-primary leading-snug">
                        {c.detected_title || '(sans titre)'}
                      </p>
                    </Detail>
                  </>
                )}

                <details className="mt-4" open={editingText?.candidateId === c.id}>
                  <summary className="text-xs font-bold uppercase tracking-widest text-primary/65 cursor-pointer hover:text-primary">
                    {t('editorial.moniteur.review.cardExtract')}
                  </summary>
                  {editingText?.candidateId === c.id ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t('editorial.moniteur.review.textHelp')}
                      </p>
                      <textarea
                        value={editingText.raw_text}
                        onChange={(e) =>
                          setEditingText((prev) =>
                            prev ? { ...prev, raw_text: e.target.value } : prev,
                          )
                        }
                        rows={14}
                        className="w-full text-xs text-slate-700 leading-relaxed font-mono bg-white border border-slate-300 rounded-md p-3 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        spellCheck={false}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEditText}
                          disabled={savingText || !isFinal && false}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingText ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {t('editorial.moniteur.review.saveText')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditText}
                          disabled={savingText}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-50"
                        >
                          {t('editorial.moniteur.review.cancelText')}
                        </button>
                      </div>

                      {/* Live structural preview — recomputed (debounced)
                          as the editor types, so they see immediately how
                          their corrections will land in the structured
                          legal blocks at promotion time. */}
                      <TranscriptPreviewPanel
                        preview={preview}
                        loading={previewing}
                        t={t}
                      />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 border border-slate-100 rounded-md p-4 max-h-64 overflow-y-auto">
                        {c.raw_text}
                      </pre>
                      {/* Raw-text edit — always available, even after
                          the entry is accepted/promoted, so the editor
                          can correct OCR mistakes that surface later. */}
                      <button
                        type="button"
                        onClick={() => startEditText(c)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Pencil className="w-3 h-3" />
                        {t('editorial.moniteur.review.editText')}
                      </button>
                    </div>
                  )}
                </details>

                {/* Qualité OCR — machine metrics (read-only) + reviewer
                    annotations. Editor-only surface, so always shown. */}
                <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ScanLine className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span className="text-sm font-medium">Qualité OCR</span>
                    {c.ocr_confidence_score != null ? (
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums',
                          ocrBadgeCls(Number(c.ocr_confidence_score)),
                        )}
                      >
                        {Math.round(Number(c.ocr_confidence_score) * 100)}%
                      </span>
                    ) : (
                      <span className="ml-auto text-[11px] text-slate-400">
                        pas d’OCR (texte/transcription)
                      </span>
                    )}
                  </div>

                  {/* Must-verify fields flagged by the AI (numbers, dates,
                      names, amounts). OCR confidence ≠ correctness — these
                      always need a human eye, which is why a non-empty list
                      forces the high-risk tier + four-eyes. */}
                  {c.critical_flags && c.critical_flags.length > 0 && (
                    <div className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-950/30 px-2.5 py-2 mb-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-300 mb-1">
                        <Flag className="w-3 h-3" aria-hidden="true" />
                        {lang === 'fr'
                          ? 'À vérifier manuellement'
                          : 'Pou verifye alamen'}
                      </div>
                      <ul className="space-y-0.5">
                        {c.critical_flags.map((f, i) => {
                          const field = String(
                            (f as Record<string, unknown>).field ?? '',
                          )
                          const value = String(
                            (f as Record<string, unknown>).value ?? '',
                          )
                          const reason = (f as Record<string, unknown>).reason
                          return (
                            <li
                              key={i}
                              className="text-[12px] text-slate-700 dark:text-slate-300"
                            >
                              {field && (
                                <span className="font-semibold">{field}: </span>
                              )}
                              <span className="tabular-nums">{value}</span>
                              {reason ? (
                                <span className="text-slate-400">
                                  {' '}
                                  — {String(reason)}
                                </span>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {c.ocr_remark_ai && (
                    <div className="flex gap-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-md px-2.5 py-2 mb-2">
                      <Bot
                        className="w-4 h-4 text-indigo-600 dark:text-indigo-300 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <p className="text-[13px] text-indigo-900 dark:text-indigo-200 m-0">
                        {c.ocr_remark_ai}
                      </p>
                    </div>
                  )}

                  {editingOcr?.candidateId === c.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingOcr.ocr_remark}
                        onChange={(e) =>
                          setEditingOcr((p) =>
                            p ? { ...p, ocr_remark: e.target.value } : p,
                          )
                        }
                        rows={2}
                        placeholder="Remarque du relecteur sur la qualité OCR…"
                        className="w-full text-[13px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {OCR_ISSUE_VALUES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleOcrIssue(v)}
                            className={cn(
                              'text-[11px] px-2 py-0.5 rounded-full border transition-colors',
                              editingOcr.ocr_issues.includes(v)
                                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200'
                                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700',
                            )}
                          >
                            {OCR_ISSUE_LABEL[v]}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={editingOcr.needs_ocr_review}
                          onChange={(e) =>
                            setEditingOcr((p) =>
                              p
                                ? { ...p, needs_ocr_review: e.target.checked }
                                : p,
                            )
                          }
                        />
                        <Flag className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        Marquer pour révision OCR
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={saveEditOcr}
                          disabled={savingOcr}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3 py-1 text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                        >
                          {savingOcr ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditOcr}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {(c.ocr_issues ?? []).map((v) => (
                        <span
                          key={v}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        >
                          {OCR_ISSUE_LABEL[v] ?? v}
                        </span>
                      ))}
                      {c.ocr_remark && (
                        <span className="text-[12px] text-slate-600 dark:text-slate-300 italic">
                          “{c.ocr_remark}”
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditOcr(c)}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Annoter l’OCR
                      </button>
                    </div>
                  )}
                </div>

                {editingFields?.candidateId !== c.id && (
                  <div className="mt-5 flex items-center gap-2 flex-wrap">
                    {/* Triage actions (accept / attach-to-parent /
                        reject / defer) only matter before the entry
                        reaches a terminal state. Once accepted or
                        rejected, those decisions live in the DB; the
                        editor still gets the Modifier button below to
                        fix metadata mistakes that surface later. */}
                    {!isFinal && (
                      <>
                        {PROMOTABLE_CATEGORIES.has(c.detected_category ?? '') ? (
                          <button
                            onClick={() => handleAccept(c)}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            {t('editorial.moniteur.review.accept')}
                          </button>
                        ) : (
                          /* Non-promotable categories (résolution, avis,
                             communiqué, correspondance, promulgation, errata,
                             note, autre) don't get their own LegalText. Accept
                             them directly as a standalone sommaire item, OR
                             attach to a parent entry when they ride along with
                             another text (a promulgation letter with the law it
                             promulgates). Both reach `accepted`, so the issue
                             can roll forward — there is always a way to clear a
                             pending entry, even with no parent to attach to. */
                          <>
                            <button
                              onClick={() => handleAcceptStandalone(c)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              {isBusy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {/* Distinct from the promotable "Accepter &
                                  promouvoir" — this accepts the entry into the
                                  sommaire without creating a LegalText. */}
                              {lang === 'fr' ? 'Accepter' : 'Aksepte'}
                            </button>
                            <AttachToParentSelect
                              candidate={c}
                              candidates={issue?.entries ?? []}
                              disabled={isBusy}
                              lang={lang}
                              onAttach={(parentId) => handleAttachToParent(c, parentId)}
                            />
                          </>
                        )}
                        <button
                          onClick={() => handleReject(c)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-md border border-red-200 text-red-700 bg-white px-4 py-2 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          {t('editorial.moniteur.review.reject')}
                        </button>
                        <button
                          onClick={() => handleDefer(c)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-300 text-slate-700 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          {t('editorial.moniteur.review.defer')}
                        </button>
                      </>
                    )}
                    {/* Modifier — always available, even after promotion.
                        Metadata mistakes (wrong number, missing title,
                        bad date) can surface later; the editor needs to
                        be able to fix the entry without first unpromoting
                        it. The LegalText row stays editable on its own
                        detail page. */}
                    <button
                      type="button"
                      onClick={() => startEditFields(c)}
                      disabled={isBusy}
                      className="ml-auto inline-flex items-center gap-2 rounded-md border border-amber-200 text-amber-800 bg-amber-50/50 px-4 py-2 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('editorial.moniteur.review.edit')}
                    </button>
                  </div>
                )}

                {/* Attached-to-parent indicator — surfaced when a non-
                    promotable entry has been accepted with a parent_entry_id.
                    Lets the editor detach (clear the link + flip back to
                    pending) if the attachment was wrong. */}
                {c.parent_entry_id && (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-slate-500">
                      {(() => {
                        const parent = issue?.entries.find(
                          (e) => e.id === c.parent_entry_id,
                        )
                        const parentLabel =
                          parent?.display_title ||
                          parent?.detected_title ||
                          (parent?.detected_number
                            ? `N° ${parent.detected_number}`
                            : `#${c.parent_entry_id}`)
                        return lang === 'fr'
                          ? `Joint au texte parent : « ${parentLabel} »`
                          : `Jwenn ak tèks paran : « ${parentLabel} »`
                      })()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDetachFromParent(c)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 text-slate-700 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      {lang === 'fr' ? 'Détacher' : 'Detache'}
                    </button>
                  </div>
                )}

                {/* Draft inspect link — surfaced whenever the candidate has
                    been accepted and a draft LegalText exists. Outside the
                    `!isFinal` block so it stays visible for accepted
                    candidates (whose action row is hidden). */}
                {c.promoted_legal_text_slug && (
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-xs text-slate-500">
                      {t('editorial.moniteur.review.promoted')}
                    </span>
                    <Link
                      href={`/loi/${c.promoted_legal_text_slug}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/[0.04] transition-colors"
                    >
                      {c.promoted_legal_text_title_fr
                        ? `${t('editorial.moniteur.review.openDraft')} : ${c.promoted_legal_text_title_fr.slice(0, 50)}${c.promoted_legal_text_title_fr.length > 50 ? '…' : ''}`
                        : t('editorial.moniteur.review.openDraft')}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                {/* Translation-source panel — lets the editor record the
                    companion (HT) Moniteur issue + companion documents.
                    Visible for every entry; collapsed by default when
                    no pointer is set. */}
                <EntryTranslationPanel
                  entry={c}
                  candidateIssues={candidateIssues}
                  lang={lang}
                  onUpdated={onEntryUpdated}
                />
              </article>
            )
          })}
        </div>
      </div>

      {/* Cascade-aware delete dialog. Lists everything the editor is
          about to lose: the entries (with titles), the promoted legal
          texts that will lose their source reference, and the on-disk
          PDF + transcript. The legal_texts themselves survive the
          cascade (the FK is SET NULL on promoted_legal_text_id) so we
          phrase that carefully. */}
      {issue && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!open && !deleting) setDeleteOpen(false)
          }}
          onConfirm={confirmDeleteIssue}
          title={
            lang === 'fr'
              ? `Supprimer le numéro ${issue.number} ?`
              : `Efase nimewo ${issue.number} a ?`
          }
          description={
            <div className="space-y-3">
              <p>
                {lang === 'fr'
                  ? "L'opération supprime définitivement les éléments suivants :"
                  : 'Operasyon sa ap efase definitivman bagay sa yo :'}
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>
                  {lang === 'fr'
                    ? `${issue.entries.length} entrée(s) du sommaire`
                    : `${issue.entries.length} antre nan somè a`}
                </li>
                {(() => {
                  const promotedCount = issue.entries.filter(
                    (e) => e.promoted_legal_text_id != null,
                  ).length
                  if (promotedCount === 0) return null
                  return (
                    <li>
                      {lang === 'fr'
                        ? `${promotedCount} texte(s) légal/aux gardent leur contenu mais perdent leur référence à ce numéro`
                        : `${promotedCount} tèks legal yo kenbe kontni yo men yo pèdi referans ak nimewo sa`}
                    </li>
                  )
                })()}
                {issue.file_url && (
                  <li>
                    {lang === 'fr'
                      ? 'Le PDF scanné'
                      : 'PDF a eskane'}
                  </li>
                )}
                {(issue as { transcript_url?: string | null })
                  .transcript_url && (
                  <li>
                    {lang === 'fr'
                      ? 'La transcription (PDF/DOCX source)'
                      : 'Transkripsyon an (sous PDF/DOCX)'}
                  </li>
                )}
              </ul>
              <p className="text-xs text-slate-500 italic">
                {lang === 'fr'
                  ? 'Cette action est irréversible.'
                  : 'Aksyon sa pa ka anile.'}
              </p>
            </div>
          }
          confirmLabel={
            lang === 'fr' ? 'Supprimer définitivement' : 'Efase definitivman'
          }
          cancelLabel={lang === 'fr' ? 'Annuler' : 'Anile'}
          destructive
          loading={deleting}
        />
      )}
    </Wrapper>
  )
}

function TranscriptPreviewPanel({
  preview,
  loading,
  t,
}: {
  preview: TranscriptPreview | null
  loading: boolean
  t: T
}) {
  const blockSummary: Array<{ key: keyof TranscriptPreview; label: string }> = [
    { key: 'preamble', label: t('editorial.moniteur.review.previewPreamble') },
    { key: 'visas', label: t('editorial.moniteur.review.previewVisas') },
    { key: 'considerants', label: t('editorial.moniteur.review.previewConsiderants') },
    { key: 'enacting_formula', label: t('editorial.moniteur.review.previewEnacting') },
  ]

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t('editorial.moniteur.review.previewTitle')}
        </p>
        {loading && (
          <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('editorial.moniteur.review.previewLoading')}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
        {t('editorial.moniteur.review.previewHint')}
      </p>
      {!preview ||
      (!preview.preamble &&
        !preview.visas &&
        !preview.considerants &&
        !preview.enacting_formula &&
        preview.articles.length === 0) ? (
        <p className="text-xs text-slate-400 italic">{t('editorial.moniteur.review.previewEmpty')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {blockSummary.map(({ key, label }) => {
            const value = preview[key] as string | null | undefined
            const has = !!value && value.trim().length > 0
            return (
              <div
                key={key}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-center',
                  has
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-400',
                )}
              >
                <div className="text-[9px] font-bold uppercase tracking-wider">
                  {label}
                </div>
                <div className="text-base font-bold tabular-nums">
                  {has ? '✓' : '—'}
                </div>
              </div>
            )
          })}
          <div
            className={cn(
              'rounded-md border px-2 py-1.5 text-center col-span-2 sm:col-span-4',
              preview.articles.length > 0
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-400',
            )}
          >
            <div className="text-[9px] font-bold uppercase tracking-wider">
              {t('editorial.moniteur.review.previewArticles')}
            </div>
            <div className="text-base font-bold tabular-nums">
              {preview.articles.length}
            </div>
            {preview.articles.length > 0 && (
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {preview.articles.slice(0, 12).map((a) => (
                  <span
                    key={a.number}
                    title={`${a.body_length} car.`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-white border border-blue-200 text-[10px] font-mono text-blue-700"
                  >
                    {a.number}
                  </span>
                ))}
                {preview.articles.length > 12 && (
                  <span className="text-[10px] text-blue-700">
                    +{preview.articles.length - 12}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="text-sm">
      <p className="text-[11px] font-bold uppercase tracking-widest text-primary/65 mb-1">
        {label}
      </p>
      <div className="text-slate-700">{children}</div>
    </div>
  )
}


/**
 * Action control for non-promotable entries (promulgation / communiqué
 * / errata / autre). Renders a "select a parent" dropdown limited to
 * promotable entries in the same issue. Selecting one fires onAttach,
 * which sets parent_entry_id + accepts the entry.
 *
 * Hides itself if no promotable parents are available (in that case
 * the editor can only reject / defer the entry).
 */
function AttachToParentSelect({
  candidate,
  candidates,
  disabled,
  lang,
  onAttach,
}: {
  candidate: MoniteurEntryRead
  candidates: MoniteurEntryRead[]
  disabled: boolean
  lang: 'fr' | 'ht'
  onAttach: (parentId: number) => void | Promise<void>
}) {
  // Eligible parents: any entry in the same issue with a promotable
  // category, that isn't the candidate itself, and that isn't already
  // a child of someone else. Surfaces the natural attachment target
  // for "this promulgation belongs to the [loi / décret / …] above".
  const parents = candidates.filter((e) => {
    if (e.id === candidate.id) return false
    if (e.parent_entry_id) return false
    const cat = e.detected_category ?? ''
    return (
      cat === 'constitution' ||
      cat === 'code' ||
      cat === 'loi' ||
      cat === 'decret' ||
      cat === 'arrete' ||
      cat === 'convention' ||
      cat === 'ordonnance'
    )
  })

  if (parents.length === 0) {
    return null
  }

  return (
    <select
      defaultValue=""
      disabled={disabled}
      onChange={(e) => {
        const id = Number(e.target.value)
        if (Number.isFinite(id) && id > 0) {
          void onAttach(id)
          // Reset the select so the editor can pick again if needed.
          e.target.value = ''
        }
      }}
      className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-3 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors max-w-xs"
      aria-label={
        lang === 'fr'
          ? 'Joindre à un texte parent'
          : 'Jwenn ak yon tèks paran'
      }
    >
      <option value="" disabled>
        {lang === 'fr'
          ? '+ Joindre à un texte parent…'
          : '+ Jwenn ak tèks paran…'}
      </option>
      {parents.map((p) => {
        const label =
          p.display_title ||
          p.detected_title ||
          (p.detected_number ? `N° ${p.detected_number}` : `#${p.id}`)
        return (
          <option key={p.id} value={p.id} className="text-slate-800">
            {label.slice(0, 60)}
            {label.length > 60 ? '…' : ''}
          </option>
        )
      })}
    </select>
  )
}
