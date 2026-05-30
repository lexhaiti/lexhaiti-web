'use client'

/**
 * Unified per-article action row — pill buttons + expandable panels.
 *
 * Visual + interaction model matches the focused ArticleViewer:
 *
 *   [ ⊕ Textes liés › ]   [ 🕐 Versions  2 › ]   [ ⇄ Comparer › ]
 *
 *   ↓ open panel renders below ↓
 *
 *   ┌────────── Textes liés ──────────┐
 *   │ ↗ Cite (n)        ↗ Citée par (n) │
 *   │ <CitationColumn>  <CitationColumn> │
 *   └─────────────────────────────────┘
 *
 *   ┌────────── Versions ───────────────┐
 *   │ <VersionsPanel timeline>          │
 *   └───────────────────────────────────┘
 *
 *   ┌────────── Comparer ───────────────┐
 *   │ <ComparePanel word-diff>          │
 *   └───────────────────────────────────┘
 *
 * Visibility rules — match the focused viewer:
 *   - Textes liés: visible publicly when there are citations; always
 *                  visible in editor mode (so editors can confirm an
 *                  article truly has no links rather than guess).
 *   - Versions:    visible publicly when ``version_number >= 2``;
 *                  always visible in editor mode.
 *   - Comparer:    same; disabled chip when < 2 versions in editor.
 *
 * Lazy fetches:
 *   - Citations (outgoing + incoming) on first Textes-liés expand.
 *   - Versions on first Versions OR Comparer expand (shared cache).
 *   - Resolver fan-out for cross-text article cites.
 *
 * Used by:
 *   - ArticleListView — one accordion row under each article card.
 *   - (ArticleViewer keeps its own bespoke action row with editor-
 *      only affordances like "Ajouter une version".)
 */

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronRight,
  Clock,
  GitCompare,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast-simple'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  deleteArticle,
  getArticleReferences,
  listArticleVersions,
  type ArticleRefItem,
  type ArticleVersionRead,
} from '@/lib/api/endpoints'
import {
  mapRefItems,
  type CitationEntry,
  type SiblingArticle,
} from './citation-mapping'
import { CitationColumn } from './_panels/CitationColumn'
import { VersionsPanel, type VersionEntry } from './_panels/VersionsPanel'
import { ComparePanel } from './_panels/ComparePanel'
import { AddVersionDialog } from './_panels/AddVersionDialog'
import { AddArticleDialog } from './_panels/AddArticleDialog'

type PanelKey = 'links' | 'versions' | 'compare'

interface Props {
  articleId: number
  /** From the embed — used by the public visibility rule (don't fire
   *  the versions fetch if there's nothing to show). */
  versionNumber?: number | null
  /** Display number of THIS article (e.g. "premier", "1382"). Used
   *  to seed the Add-Version dialog's title and the delete-confirm
   *  prompt. Optional — falls back to a generic label. */
  articleNumber?: string
  /** Current text bodies — pre-fill the Add-Version dialog so the
   *  editor starts from the existing content rather than typing
   *  from scratch. */
  currentTextFr?: string | null
  currentTextHt?: string | null
  currentTitleFr?: string | null
  /** ``ArticleViewer`` already requires this — passed through so
   *  AddVersionDialog can exclude the law from its source-picker
   *  (no self-amendments). */
  lawId?: number | null
  /** Parent legal text's publication date — used as a fallback
   *  ``effective_from`` when an article version row carries none
   *  (typical for v1 of historically-imported texts where the date
   *  lives on the parent, not on the per-version row). */
  lawPublicationDate?: string | null
  /** Current-version metadata for the inline "Modifié par X" line
   *  shown alongside the pill row. All optional — when none of
   *  them are set the line doesn't render. Sourced from the
   *  article embed at the call site so we don't have to refetch
   *  the version timeline just to label the action row. */
  currentEffectiveFrom?: string | null
  sourceAmendmentSlug?: string | null
  sourceAmendmentTitleFr?: string | null
  sourceAmendmentTitleHt?: string | null
  sourceAmendmentArticleNumber?: string | null
  /** The current article's slug + number — passed through to the
   *  citation column so the resolver builds correct same-text deep
   *  links. ``lawSlug`` is needed for the version-row "Modifié par
   *  X" links + same-law article anchors. */
  lawSlug: string
  /** Sibling articles in the parent law — feeds the resolver so
   *  same-text cites render as "Art. 192" without a network round-
   *  trip. Pass ``law.articles`` from the parent. */
  siblingArticles?: SiblingArticle[]
  isEditor?: boolean
  currentLang: 'fr' | 'ht'
  /** Called after Add-Version / Add-Article / Delete succeeds so the
   *  parent can refetch the law and re-render rows. */
  onArticleChanged?: () => void
  /** Editor-only: focus this article in the single-article view and
   *  open its editor (edit-from-any-view). When omitted the "Modifier"
   *  chip is hidden. */
  onEdit?: () => void
}

