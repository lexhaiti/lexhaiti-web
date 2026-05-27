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
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast-simple'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  citationsFromArticle,
  citationsToArticle,
  deleteArticle,
  listArticleVersions,
  resolveArticles,
  type ArticleResolved,
  type ArticleVersionRead,
} from '@/lib/api/endpoints'
import {
  mapCitations,
  type CitationEntry,
  type CitationRow,
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
}

export function ArticleAccordions({
  articleId,
  versionNumber,
  articleNumber,
  currentTextFr,
  currentTextHt,
  currentTitleFr,
  lawId,
  lawSlug,
  siblingArticles,
  isEditor = false,
  currentLang,
  onArticleChanged,
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
  const [citationsLoaded, setCitationsLoaded] = useState(false)
  const [citationsLoading, setCitationsLoading] = useState(false)
  const [outgoing, setOutgoing] = useState<CitationRow[]>([])
  const [incoming, setIncoming] = useState<CitationRow[]>([])

  const articleById = useMemo(() => {
    const m = new Map<number, SiblingArticle>()
    for (const s of siblingArticles ?? []) m.set(s.id, s)
    return m
  }, [siblingArticles])

  const [resolvedById, setResolvedById] = useState<
    Map<number, ArticleResolved>
  >(() => new Map())

  // Trigger citation fetch when Textes-liés opens for the first
  // time, OR immediately in editor mode so the chip count is honest
  // about "0 citations" right from initial render.
  useEffect(() => {
    const needLoad =
      !citationsLoaded &&
      !citationsLoading &&
      (openPanel === 'links' || isEditor)
    if (!needLoad) return
    setCitationsLoading(true)
    void Promise.all([
      citationsFromArticle(articleId),
      citationsToArticle(articleId),
    ])
      .then(([out, inc]) => {
        setOutgoing(out.items ?? [])
        setIncoming(inc.items ?? [])
        setCitationsLoaded(true)
      })
      .catch(() => {
        // Non-essential; render an empty panel rather than crash.
        setOutgoing([])
        setIncoming([])
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

  // Resolver fan-out for cross-text article cites (so the column
  // can render "Code Civil — Art. 1382" rather than "Article #1234").
  useEffect(() => {
    if (!citationsLoaded) return
    const unknown: number[] = []
    for (const c of outgoing) {
      if (c.target_node_type === 'article' && !articleById.has(c.target_node_id)) {
        unknown.push(c.target_node_id)
      }
    }
    for (const c of incoming) {
      if (c.source_node_type === 'article' && !articleById.has(c.source_node_id)) {
        unknown.push(c.source_node_id)
      }
    }
    const unique = Array.from(new Set(unknown))
    if (unique.length === 0) return
    let cancelled = false
    void resolveArticles(unique)
      .then((rows) => {
        if (cancelled) return
        const m = new Map<number, ArticleResolved>()
        for (const r of rows) m.set(r.id, r)
        setResolvedById(m)
      })
      .catch(() => {
        /* fall back to "Article #id" */
      })
    return () => {
      cancelled = true
    }
  }, [citationsLoaded, outgoing, incoming, articleById])

  const outboundEntries = useMemo<CitationEntry[]>(
    () =>
      mapCitations(outgoing, 'outbound', articleById, lawSlug, resolvedById),
    [outgoing, articleById, lawSlug, resolvedById],
  )
  const inboundEntries = useMemo<CitationEntry[]>(
    () =>
      mapCitations(incoming, 'inbound', articleById, lawSlug, resolvedById),
    [incoming, articleById, lawSlug, resolvedById],
  )
  const totalCitations = outboundEntries.length + inboundEntries.length

  // ────────────────────────────────────────────────────────────────
  // Versions — lazy, shared between Versions + Comparer panels
  // ────────────────────────────────────────────────────────────────
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versions, setVersions] = useState<ArticleVersionRead[]>([])

  // Trigger when Versions or Comparer opens, OR in editor mode at
  // mount (mirrors the focused viewer).
  useEffect(() => {
    const hasHistory = (versionNumber ?? 1) > 1
    const wantsNow =
      openPanel === 'versions' || openPanel === 'compare' || isEditor
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
    <div className="mt-5 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2 flex-wrap">
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
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-white text-slate-700 border border-slate-200 hover:border-slate-400 hover:text-slate-900 transition-colors"
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
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-white text-red-700 border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
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
              <span className="font-semibold text-slate-900">
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
          ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
          : open
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-slate-700 border-gray-200 hover:border-primary hover:text-primary',
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            open ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
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
    <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      {lang === 'fr' ? 'Chargement…' : 'Chajman…'}
    </div>
  )
}
