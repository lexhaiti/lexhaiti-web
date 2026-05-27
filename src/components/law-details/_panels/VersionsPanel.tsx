/**
 * Article versions timeline — vertical timeline of past versions of a
 * single article. Reads real ``article_versions`` rows (mapped to
 * ``VersionEntry`` in the parent ArticleViewer).
 *
 * Date fallback: when a version row has no ``effective_from`` (typical
 * for v1 of historically-imported texts where the publication date
 * lives on the parent LegalText, not on the per-article version row),
 * the panel falls back to ``defaultFromDate`` so the timeline doesn't
 * show a blank "Depuis le ".
 *
 * Editor extras: when ``isEditor`` is true and ``onDeleteVersion`` is
 * wired, each row gets a Trash icon. Backend enforces the "must keep
 * one version" rule + the current-version reassignment, so the UI
 * just calls and lets the API reject if needed.
 */
'use client'

import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatLongDate } from '@/lib/format/date'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export type VersionStatus =
  | 'in_force'
  | 'abrogated'
  | 'suspended'
  | 'transferred'
  | 'obsolete'

export interface VersionEntry {
  /** ``article_versions.id`` — needed by the editor's delete-version
   *  call. Optional because public viewers don't need it. */
  id?: number
  version: number
  status: VersionStatus
  /** ISO yyyy-mm-dd, or '' when the version row carries no
   *  per-version effective_from (v1 of historical imports). The panel
   *  falls back to ``defaultFromDate`` for display in that case. */
  effective_from: string
  effective_to?: string | null
  amended_by?: string | null
  href?: string | null
}

// Per-status visual treatment for the timeline row — pill + dot +
// version-number color. Colors mirror the ones used by the article
// header pill in ArticleViewer so the two surfaces stay in sync.
const STATUS_META: Record<
  VersionStatus,
  {
    label: { fr: string; ht: string }
    pill: string
    dotBorder: string
    dotCenter: string
    versionText: string
  }
> = {
  in_force: {
    label: { fr: 'En vigueur', ht: 'An vigè' },
    pill: 'bg-emerald-100 text-emerald-700',
    dotBorder: 'border-emerald-500',
    dotCenter: 'bg-emerald-500',
    versionText: 'text-emerald-700',
  },
  abrogated: {
    label: { fr: 'Abrogé', ht: 'Abwoje' },
    pill: 'bg-red-100 text-red-700',
    dotBorder: 'border-red-500',
    dotCenter: 'bg-red-500',
    versionText: 'text-red-700',
  },
  suspended: {
    label: { fr: 'Suspendu', ht: 'Sispann' },
    pill: 'bg-amber-100 text-amber-800',
    dotBorder: 'border-amber-500',
    dotCenter: 'bg-amber-500',
    versionText: 'text-amber-700',
  },
  transferred: {
    label: { fr: 'Transféré', ht: 'Transfere' },
    pill: 'bg-blue-100 text-blue-700',
    dotBorder: 'border-blue-500',
    dotCenter: 'bg-blue-500',
    versionText: 'text-blue-700',
  },
  obsolete: {
    label: { fr: 'Obsolète', ht: 'Demode' },
    pill: 'bg-slate-200 text-slate-600',
    dotBorder: 'border-slate-400',
    dotCenter: 'bg-slate-400',
    versionText: 'text-slate-500',
  },
}

interface VersionsPanelProps {
  versions: VersionEntry[]
  currentLang: 'fr' | 'ht'
  /** Fallback date for versions whose ``effective_from`` is blank —
   *  typically the parent LegalText's publication_date (or the
   *  Moniteur issue's date for historical imports). Optional; when
   *  absent the panel shows "—". */
  defaultFromDate?: string | null
  /** Enables the per-row Trash icon. The parent passes
   *  ``onDeleteVersion`` which fires the API call + refetches. */
  isEditor?: boolean
  onDeleteVersion?: (versionId: number) => Promise<void>
}

