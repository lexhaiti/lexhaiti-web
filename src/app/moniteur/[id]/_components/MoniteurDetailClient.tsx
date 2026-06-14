'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Download,
  ExternalLink,
  FileText,
  Files,
  Info,
  Layers,
  Newspaper,
  Pencil,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import {
  deleteMoniteurEntry,
  getMoniteurIssue,
  getMoniteurIssueBySlug,
  type MoniteurIssueWithEntries,
  type MoniteurEntryRead,
} from '@/lib/api/endpoints'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { formatLongDate as formatLongDateBilingual } from '@/lib/format/date'
import { isNestedAccompaniment, smartIssueNumber } from '@/lib/format/moniteur'
import { LoadingState } from '@/components/shared/LoadingState'
import { EmptyState } from '@/components/shared/EmptyState'
import { ReportErrorButton } from '@/components/shared/ReportErrorButton'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { useT } from '@/i18n/useT'

// Editor-only review/translation workspace (~1.3k lines + sub-panels).
// Mounted only when a signed-in editor flips the issue into "editor"
// view, so it has no business in the public reader's first-load bundle.
// ``ssr: false`` because it's a client-only editing surface.
const MoniteurIssueEditorPanel = dynamic(
  () =>
    import('./MoniteurIssueEditorPanel').then((m) => ({
      default: m.MoniteurIssueEditorPanel,
    })),
  { ssr: false },
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Local FR-only convenience wrapper so existing call sites stay tidy.
 *  Falls back to "—" (em-dash) when the date is missing — historic
 *  behaviour of this page, distinct from the empty string used on
 *  /recherche. */
function formatLongDate(iso: string | null | undefined): string {
  return formatLongDateBilingual(iso, 'fr', '—')
}

// Le Moniteur Officiel d'Haïti was founded in 1845 — the first published
// "année" was 1846. So the historic année count for a calendar year is
// `year - 1845` (e.g. 2017 → 172e année). Anchor lives here rather than
// being derived per call so the founding-year decision is documented.
const MONITEUR_FOUNDING_YEAR = 1845

function moniteurAnnee(year: number): number {
  return Math.max(1, year - MONITEUR_FOUNDING_YEAR)
}

type DocType = NonNullable<MoniteurEntryRead['detected_category']>

/** Per-language label pair for each category. Visual styling
 *  (badge/bar/icon palette) is independent of language. Kept as a
 *  separate object so callers can pick the right label by the page's
 *  current language without changing the colour palette. */
const CATEGORY_LABELS: Record<DocType, { fr: [string, string]; ht: [string, string] }> = {
  // [singular, plural]
  constitution:   { fr: ['Constitution', 'Constitutions'],     ht: ['Konstitisyon', 'Konstitisyon yo'] },
  code:           { fr: ['Code', 'Codes'],                     ht: ['Kòd', 'Kòd yo'] },
  loi:            { fr: ['Loi', 'Lois'],                       ht: ['Lwa', 'Lwa yo'] },
  loi_constitutionnelle: { fr: ['Loi constitutionnelle', 'Lois constitutionnelles'], ht: ['Lwa konstitisyonèl', 'Lwa konstitisyonèl yo'] },
  decret:         { fr: ['Décret', 'Décrets'],                 ht: ['Dekrè', 'Dekrè yo'] },
  arrete:         { fr: ['Arrêté', 'Arrêtés'],                 ht: ['Arete', 'Arete yo'] },
  circulaire:     { fr: ['Circulaire', 'Circulaires'],         ht: ['Sikilè', 'Sikilè yo'] },
  convention:     { fr: ['Convention', 'Conventions'],         ht: ['Konvansyon', 'Konvansyon yo'] },
  ordonnance:     { fr: ['Ordonnance', 'Ordonnances'],         ht: ['Òdonans', 'Òdonans yo'] },
  communique:     { fr: ['Communiqué', 'Communiqués'],         ht: ['Kominike', 'Kominike yo'] },
  correspondance: { fr: ['Correspondance', 'Correspondances'], ht: ['Korespondans', 'Korespondans yo'] },
  promulgation:   { fr: ['Promulgation', 'Promulgations'],     ht: ['Pwomilgasyon', 'Pwomilgasyon yo'] },
  // "Errata" is invariable in both languages.
  errata:         { fr: ['Errata', 'Errata'],                  ht: ['Errata', 'Errata'] },
  // Deliberation of a constituted body — CPT, Assemblée, Sénat.
  resolution:     { fr: ['Résolution', 'Résolutions'],         ht: ['Rezolisyon', 'Rezolisyon yo'] },
  // Administrative public notice (bank tirage, commiss-signataire
  // designation, lost-cheque declaration, pension liquidation…).
  avis:           { fr: ['Avis', 'Avis'],                      ht: ['Avi', 'Avi yo'] },
  // Editorial annotation attached to a sommaire row (translator note,
  // transcription gap, deviation from the printed source).
  note:           { fr: ['Note', 'Notes'],                     ht: ['Nòt', 'Nòt yo'] },
  autre:          { fr: ['Autre', 'Autres'],                   ht: ['Lòt', 'Lòt yo'] },
}

/** Resolve the singular/plural label for a category in the active
 *  language. Falls back to the raw category code if the table doesn't
 *  carry it (defensive — keeps a future enum value from breaking the
 *  page even before the labels are added). */
function categoryLabel(
  cat: DocType,
  lang: 'fr' | 'ht',
  opts: { plural?: boolean } = {},
): string {
  const pair = CATEGORY_LABELS[cat]
  if (!pair) return cat
  return pair[lang][opts.plural ? 1 : 0]
}

const CATEGORY_META: Record<
  DocType,
  { label: string; plural: string; badge: string; bar: string; icon: string }
> = {
  constitution: {
    label: 'Constitution',
    plural: 'Constitutions',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    bar: 'bg-amber-500',
    icon: 'text-amber-600',
  },
  code: {
    label: 'Code',
    plural: 'Codes',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    bar: 'bg-purple-500',
    icon: 'text-purple-600',
  },
  loi: {
    label: 'Loi',
    plural: 'Lois',
    badge: 'bg-blue-50 text-blue-800 border-blue-200',
    bar: 'bg-blue-500',
    icon: 'text-blue-600',
  },
  // Added in migration 0029 — a ``loi`` that amends the Constitution.
  // Keeps the blue palette (loi family) but a deeper indigo accent so
  // the constitutional flavour reads at a glance.
  loi_constitutionnelle: {
    label: 'Loi constitutionnelle',
    plural: 'Lois constitutionnelles',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    bar: 'bg-indigo-600',
    icon: 'text-indigo-700',
  },
  decret: {
    label: 'Décret',
    plural: 'Décrets',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    bar: 'bg-indigo-500',
    icon: 'text-indigo-600',
  },
  arrete: {
    label: 'Arrêté',
    plural: 'Arrêtés',
    badge: 'bg-teal-50 text-teal-800 border-teal-200',
    bar: 'bg-teal-500',
    icon: 'text-teal-600',
  },
  circulaire: {
    label: 'Circulaire',
    plural: 'Circulaires',
    badge: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    bar: 'bg-slate-400',
    icon: 'text-slate-500',
  },
  convention: {
    label: 'Convention',
    plural: 'Conventions',
    badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    bar: 'bg-cyan-500',
    icon: 'text-cyan-600',
  },
  ordonnance: {
    label: 'Ordonnance',
    plural: 'Ordonnances',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    bar: 'bg-rose-500',
    icon: 'text-rose-600',
  },
  communique: {
    label: 'Communiqué',
    plural: 'Communiqués',
    badge: 'bg-orange-50 text-orange-800 border-orange-200',
    bar: 'bg-orange-500',
    icon: 'text-orange-600',
  },
  correspondance: {
    label: 'Correspondance',
    plural: 'Correspondances',
    badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    bar: 'bg-yellow-500',
    icon: 'text-yellow-600',
  },
  promulgation: {
    label: 'Promulgation',
    plural: 'Promulgations',
    badge: 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700',
    bar: 'bg-gray-400',
    icon: 'text-gray-500',
  },
  errata: {
    // "Errata" is invariable in French (already plural of erratum).
    label: 'Errata',
    plural: 'Errata',
    badge: 'bg-red-50 text-red-700 border-red-200',
    bar: 'bg-red-500',
    icon: 'text-red-600',
  },
  note: {
    // Editorial note attached to a sommaire row. Sky palette keeps it
    // distinct from the warning-toned errata and the official-toned
    // promulgation/communique rows.
    label: 'Note',
    plural: 'Notes',
    badge: 'bg-sky-50 text-sky-800 border-sky-200',
    bar: 'bg-sky-500',
    icon: 'text-sky-600',
  },
  // Added in migration 0031. Administrative public notice (bank
  // tirage, commiss-signataire designation, lost-cheque, pension
  // liquidation). Lime palette so the gazette-of-record notices
  // sit apart from the regulatory acts (decret/arrete/loi).
  avis: {
    label: 'Avis',
    plural: 'Avis',
    badge: 'bg-lime-50 text-lime-800 border-lime-200',
    bar: 'bg-lime-500',
    icon: 'text-lime-600',
  },
  // Added in migration 0026. Deliberation of a constituted body
  // (CPT, Assemblée nationale, Sénat) — distinct from a regulatory
  // act. Violet so it stands apart from the regulatory family.
  resolution: {
    label: 'Résolution',
    plural: 'Résolutions',
    badge: 'bg-violet-50 text-violet-800 border-violet-200',
    bar: 'bg-violet-500',
    icon: 'text-violet-600',
  },
  autre: {
    label: 'Autre',
    plural: 'Autres',
    badge: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    bar: 'bg-slate-400',
    icon: 'text-slate-500',
  },
}

// ---------------------------------------------------------------------------
// Sommaire card for a single candidate
// ---------------------------------------------------------------------------

function SommaireCard({
  candidate,
  index,
  children: childCandidates,
  isEditor,
  onDelete,
}: {
  candidate: MoniteurEntryRead
  index: number
  children: MoniteurEntryRead[]
  isEditor: boolean
  onDelete: (entryId: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const { language } = useT()
  const lang = (language === 'ht' ? 'ht' : 'fr') as 'fr' | 'ht'
  const isPromoted = !!candidate.promoted_legal_text_slug
  const isPromulgation = candidate.detected_category === 'promulgation'
  const hasRawText = !!candidate.raw_text && !isPromoted
  const meta = candidate.detected_category
    ? CATEGORY_META[candidate.detected_category] ?? CATEGORY_META.autre
    : null
  // Localised category label (e.g. "Promulgation" / "Pwomilgasyon",
  // "Constitution" / "Konstitisyon") — sits on top of the same colour
  // palette as ``meta`` so badges stay visually identical across
  // languages.
  const label = candidate.detected_category
    ? categoryLabel(candidate.detected_category, lang)
    : 'Document'

  // Promulgations don't carry their own titles — they're accompanying
  // letters, not standalone documents. Render with the dedicated
  // CompanionRow (no card chrome, no "Sans titre" placeholder, just
  // a label + page range + inline expand). Used at both top-level and
  // nested-under-parent positions; the row is intentionally identical
  // in both contexts so the eye doesn't have to learn two layouts.
  if (isPromulgation) {
    return (
      <div
        className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both rounded-lg border border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-3 py-1"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <CompanionRow
          candidate={candidate}
          isEditor={isEditor}
          onDelete={onDelete}
        />
      </div>
    )
  }

  const title = candidate.display_title || candidate.detected_title || 'Sans titre'

  return (
    <article
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both',
        'group rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden transition-all duration-300',
        'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]',
        'border-slate-200/80 dark:border-slate-800',
      )}
    >
      <div className="flex">
        {/* Left color bar — category indicator */}
        {meta && (
          <div className={cn('w-1 flex-shrink-0', meta.bar)} aria-hidden="true" />
        )}

        <div className="flex-1 min-w-0">
          {/* Header strip: index + category badge + page range */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[11px] font-mono font-semibold text-slate-300 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              {meta && (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded border',
                    'text-[10px] font-bold uppercase tracking-wider',
                    meta.badge,
                  )}
                >
                  {label}
                </span>
              )}
            </div>

            {candidate.page_from != null && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                <BookOpen className="w-3 h-3" />
                p. {candidate.page_from}
                {candidate.page_to != null && candidate.page_to !== candidate.page_from
                  ? `–${candidate.page_to}`
                  : ''}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 pb-5">
            {/* Title */}
            {isPromoted ? (
              <Link
                href={
                  candidate.lang === 'ht'
                    ? `/loi/${candidate.promoted_legal_text_slug}?lang=ht`
                    : `/loi/${candidate.promoted_legal_text_slug}`
                }
                className="block text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-primary dark:hover:text-primary transition-colors leading-snug"
              >
                {title}
              </Link>
            ) : hasRawText ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-start gap-2 text-left"
              >
                <span
                  className={cn(
                    'mt-1 flex-shrink-0 transition-transform duration-200',
                    expanded ? 'rotate-90' : '',
                  )}
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </span>
                <span className="font-bold leading-snug hover:text-primary dark:hover:text-primary transition-colors text-base sm:text-lg text-slate-900 dark:text-slate-100">
                  {title}
                </span>
              </button>
            ) : (
              <p className="font-bold leading-snug text-base sm:text-lg text-slate-900 dark:text-slate-100">
                {title}
              </p>
            )}

            {/* Metadata pills */}
            {(candidate.detected_date || candidate.detected_number) && (
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 mt-3 text-xs',
                  hasRawText && 'ml-6',
                )}
              >
                {candidate.detected_date && (
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    Promulguée le {formatLongDate(candidate.detected_date)}
                  </span>
                )}
                {candidate.detected_number && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    N° {candidate.detected_number}
                  </span>
                )}
              </div>
            )}

            {/* CTA for promoted texts */}
            {isPromoted && (
              <Link
                href={
                  candidate.lang === 'ht'
                    ? `/loi/${candidate.promoted_legal_text_slug}?lang=ht`
                    : `/loi/${candidate.promoted_legal_text_slug}`
                }
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-primary hover:gap-2 transition-all"
              >
                Voir le texte structuré
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* Accordion body for non-promoted candidates with raw text */}
            <AnimatePresence>
              {hasRawText && expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 ml-6 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-slate-700">
                    {candidate.raw_text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Child candidates (promulgation letters grouped under parent).
          Promulgations don't carry their own structural identity — they
          accompany the law they promulgate. Render as flat rows inside
          the parent card (no nested rounded-2xl border, no second
          chevron) instead of full SommaireCard chrome. */}
      {childCandidates.length > 0 && (
        <div className="px-5 sm:px-6 pb-5 border-t border-slate-100 dark:border-slate-800 pt-3">
          {childCandidates.map((child) => (
            <CompanionRow
              key={child.id}
              candidate={child}
              isEditor={isEditor}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </article>
  )
}


/**
 * Flat row renderer for a companion candidate (promulgation,
 * communiqué, correspondance, errata, …), rendered as a child of its
 * parent SommaireCard. Companion documents rarely carry titles of
 * their own (they're letters/notes accompanying the promoted law),
 * so we don't show a "Sans titre" placeholder — just the type label,
 * the page range, and an optional inline expansion of the raw text
 * on click. The label reflects the row's own ``detected_category``
 * (not the hardcoded "Promulgation" the previous shape used), so
 * a communiqué attached to an arrêté reads as "Communiqué", not as
 * a promulgation.
 */
function CompanionRow({
  candidate,
  isEditor = false,
  onDelete,
}: {
  candidate: MoniteurEntryRead
  isEditor?: boolean
  onDelete?: (entryId: number) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { language } = useT()
  const lang = (language === 'ht' ? 'ht' : 'fr') as 'fr' | 'ht'
  const hasRawText = !!candidate.raw_text
  const meta = candidate.detected_category
    ? CATEGORY_META[candidate.detected_category] ?? CATEGORY_META.autre
    : null
  // Fallback to the raw category code if our label table doesn't carry
  // it — better than a blank chip. ``autre`` and any future enum value
  // get the slate styling below.
  const label = candidate.detected_category
    ? categoryLabel(candidate.detected_category, lang)
    : 'Document'
  // Title doubles as the editor-typed free-form name for ``autre``
  // entries (per the c9aea41 commit). For other companion kinds it's
  // an optional subtitle the parser may have detected. Either way,
  // showing it when present makes "Autre", "Avis public" readable as
  // two distinct rows instead of two anonymous ones.
  const subtitle = candidate.display_title || candidate.detected_title || null

  const canDelete = isEditor && !!onDelete

  return (
    <div className="-mx-1 group/companion">
      <div className="flex items-start gap-1">
      <button
        type="button"
        onClick={() => hasRawText && setExpanded((v) => !v)}
        disabled={!hasRawText}
        className={cn(
          'flex-1 flex items-start justify-between gap-3 px-2 py-2 text-left rounded-md',
          hasRawText
            ? 'hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer'
            : 'cursor-default',
        )}
      >
        <span className="inline-flex items-start gap-2 min-w-0">
          {hasRawText && (
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-200 mt-0.5',
                expanded && 'rotate-90',
              )}
            />
          )}
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="inline-flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest',
                  meta?.icon ?? 'text-slate-400',
                )}
              >
                {label}
              </span>
              {candidate.detected_number && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                  N° {candidate.detected_number}
                </span>
              )}
            </span>
            {subtitle && (
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">
                {subtitle}
              </span>
            )}
          </span>
        </span>
        {candidate.page_from != null && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 tabular-nums whitespace-nowrap flex-shrink-0 mt-0.5">
            <BookOpen className="w-3 h-3" />
            p. {candidate.page_from}
            {candidate.page_to != null && candidate.page_to !== candidate.page_from
              ? `–${candidate.page_to}`
              : ''}
          </span>
        )}
      </button>
      {/* Editor-only delete affordance — only fades in on row hover so
          the public reader sees a clean list. Confirms via dialog so
          a mis-click doesn't quietly remove the row. */}
      {canDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Supprimer cette entrée"
          title="Supprimer cette entrée"
          className="opacity-0 group-hover/companion:opacity-100 focus:opacity-100 transition-opacity mt-2 mr-1 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      </div>

      <AnimatePresence>
        {hasRawText && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Inline text — no inner card chrome, just indented prose
                under the row's label. */}
            <div className="mt-2 ml-6 pr-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {candidate.raw_text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(false)
        }}
        onConfirm={async () => {
          if (!onDelete) return
          setDeleting(true)
          try {
            await onDelete(candidate.id)
            setConfirmDelete(false)
          } finally {
            setDeleting(false)
          }
        }}
        title="Supprimer cette entrée ?"
        description={
          <span>
            {`L'entrée « ${label}${subtitle ? ` — ${subtitle}` : ''} » sera retirée du sommaire. `}
            Le texte légal lié (s'il existe) reste intact ; seule la ligne dans ce numéro disparaît.
          </span>
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        destructive
        loading={deleting}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MoniteurDetailClient({
  initialData,
}: {
  /** Server-fetched issue (with sommaire entries), seeded for SSR so the
   *  content is in the initial HTML (SEO) and there's no skeleton flash. */
  initialData?: MoniteurIssueWithEntries | null
}) {
  const params = useParams()
  const searchParams = useSearchParams()
  const { isEditor } = useEditorMode()
  const { language } = useT()
  const lang = (language === 'ht' ? 'ht' : 'fr') as 'fr' | 'ht'
  // Route param is named "id" for backwards compatibility but accepts
  // either a numeric ID (``/moniteur/11`` — legacy permalink) or a
  // date slug (``/moniteur/28-avril-1987`` — preferred public form).
  // We dispatch on the shape INSIDE the effect so the dependency
  // array stays a single-element ``[params.id]`` — React's HMR
  // refuses to hot-reload a component whose useEffect-deps changes
  // size between renders, and the previous ``[rawParam, isNumeric]``
  // form tripped that warning after every save.
  const [issue, setIssue] = useState<MoniteurIssueWithEntries | null>(
    initialData ?? null,
  )
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  // View mode for editors: 'public' is the reader layout below, 'editor'
  // mounts the shared MoniteurIssueEditorPanel under the same hero.
  // Defaults to 'editor' when ``?view=editor`` is in the URL — used by
  // the all-issues dashboard at /editorial/moniteur and by the import
  // wizard so editors land directly on the work surface.
  const wantsEditorView = searchParams?.get('view') === 'editor'
  const [view, setView] = useState<'public' | 'editor'>(
    wantsEditorView ? 'editor' : 'public',
  )

  // Download popover — the hero chip is the trigger; on hover/focus it
  // reveals the full dual-download card (LexHaïti edition + official scan).
  // Rendered through a fixed-positioned body portal so the hero's
  // ``overflow-hidden`` can't clip it.
  const dlTriggerRef = useRef<HTMLButtonElement>(null)
  const dlCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [dlPos, setDlPos] = useState<{ top: number; right: number } | null>(
    null,
  )
  const openDownloads = () => {
    if (dlCloseTimer.current) clearTimeout(dlCloseTimer.current)
    const r = dlTriggerRef.current?.getBoundingClientRect()
    if (r) {
      setDlPos({
        top: Math.round(r.bottom + 10),
        right: Math.round(Math.max(12, window.innerWidth - r.right)),
      })
    }
    setDlOpen(true)
  }
  const closeDownloads = () => {
    dlCloseTimer.current = setTimeout(() => setDlOpen(false), 140)
  }
  useEffect(() => () => {
    if (dlCloseTimer.current) clearTimeout(dlCloseTimer.current)
  }, [])

  useEffect(() => {
    // ``useParams`` returns the URL-encoded segment for dynamic
    // routes containing non-ASCII characters. Without decoding, the
    // ``é`` in ``...-spécial-...`` arrives as ``%C3%A9`` and the
    // ``encodeURIComponent`` inside getMoniteurIssueBySlug then
    // doubles the encoding to ``%25C3%25A9`` — guaranteeing a 404.
    const rawParam = decodeURIComponent(String(params.id ?? ''))
    if (!rawParam) return
    // Public reads are SSR-seeded (the sommaire is already in the server
    // HTML for SEO, no skeleton flash); only fetch when there's no seed or
    // an editor session needs the fuller, scan-bearing payload.
    if (initialData && !isEditor) return
    const isNumeric = /^\d+$/.test(rawParam)
    setLoading(true)
    const promise = isNumeric
      ? getMoniteurIssue(Number(rawParam))
      : getMoniteurIssueBySlug(rawParam)
    promise
      .then(setIssue)
      .catch(() => setError('Numéro introuvable'))
      .finally(() => setLoading(false))
  }, [params.id, initialData, isEditor])

  // Group entries — must be called before any conditional return so hook order is stable.
  const { topLevel, childrenByParent, categoryCounts } = useMemo(() => {
    const childrenMap = new Map<number, MoniteurEntryRead[]>()
    const top: MoniteurEntryRead[] = []
    const counts = new Map<DocType, number>()

    if (issue) {
      for (const c of issue.entries) {
        // Only true accompaniments (non-promotable entries with a parent)
        // nest. A promotable act stays top-level even if an import wired
        // it under a parent, so it shows in the rollup and as its own card.
        if (isNestedAccompaniment(c)) {
          const list = childrenMap.get(c.parent_entry_id!) ?? []
          list.push(c)
          childrenMap.set(c.parent_entry_id!, list)
        } else {
          top.push(c)
          if (c.detected_category && c.detected_category !== 'promulgation') {
            counts.set(
              c.detected_category,
              (counts.get(c.detected_category) ?? 0) + 1,
            )
          }
        }
      }
    }

    // Print order: ``page_from`` first (entries follow the printed
    // Moniteur), then ``position`` (stable tie-break inside the same
    // page), then ``id`` (deterministic when both are equal). Entries
    // with no ``page_from`` trail. Same key used by the PDF export
    // so the on-screen and exported sommaire match.
    const PAGE_TRAILER = Number.MAX_SAFE_INTEGER
    const orderKey = (e: MoniteurEntryRead) => [
      e.page_from ?? PAGE_TRAILER,
      e.position,
      e.id,
    ] as const
    const byOrder = (a: MoniteurEntryRead, b: MoniteurEntryRead) => {
      const ka = orderKey(a)
      const kb = orderKey(b)
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] !== kb[i]) return ka[i] - kb[i]
      }
      return 0
    }
    top.sort(byOrder)
    for (const list of childrenMap.values()) list.sort(byOrder)

    return {
      topLevel: top,
      childrenByParent: childrenMap,
      categoryCounts: counts,
    }
  }, [issue])

  if (loading) {
    return <LoadingState variant="viewport" />
  }

  if (error || !issue) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 dark:text-slate-400 text-lg">{error ?? 'Erreur de chargement'}</p>
          <Link href="/moniteur" className="text-primary hover:underline mt-4 inline-block">
            ← Retour au Moniteur
          </Link>
        </div>
      </div>
    )
  }

  const formattedDate = formatLongDate(issue.publication_date)
  const numberDisplay = smartIssueNumber(issue.number)
  const sortedCategoryEntries = Array.from(categoryCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )

  return (
    <div className="min-h-screen bg-slate-50/40 dark:bg-slate-950">
      {/* ------------------------------------------------------------------- */}
      {/* Newspaper masthead header                                          */}
      {/* ------------------------------------------------------------------- */}
      <div className="relative bg-primary dark:bg-slate-900 text-white overflow-hidden border-b border-white/5 dark:border-slate-800">
        {/* Background decorative elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        {/* Spacer reserving the fixed menu nav's height (h-20). Decoupling
            menu clearance from the inner padding lets us use balanced py-*
            below for symmetric top/bottom space inside the dark band. */}
        <div aria-hidden className="h-20" />
        <div className="relative z-10 container py-12 lg:py-20">
          <Breadcrumb
            className="mb-8"
            items={[
              { label: 'Accueil', href: '/' },
              { label: 'Le Moniteur', href: '/moniteur' },
              { label: numberDisplay },
            ]}
          />

          {/* Single-column layout: wordmark → title → date row →
              horizontal stats row. Matches the LawDetail hero so the
              two reading surfaces feel like one app. */}
          <div className="flex flex-col gap-6">
            {/* "LE MONITEUR" wordmark */}
            <div className="animate-in fade-in duration-500 flex items-center gap-3">
              <Newspaper className="w-4 h-4 text-red-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">
                Le Moniteur · Journal Officiel
              </span>
            </div>

            {/* Big issue number */}
            <h1 className="animate-in fade-in slide-in-from-top-2 duration-500 delay-100 fill-mode-both text-5xl lg:text-7xl font-black leading-[0.95] tracking-tight">
              {numberDisplay}
            </h1>

            {/* Date + edition pill row */}
            <div
              className="animate-in fade-in duration-500 fill-mode-both flex flex-wrap items-center gap-3"
              style={{ animationDelay: '180ms' }}
            >
              <div className="inline-flex items-center gap-2 text-base lg:text-lg text-white/90 font-medium">
                <Calendar className="w-4 h-4 text-white/60" />
                {formattedDate}
              </div>
              {issue.edition_label && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 text-xs font-bold uppercase tracking-wider">
                  {issue.edition_label}
                </span>
              )}
            </div>

            {/* ── Stats + download row ───────────────────────────
                Same icon-circle + label/value pattern as
                ``LawDetail``: ``ANNÉE`` · ``CONTENU`` · ``PAGES`` ·
                ``TÉLÉCHARGER``. Flex-wrap so the row collapses
                gracefully on phones; ``divide`` would force one
                line. ``mt-2`` adds breathing room between the
                pills above and this denser metadata band. */}
            <div
              className="animate-in fade-in duration-500 fill-mode-both flex flex-wrap items-center gap-x-8 gap-y-5 mt-2"
              style={{ animationDelay: '240ms' }}
            >
              <HeroChip
                icon={Calendar}
                label="Année"
                value={`${issue.year}`}
              />
              <HeroChip
                icon={Files}
                label="Contenu"
                value={`${topLevel.length} ${
                  topLevel.length > 1 ? 'actes' : 'acte'
                }`}
              />
              {issue.page_count != null && (
                <HeroChip
                  icon={Layers}
                  label="Pages"
                  value={`${issue.page_count}`}
                />
              )}
              <HeroChip
                icon={BookOpen}
                label="Année moniteur"
                value={`${moniteurAnnee(issue.year)}e année`}
              />
              {/* Download chip — two roles in one tile: ``PDF`` is the
                  readable LexHaïti edition; ``Scan original`` is the
                  authoritative source (``fait foi``). The scan is now
                  public for published issues (the structured reader gives
                  the usable text, the scan gives the proof), so it shows
                  to everyone whenever a ``file_url`` exists.            */}
              <div
                onMouseEnter={openDownloads}
                onMouseLeave={closeDownloads}
                className="flex"
              >
                <button
                  ref={dlTriggerRef}
                  type="button"
                  onFocus={openDownloads}
                  onBlur={closeDownloads}
                  aria-haspopup="dialog"
                  aria-expanded={dlOpen}
                  aria-label="Options de téléchargement"
                  className="flex items-center gap-4 text-left rounded-xl -m-2 p-2 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors"
                >
                  <div className="p-3 bg-amber-400/15 border border-amber-300/30 rounded-full">
                    <Download className="w-5 h-5 text-amber-200" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                      Télécharger
                    </p>
                    <p className="text-white font-bold inline-flex items-center gap-1.5">
                      PDF &amp; scan
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </p>
                  </div>
                </button>
              </div>

              {dlOpen &&
                dlPos &&
                createPortal(
                  <div
                    onMouseEnter={openDownloads}
                    onMouseLeave={closeDownloads}
                    style={{
                      position: 'fixed',
                      top: dlPos.top,
                      right: dlPos.right,
                      zIndex: 60,
                    }}
                    className="w-[420px] max-w-[calc(100vw-24px)]"
                  >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150">
                      <a
                        href={`/api/v1/moniteur/issues/${issue.id}/export`}
                        download
                        className="flex items-center gap-3.5 rounded-xl border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/40 p-3 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <FileText className="w-7 h-7 text-blue-700 dark:text-blue-300 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                              Édition LexHaïti — PDF
                            </span>
                            <span className="text-[11px] font-medium text-blue-900 dark:text-blue-100 bg-white dark:bg-slate-800 rounded-full px-2 py-0.5">
                              recommandé
                            </span>
                          </div>
                          <p className="text-[12.5px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                            Texte structuré et recherchable
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-blue-600 rounded-lg px-3 py-2 shrink-0">
                          <Download className="w-4 h-4" />
                          Télécharger
                        </span>
                      </a>

                      {issue.file_url && (
                        <a
                          href={`/api/v1/moniteur/issues/${issue.id}/scan`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3.5 rounded-xl border border-slate-200 dark:border-slate-700 p-3 mt-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                        >
                          <Newspaper className="w-7 h-7 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                Source officielle — Le Moniteur {numberDisplay}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-full px-2 py-0.5">
                                <CircleCheck className="w-3 h-3" />
                                fait foi
                              </span>
                            </div>
                            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Scan original du journal ·{' '}
                              {formatLongDate(issue.publication_date)} · PDF
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 shrink-0">
                            <ExternalLink className="w-4 h-4" />
                            Voir le scan
                          </span>
                        </a>
                      )}

                      <div className="flex items-start gap-2 mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <span className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Édition numérisée à titre informatif. En cas de
                          divergence, la version officielle du Moniteur fait
                          foi.
                        </span>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )}
            </div>
          </div>

          {/* Bottom action row — secondary actions only. The scan
              download moved into the consolidated stat card above
              (auth-gated). This row now exists solely for the
              editor-mode toggle and renders only for editors. */}
          {isEditor && (
            <div
              className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both mt-10 flex flex-wrap items-center gap-3"
            >
              {/* Editor-only toggle. Flips the body below for the
                  review work surface (accept/reject entries, edit text,
                  attach to parent) without leaving the issue's
                  canonical URL. This is the *only* per-issue editor
                  surface — the previous /editorial/moniteur/[id]/review
                  route was removed in favour of this inline toggle. */}
              <button
                type="button"
                onClick={() =>
                  setView(view === 'editor' ? 'public' : 'editor')
                }
                aria-pressed={view === 'editor'}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-400 text-slate-900 text-sm font-bold border border-amber-300 hover:bg-amber-300 transition-all"
              >
                <Pencil className="w-4 h-4" />
                {view === 'editor' ? 'Vue publique' : 'Vue éditeur'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Body — public reader layout, or the editor work surface when      */}
      {/* the editor has toggled into "Vue éditeur". Same canonical URL    */}
      {/* either way; ``MoniteurIssueEditorPanel`` renders with its         */}
      {/* dedicated hero suppressed so this page's chrome stays single.    */}
      {/* ------------------------------------------------------------------- */}
      {isEditor && view === 'editor' ? (
        <MoniteurIssueEditorPanel issueId={issue.id} showHero={false} />
      ) : (
      <div className="container py-10 lg:py-16">
        {/* Category breakdown chips */}
        {sortedCategoryEntries.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 mb-10 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mr-2">
              Composition
            </span>
            {sortedCategoryEntries.map(([cat, n]) => {
              // Fall back to ``autre`` so a future enum addition can't
              // crash this client component before the corresponding
              // palette is wired up.
              const meta = CATEGORY_META[cat] ?? CATEGORY_META.autre
              const word = categoryLabel(cat, lang, { plural: n !== 1 })
              return (
                <span
                  key={cat}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold',
                    meta.badge,
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full', meta.bar)} />
                  <span className="font-mono tabular-nums">{n}</span>
                  {word}
                </span>
              )
            })}
          </div>
        )}

        {/* Sommaire */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75 fill-mode-both">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Sommaire
            </h2>
          </div>

          {topLevel.length > 0 ? (
            <div className="space-y-4">
              {topLevel.map((candidate, i) => (
                <SommaireCard
                  key={candidate.id}
                  candidate={candidate}
                  index={i}
                  children={childrenByParent.get(candidate.id) ?? []}
                  isEditor={isEditor}
                  onDelete={async (entryId) => {
                    await deleteMoniteurEntry(entryId)
                    // Refetch the issue so the deleted row disappears
                    // and any siblings re-order naturally. Keeps the
                    // delete UX consistent with what /editorial/moniteur
                    // does after an edit.
                    const rawParam = decodeURIComponent(String(params.id ?? ''))
                    if (!rawParam) return
                    const isNumeric = /^\d+$/.test(rawParam)
                    const fresh = await (isNumeric
                      ? getMoniteurIssue(Number(rawParam))
                      : getMoniteurIssueBySlug(rawParam))
                    setIssue(fresh)
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState description="Aucun document indexé dans ce numéro." />
          )}
        </section>

        {/* Footer: back-link (left) + report-error (right), under the line */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <Link
            href="/moniteur"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux numéros du Moniteur
          </Link>
          <ReportErrorButton
            lang={lang}
            target={{
              target_type: 'moniteur_issue',
              target_id: issue.id,
              target_slug: issue.slug ?? null,
            }}
          />
        </div>
      </div>
      )}
    </div>
  )
}

// Hero metric inside the identity fiche. Numeral leads, label sits
// underneath in a small uppercase eyebrow style with a paired icon.
// Two of these flank a vertical rule inside the card; centered cells
// give the pair visual balance even when one numeral is wider than
// the other.
// Inline hero stat chip, matching the ``LawDetail`` pattern: a
// circular icon container on the left + a stacked label/value pair
// on the right. Flex-wrap parent keeps the row responsive on phones.
function HeroChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="p-3 bg-white/5 rounded-full border border-white/10">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
          {label}
        </p>
        <p className="text-white font-bold">{value}</p>
      </div>
    </div>
  )
}