export function ArticleAccordions({
  articleId,
  versionNumber,
  articleNumber,
  currentTextFr,
  currentTextHt,
  currentTitleFr,
  lawId,
  lawPublicationDate,
  currentEffectiveFrom,
  sourceAmendmentSlug,
  sourceAmendmentTitleFr,
  sourceAmendmentTitleHt,
  sourceAmendmentArticleNumber,
  lawSlug,
  siblingArticles,
  isEditor = false,
  currentLang,
  onArticleChanged,
  onEdit,
}: Props) {
  const isFr = currentLang === 'fr'
  const { toast } = useToast()
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null)

  // Editor-only dialog state (mirrors ArticleViewer 1:1).
  const [addVersionOpen, setAddVersionOpen] = useState(false)
  const [addArticleOpen, setAddArticleOpen] = useState(false)
  const [addArticleMode, setAddArticleMode] = useState<
    'amendment' | 'correction'
  >('amendment')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ────────────────────────────────────────────────────────────────
  // Citations (Textes liés) — lazy
  // ────────────────────────────────────────────────────────────────
  // Single round-trip to ``/articles/{id}/references`` replaces the
  // legacy (citationsFromArticle + citationsToArticle + resolveArticles)
  // trio: the backend now resolves cross-text article titles + hrefs
  // server-side, so a same-text/cross-text fan-out is no longer needed.
  // 3 requests/article → 1.
  const [citationsLoaded, setCitationsLoaded] = useState(false)
  const [citationsLoading, setCitationsLoading] = useState(false)
  const [refOutgoing, setRefOutgoing] = useState<ArticleRefItem[]>([])
  const [refIncoming, setRefIncoming] = useState<ArticleRefItem[]>([])

  // Trigger the references fetch only when the "Textes liés" panel is
  // actually opened. Previously this ALSO fired eagerly in editor mode
  // (``|| isEditor``) so the chip count showed on first render — but
  // that made a signed-in editor fetch citations for EVERY article on
  // page load, flooding the API and tripping its rate limiter (429) on
  // large texts. On-demand loading keeps the page load to ~0 reference
  // requests; the count fills in on open.
  useEffect(() => {
    const needLoad =
      !citationsLoaded && !citationsLoading && openPanel === 'links'
    if (!needLoad) return
    setCitationsLoading(true)
    void getArticleReferences(articleId)
      .then((r) => {
        setRefOutgoing(r.cites ?? [])
        setRefIncoming(r.cited_by ?? [])
        setCitationsLoaded(true)
      })
      .catch(() => {
        // Non-essential; render an empty panel rather than crash.
        setRefOutgoing([])
        setRefIncoming([])
        setCitationsLoaded(true)
      })
      .finally(() => setCitationsLoading(false))
  }, [
    openPanel,
    isEditor,
    citationsLoaded,
    citationsLoading,
    articleId,
  ])

  const outboundEntries = useMemo<CitationEntry[]>(
    () => mapRefItems(refOutgoing),
    [refOutgoing],
  )
  const inboundEntries = useMemo<CitationEntry[]>(
    () => mapRefItems(refIncoming),
    [refIncoming],
  )
  const totalCitations = outboundEntries.length + inboundEntries.length

  // ────────────────────────────────────────────────────────────────
  // Versions — lazy, shared between Versions + Comparer panels
  // ────────────────────────────────────────────────────────────────
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versions, setVersions] = useState<ArticleVersionRead[]>([])

  // Lazy: only fetch when the reader actually opens Versions or
  // Comparer. We deliberately do NOT eager-fetch on mount in editor
  // mode — this component renders once per article in the list view,
  // so an editor opening "Tous" on a 500-article law would otherwise
  // fire 500 version requests at once. The version-count badge falls
  // back to ``versionNumber`` (already on the embed) so nothing is
  // lost by waiting.
  useEffect(() => {
    const hasHistory = (versionNumber ?? 1) > 1
    const wantsNow =
      openPanel === 'versions' || openPanel === 'compare'
    const needLoad =
      !versionsLoaded &&
      !versionsLoading &&
      wantsNow &&
      // skip the fetch entirely when public + no history (chip is
      // hidden anyway, no point spending the request).
      (isEditor || hasHistory)
    if (!needLoad) return
    setVersionsLoading(true)
    void listArticleVersions(articleId)
      .then((rows) => {
        // Newest-first matches the focused viewer's convention.
        setVersions([...rows].reverse())
        setVersionsLoaded(true)
      })
      .catch(() => {
        setVersions([])
        setVersionsLoaded(true)
      })
      .finally(() => setVersionsLoading(false))
  }, [
    openPanel,
    isEditor,
    versionsLoaded,
    versionsLoading,
    versionNumber,
    articleId,
  ])

  const versionEntries = useMemo<VersionEntry[]>(() => {
    if (!versions.length) return []
    return [...versions]
      .sort((a, b) => a.version_number - b.version_number)
      .map<VersionEntry>((v) => {
        const amendingSlug = v.source_amendment_slug ?? null
        const amendingArticleNumber =
          (v as any).source_amendment_article_number ?? null
        const amendingTitle =
          (currentLang === 'ht' && (v as any).source_amendment_title_ht
            ? (v as any).source_amendment_title_ht
            : v.source_amendment_title_fr) ?? null
        const href = amendingSlug
          ? amendingArticleNumber
            ? `/loi/${amendingSlug}?view=article&article=${encodeURIComponent(amendingArticleNumber)}`
            : `/loi/${amendingSlug}`
          : null
        return {
          id: v.id,
          version: v.version_number,
          status: v.status,
          effective_from: v.effective_from ?? '',
          effective_to: v.effective_to ?? null,
          amended_by: amendingTitle,
          href,
        }
      })
      .reverse() // newest first
  }, [versions, currentLang])

  // ────────────────────────────────────────────────────────────────
  // Visibility rules — match the focused viewer
  // ────────────────────────────────────────────────────────────────
  const hasHistory = (versionNumber ?? 1) > 1
  const showLinks = isEditor || (citationsLoaded && totalCitations > 0)
  const showVersions = isEditor || hasHistory
  const showCompare = isEditor || hasHistory
  const anyPill = showLinks || showVersions || showCompare || isEditor
  if (!anyPill) return null

  const togglePanel = (k: PanelKey) =>
    setOpenPanel((cur) => (cur === k ? null : k))

  // ────────────────────────────────────────────────────────────────
  // Editor action handlers
  // ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteArticle(articleId)
      toast(isFr ? 'Article supprimé.' : 'Atik efase.')
      setDeleteOpen(false)
      onArticleChanged?.()
    } catch (e) {
      toast(isFr ? 'Erreur lors de la suppression.' : 'Erè pandan efasaj la.')
    } finally {
      setDeleting(false)
    }
  }
  const articleLabel = articleNumber
    ? /^article|^atik/i.test(articleNumber)
      ? articleNumber
      : isFr
        ? `Art. ${articleNumber === 'premier' ? '1ᵉʳ' : articleNumber}`
        : `Atik ${articleNumber === 'premier' ? '1' : articleNumber}`
    : isFr
      ? 'cet article'
      : 'atik sa a'

  return (
    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-2 flex-wrap">
        {isEditor && onEdit && (
          <PillTrigger
            icon={Pencil}
            label={isFr ? 'Modifier' : 'Modifye'}
            open={false}
            onClick={onEdit}
          />
        )}
        {showLinks && (
          <PillTrigger
            icon={Layers}
            label={isFr ? 'Textes liés' : 'Tèks ki gen rapò'}
            count={citationsLoaded ? totalCitations : undefined}
            open={openPanel === 'links'}
            onClick={() => togglePanel('links')}
          />
        )}
        {showVersions && (
          <PillTrigger
            icon={Clock}
            label={isFr ? 'Versions' : 'Vèsyon'}
            count={
              versionsLoaded
                ? versionEntries.length || undefined
                : versionNumber ?? undefined
            }
            open={openPanel === 'versions'}
            onClick={() => togglePanel('versions')}
          />
        )}
        {showCompare && (
          <PillTrigger
            icon={GitCompare}
            label={isFr ? 'Comparer' : 'Konpare'}
            open={openPanel === 'compare'}
            onClick={() => togglePanel('compare')}
            disabled={(versionNumber ?? 1) < 2}
            disabledTitle={
              isFr
                ? 'Disponible dès la seconde version'
                : 'Disponib depi dezyèm vèsyon an'
            }
          />
        )}

        {/* Editor-only pills — match the focused viewer 1:1 so the
            same affordances are reachable from every list row. Each
            opens an existing dialog component. */}
        {isEditor && lawId != null && (
          <button
            type="button"
            onClick={() => setAddVersionOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors"
            title={
              isFr
                ? 'Créer une nouvelle version ancrée à une loi modifiante'
                : 'Kreye yon nouvo vèsyon ankre nan yon lwa modifikatè'
            }
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">
              {isFr ? 'Ajouter une version' : 'Ajoute yon vèsyon'}
            </span>
          </button>
        )}
        {isEditor && lawId != null && (
          <button
            type="button"
            onClick={() => {
              setAddArticleMode('amendment')
              setAddArticleOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors"
            title={
              isFr
                ? 'Insérer un nouvel article via amendement (ex. Article 9-1, 9 bis…)'
                : 'Mete yon nouvo atik via amannman (egz. Atik 9-1, 9 bis…)'
            }
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">
              {isFr
                ? 'Ajouter un article (amendement)'
                : 'Ajoute yon atik (amannman)'}
            </span>
          </button>
        )}
        {isEditor && lawId != null && (
          <button
            type="button"
            onClick={() => {
              setAddArticleMode('correction')
              setAddArticleOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            title={
              isFr
                ? 'Le parser a oublié un article du texte original ? Ajoutez-le ici.'
                : 'Pasè a bliye yon atik nan tèks orijinal la ? Ajoute l isit.'
            }
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">
              {isFr ? 'Corriger le parser' : 'Korije pasè a'}
            </span>
          </button>
        )}
        {isEditor && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 transition-colors"
            title={
              isFr
                ? 'Supprimer cet article du texte (parser-cleanup)'
                : 'Efase atik sa nan tèks la (netwaye pasè)'
            }
          >
            <Trash2 className="w-4 h-4" />
            <span className="font-medium">
              {isFr ? 'Supprimer' : 'Efase'}
            </span>
          </button>
        )}

        {/* Inline "Modifié par X — version en vigueur depuis le Y"
            line on the right of the pill row. Surfaces the current
            version's amending-law context next to the Versions /
            Comparer buttons — same pattern as Légifrance's per-
            article action strip. Renders only when the article
            embed carries source_amendment_title_fr; gracefully
            absent on v1 articles with no amendment history. */}
        {(sourceAmendmentTitleFr || sourceAmendmentTitleHt) && (
          <ModifiedByLine
            sourceAmendmentSlug={sourceAmendmentSlug ?? null}
            sourceAmendmentTitleFr={sourceAmendmentTitleFr ?? null}
            sourceAmendmentTitleHt={sourceAmendmentTitleHt ?? null}
            sourceAmendmentArticleNumber={
              sourceAmendmentArticleNumber ?? null
            }
            effectiveFrom={
              currentEffectiveFrom ?? lawPublicationDate ?? null
            }
            lang={currentLang}
          />
        )}
      </div>

      <AnimatePresence initial={false}>
        {openPanel === 'links' && (
          <motion.div
            key="links"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-5">
              {citationsLoading && !citationsLoaded ? (
                <PanelSpinner lang={currentLang} />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                  <CitationColumn
                    title={isFr ? 'Cite' : 'Site'}
                    subtitle={
                      isFr
                        ? 'Cet article fait référence à'
                        : 'Atik sa a refere ak'
                    }
                    entries={outboundEntries}
                    currentLang={currentLang}
                    direction="outbound"
                  />
                  <CitationColumn
                    title={isFr ? 'Citée par' : 'Site pa'}
                    subtitle={
                      isFr
                        ? 'Textes qui s’appuient sur cet article'
                        : 'Tèks ki baze sou atik sa a'
                    }
                    entries={inboundEntries}
                    currentLang={currentLang}
                    direction="inbound"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
        {openPanel === 'versions' && (
          <motion.div
            key="versions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {versionsLoading && !versionsLoaded ? (
                <PanelSpinner lang={currentLang} />
              ) : (
                <VersionsPanel
                  versions={versionEntries}
                  currentLang={currentLang}
                  defaultFromDate={lawPublicationDate ?? null}
                />
              )}
            </div>
          </motion.div>
        )}
        {openPanel === 'compare' && (
          <motion.div
            key="compare"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {versionsLoading && !versionsLoaded ? (
                <PanelSpinner lang={currentLang} />
              ) : versions.length >= 2 ? (
                <ComparePanel
                  versions={versions}
                  currentLang={currentLang}
                />
              ) : (
                <p className="text-xs italic text-slate-400 py-2">
                  {isFr
                    ? 'Au moins deux versions sont nécessaires pour comparer.'
                    : 'Pou konpare, ou bezwen omwen de vèsyon.'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor-only dialogs — gated behind ``isEditor`` so non-
          editor bundles can tree-shake them. Each call onArticleChanged
          on success so the parent can refetch the law and re-render
          the affected row(s). */}
      {isEditor && lawId != null && (
        <AddVersionDialog
          open={addVersionOpen}
          onOpenChange={setAddVersionOpen}
          articleId={articleId}
          articleNumber={articleNumber ?? ''}
          currentTextFr={currentTextFr ?? null}
          currentTextHt={currentTextHt ?? null}
          currentTitleFr={currentTitleFr ?? null}
          excludeLegalTextId={lawId}
          lang={currentLang}
          onCreated={() => {
            setAddVersionOpen(false)
            onArticleChanged?.()
          }}
        />
      )}
      {isEditor && lawId != null && (
        <AddArticleDialog
          open={addArticleOpen}
          onOpenChange={setAddArticleOpen}
          lawSlug={lawSlug}
          lawId={lawId}
          afterArticleId={articleId}
          afterArticleLabel={articleLabel}
          mode={addArticleMode}
          lang={currentLang}
          onCreated={() => {
            setAddArticleOpen(false)
            onArticleChanged?.()
          }}
        />
      )}
      {isEditor && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            if (!o && !deleting) setDeleteOpen(false)
          }}
          onConfirm={handleDelete}
          title={isFr ? 'Supprimer cet article ?' : 'Efase atik sa a?'}
          description={
            <>
              {isFr
                ? "L'article et toutes ses versions seront supprimés. Cette action est irréversible."
                : 'Atik la ak tout vèsyon li yo ap efase. Aksyon sa pa ka anile.'}
              <br />
              <br />
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {articleLabel}
              </span>
            </>
          }
          confirmLabel={isFr ? 'Supprimer' : 'Efase'}
          cancelLabel={isFr ? 'Annuler' : 'Anile'}
          destructive
          loading={deleting}
        />
      )}
    </div>
  )
}

/** Pill trigger — copied verbatim from ArticleViewer's
 *  ``AccordionTrigger`` so the list view and the focused viewer
 *  share the same visual vocabulary. */
function PillTrigger({
  icon: Icon,
  label,
  count,
  open,
  onClick,
  disabled,
  disabledTitle,
}: {
  icon: typeof Layers
  label: string
  count?: number
  open: boolean
  onClick: () => void
  disabled?: boolean
  disabledTitle?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      title={disabled ? disabledTitle : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all border',
        disabled
          ? 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed'
          : open
            ? 'bg-primary dark:bg-slate-700 text-white border-primary dark:border-slate-600'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary',
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            open ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300',
          )}
        >
          {count}
        </span>
      )}
      <ChevronRight
        className={cn(
          'w-3.5 h-3.5 transition-transform',
          open && 'rotate-90',
        )}
      />
    </button>
  )
}

function PanelSpinner({ lang }: { lang: 'fr' | 'ht' }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 py-3">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {lang === 'fr' ? 'Chargement…' : 'Chajman…'}
    </div>
  )
}

/** "Modifié par <law> art. N — version en vigueur depuis le <date>"
 *  line rendered on the right of the per-article action row. Pure
 *  presentation — the parent decides whether to render it based on
 *  whether the article actually has source-amendment metadata. */
function ModifiedByLine({
  sourceAmendmentSlug,
  sourceAmendmentTitleFr,
  sourceAmendmentTitleHt,
  sourceAmendmentArticleNumber,
  effectiveFrom,
  lang,
}: {
  sourceAmendmentSlug: string | null
  sourceAmendmentTitleFr: string | null
  sourceAmendmentTitleHt: string | null
  sourceAmendmentArticleNumber: string | null
  effectiveFrom: string | null
  lang: 'fr' | 'ht'
}) {
  const isFr = lang === 'fr'
  const title =
    (isFr
      ? sourceAmendmentTitleFr
      : sourceAmendmentTitleHt || sourceAmendmentTitleFr) ?? null
  if (!title) return null

  // Format yyyy-mm-dd → "19 juin 2012". Date-fns-free for the
  // smaller bundle: just Intl + a fallback to the raw string when
  // parsing fails (the editor occasionally enters non-ISO dates).
  let formattedDate: string | null = null
  if (effectiveFrom) {
    try {
      const d = new Date(effectiveFrom)
      if (!Number.isNaN(d.getTime())) {
        formattedDate = new Intl.DateTimeFormat(
          isFr ? 'fr-FR' : 'fr-FR',
          {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          },
        ).format(d)
      } else {
        formattedDate = effectiveFrom
      }
    } catch {
      formattedDate = effectiveFrom
    }
  }

  const href = sourceAmendmentSlug
    ? sourceAmendmentArticleNumber
      ? `/loi/${sourceAmendmentSlug}?view=article&article=${encodeURIComponent(sourceAmendmentArticleNumber)}`
      : `/loi/${sourceAmendmentSlug}`
    : null

  return (
    // Full width below ``lg`` so the long "Modifié par …" text drops
    // onto its OWN line beneath the Versions / Comparer pills instead
    // of crowding them (the truncated text used to sit shrunk on the
    // same flex line through tablet widths). Only at ``lg`` — where
    // there's real room — does it go inline right via ``ml-auto``.
    <div className="w-full lg:w-auto lg:ml-auto text-left lg:text-right lg:max-w-md min-w-0 flex flex-col items-start lg:items-end gap-1">
      {formattedDate && (
        // Status pill — mirrors the VersionsPanel green "Version en
        // vigueur depuis le X" chip so the in-force date reads as a
        // status, not a footnote.
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
          {isFr
            ? `En vigueur depuis le ${formattedDate}`
            : `An vigè depi ${formattedDate}`}
        </span>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-full">
        {isFr ? 'Modifié par' : 'Modifye pa'}{' '}
        {href ? (
          <a
            href={href}
            className="text-primary hover:underline font-medium"
          >
            {title}
            {sourceAmendmentArticleNumber
              ? isFr
                ? ` — art. ${sourceAmendmentArticleNumber}`
                : ` — atik ${sourceAmendmentArticleNumber}`
              : ''}
          </a>
        ) : (
          <span className="font-medium text-slate-700 dark:text-slate-300">{title}</span>
        )}
      </p>
    </div>
  )
}