export function VersionsPanel({
  versions,
  currentLang,
  defaultFromDate,
  isEditor = false,
  onDeleteVersion,
}: VersionsPanelProps) {
  // Long-form date renderer — '28 avril 2024' instead of raw ISO.
  // Falls back to defaultFromDate, then '—', so the timeline always
  // has something readable in the date slot.
  const fmt = (iso: string | null | undefined): string => {
    const value = iso || defaultFromDate || null
    if (!value) return '—'
    return formatLongDate(value, currentLang, '—')
  }

  // Pending-delete state — staged so the ConfirmDialog can show
  // which version is about to disappear before the user commits.
  const [pendingDelete, setPendingDelete] = useState<VersionEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canDelete =
    isEditor && !!onDeleteVersion && versions.length > 1
  const isFr = currentLang === 'fr'

  return (
    <div className="pt-6">
      <p className="text-xs text-slate-500 mb-5">
        {isFr
          ? 'Historique des versions de cet article — du plus récent au plus ancien.'
          : 'Istwa vèsyon atik sa a — pi resan an pi vye.'}
      </p>

      {/* Vertical timeline */}
      <ol className="relative pl-7">
        {/* Continuous line behind dots */}
        <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

        {versions.map((v, idx) => {
          const meta = STATUS_META[v.status]
          const isLast = idx === versions.length - 1
          const isCurrent = idx === 0
          const fromDisplay = fmt(v.effective_from)
          // ``versions`` is newest-first. A historical version's
          // effective_to is rarely set on the row itself — Legifrance
          // doesn't store it either, it just infers the end-of-period
          // from the NEXT (newer) version's effective_from. We do the
          // same here so V1 of an article that was later amended
          // renders "Du <pub_date> au <V2.effective_from>" instead of
          // an open-ended "Depuis le <pub_date>" that misleadingly
          // looks like the current version.
          const newerVersion = idx > 0 ? versions[idx - 1] : null
          const inferredEffectiveTo =
            v.effective_to ?? newerVersion?.effective_from ?? null
          const toDisplay = inferredEffectiveTo
            ? fmt(inferredEffectiveTo)
            : null

          // Build a Légifrance-style status pill:
          //   - current in-force version → green "Version en vigueur
          //     depuis le <date>" (no end date).
          //   - historical in-force version → red "Version en vigueur
          //     du <from> au <to>" (was in force during the period).
          //   - everything else (abrogé / suspendu / …) → existing
          //     status pill from STATUS_META.
          let pillLabel: string
          let pillCls: string
          if (v.status === 'in_force' && isCurrent) {
            pillLabel = isFr
              ? `Version en vigueur depuis le ${fromDisplay}`
              : `Vèsyon an vigè depi ${fromDisplay}`
            pillCls = 'bg-emerald-100 text-emerald-800 border-emerald-200'
          } else if (v.status === 'in_force' && toDisplay) {
            pillLabel = isFr
              ? `Version en vigueur du ${fromDisplay} au ${toDisplay}`
              : `Vèsyon an vigè ${fromDisplay} – ${toDisplay}`
            pillCls = 'bg-red-50 text-red-700 border-red-200'
          } else if (v.status === 'in_force') {
            // Historical but no inferred end (only version, missing
            // newer one's date). Fall back to plain "En vigueur" so
            // we don't render a misleading green "depuis le" pill.
            pillLabel = isFr ? 'En vigueur' : 'An vigè'
            pillCls = 'bg-slate-100 text-slate-700 border-slate-200'
          } else {
            pillLabel = isFr ? meta.label.fr : meta.label.ht
            pillCls = meta.pill
          }

          return (
            <li
              key={v.version}
              className={`relative group ${isLast ? '' : 'pb-6'}`}
            >
              {/* Dot on the timeline */}
              <span
                className={`absolute -left-[1.65rem] top-1.5 w-4 h-4 rounded-full border-[3px] flex items-center justify-center bg-white ${meta.dotBorder}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${meta.dotCenter}`}
                />
              </span>

              <div className="flex items-baseline gap-3 flex-wrap mb-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest ${meta.versionText}`}
                >
                  v{v.version}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${pillCls}`}
                >
                  {pillLabel}
                </span>
                {/* Delete-version affordance — visible only in editor
                    mode, fades in on hover so the timeline reads
                    clean by default. The backend rejects the call if
                    this would leave the article with zero versions,
                    so we don't replicate that guard client-side. */}
                {canDelete && v.id != null && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(v)}
                    aria-label={isFr ? 'Supprimer cette version' : 'Efase vèsyon sa a'}
                    title={isFr ? 'Supprimer cette version' : 'Efase vèsyon sa a'}
                    className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {v.amended_by && (
                <p className="text-xs text-slate-500">
                  {isFr ? 'Modifié par' : 'Modifye pa'}{' '}
                  <a
                    href={v.href ?? '#'}
                    className="text-primary hover:underline font-medium"
                  >
                    {v.amended_by}
                  </a>
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        onConfirm={async () => {
          if (!pendingDelete?.id || !onDeleteVersion) return
          setDeleting(true)
          try {
            await onDeleteVersion(pendingDelete.id)
            setPendingDelete(null)
          } finally {
            setDeleting(false)
          }
        }}
        title={
          isFr ? 'Supprimer cette version ?' : 'Efase vèsyon sa a?'
        }
        description={
          pendingDelete ? (
            <span>
              {isFr ? 'La version ' : 'Vèsyon '}
              <span className="font-semibold text-slate-900">
                v{pendingDelete.version}
              </span>{' '}
              {isFr
                ? "sera retirée de l'historique. Si c'est la version en vigueur, la plus récente restante prendra sa place. Cette action est irréversible."
                : "ap retire nan istwa a. Si li se vèsyon ki an vigè a, vèsyon ki rete a ap pran plas li. Aksyon sa pa ka anile."}
            </span>
          ) : null
        }
        confirmLabel={isFr ? 'Supprimer' : 'Efase'}
        cancelLabel={isFr ? 'Annuler' : 'Anile'}
        destructive
        loading={deleting}
      />
    </div>
  )
}
