'use client'

import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Maximize2, Minimize2, PanelLeft, PanelLeftClose, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReaderChrome } from '@/components/layout/ReaderChromeContext'
import { useFooterAvoidance } from '@/lib/hooks/useFooterAvoidance'
import TableOfContents, {
  type TableOfContentsHandle,
} from '@/components/law-details/TableOfContent'
import {
  deleteHeading,
  reorderArticles,
  reorderHeadings,
  updateHeading,
  updateHeadingTitle,
} from '@/lib/api/endpoints'
import type { HeadingAnchor, HeadingAnchorRow } from './_helpers/lawDetailTypes'

interface TocSidebarProps {
  law: any
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  selectedArticle: any
  pageSearchScope: 'sommaire' | 'code'
  pageSearchQuery: string
  articleBreadcrumb: any[]
  preambleRef: React.RefObject<HTMLDivElement | null>
  visasRef: React.RefObject<HTMLDivElement | null>
  /** Controlled expand of the Préambule / Partie introductive body
   *  blocks. The sommaire entries mirror these (chevron) and clicking a
   *  row toggles open/close — body and sommaire stay in lockstep. */
  preambleExpanded: boolean
  setPreambleExpanded: (expanded: boolean) => void
  introExpanded: boolean
  setIntroExpanded: (expanded: boolean) => void
  onArticleSelect: (article: any) => void
  /** Fired when a heading row is clicked in the sommaire — the parent
   *  jumps the body to that chapter and opens it. */
  onHeadingNavigate?: (heading: any) => void
  onAddHeading: (anchor: HeadingAnchor) => void
  refetch: () => void
}

/**
 * Table of Contents sidebar -- renders both the mobile accordion
 * and desktop sticky sidebar, plus the floating desktop toggle button.
 * Encapsulates all the TOC callback wiring.
 */
export function TocSidebar({
  law,
  currentLang,
  isEditor,
  isSidebarOpen,
  setIsSidebarOpen,
  selectedArticle,
  pageSearchScope,
  pageSearchQuery,
  articleBreadcrumb,
  preambleRef,
  // visasRef doubles as the scroll anchor for the combined
  // "Partie introductive" block.
  visasRef,
  preambleExpanded,
  setPreambleExpanded,
  introExpanded,
  setIntroExpanded,
  onArticleSelect,
  onHeadingNavigate,
  onAddHeading,
  refetch,
}: TocSidebarProps) {
  // The reader flips ``stickyActive`` on once it scrolls into the law
  // body; here it only drives the floating « Sommaire » toggle below
  // (shown once the in-flow Sommaire pill has scrolled away).
  const { stickyActive } = useReaderChrome()
  // Lifts the floating toggle above the footer instead of overlapping.
  const sommaireFooterRef = useFooterAvoidance<HTMLButtonElement>()
  // Mobile drawer's TableOfContents — we reach its expandAll /
  // collapseAll via this ref so the drawer header buttons (rendered
  // outside the component) can drive the same state.
  const mobileTocRef = useRef<TableOfContentsHandle>(null)

  // Body scroll lock while the mobile drawer is open. Without it the
  // page underneath scrolls when the user drags inside the drawer
  // (typical mobile webview behaviour), which makes finding entries
  // feel unsteady. The lock is mobile-only — desktop sidebar is
  // inline and the body should keep scrolling.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!isSidebarOpen) return
    // Skip on lg+ — desktop sidebar is in-flow, not an overlay.
    if (window.matchMedia?.('(min-width: 1024px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isSidebarOpen])

  // Shared TOC props
  const tocProps = {
    articles: law.articles,
    headings: law.headings,
    currentLang,
    // Drives heading-label overrides (e.g. « Loi » instead of
    // « Livre » when the code is the Code civil d'Haïti).
    codeSubcategory: law.code_subcategory ?? null,
    selectedArticle: selectedArticle?.number,
    externalQuery: pageSearchScope === 'sommaire' ? pageSearchQuery : '',
    hasPreamble: !!law.preamble_fr,
    // Sommaire-entry chevrons mirror the body blocks' open/closed state.
    preambleExpanded,
    introExpanded,
    // Single "Partie introductive" entry — true when the text has any
    // introductory content (the combined intro_fr/ht field).
    hasIntro: !!((law as any).intro_fr || (law as any).intro_ht),
    isEditor,
    activeHeadingIds: articleBreadcrumb.map((h: any) => h.id),
    onHeadingTitleSave: async (id: number, field: string, next: string) => {
      if (field === 'number') {
        await updateHeading(id, { number: next.trim() || null })
      } else {
        await updateHeadingTitle(id, { [field]: next })
      }
      refetch()
    },
    onHeadingDelete: async (id: number, reparentChildren: boolean) => {
      await deleteHeading(id, { reparentChildren })
      refetch()
    },
    onAddSiblingHeading: (after: HeadingAnchorRow) =>
      onAddHeading({ kind: 'after', heading: after }),
    onAddRootHeading: () =>
      onAddHeading({ kind: 'root' }),
    onReorderHeadings: async (parentId: number | null, order: number[]) => {
      await reorderHeadings(law.slug, { parent_id: parentId, order })
      refetch()
    },
    onReorderArticles: async (headingId: number | null, order: number[]) => {
      await reorderArticles(law.slug, { heading_id: headingId, order })
      refetch()
    },
  }

  return (
    <>
      {/* Mobile slide-in drawer — replaces the previous inline
          accordion. On mobile the sommaire opens as a left-edge
          drawer pinned under the global header (top-20 = h-20)
          with a backdrop that dims the page. Same ``isSidebarOpen``
          state powers it as the desktop sidebar; entry points are
          (a) the inline "Sommaire" pill in SearchPanel's mobile row
          and (b) the floating button below that becomes visible
          once the reader scrolls into the body. */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.button
              type="button"
              aria-label={currentLang === 'fr' ? 'Fermer le sommaire' : 'Fèmen somè a'}
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 top-20 z-40 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={currentLang === 'fr' ? 'Sommaire' : 'Somè'}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className={cn(
                'lg:hidden fixed inset-x-0 z-50 flex flex-col',
                // Sits below the global h-20 header so the user can
                // still see where they are. Full viewport width on
                // mobile (per user request) — the sommaire is
                // information-dense and benefits from the extra
                // horizontal room for nested heading labels.
                'top-20 bottom-0',
                'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800',
                'shadow-2xl',
              )}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-red-50 dark:bg-red-950/40 rounded-md">
                    <PanelLeft className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <span className="font-bold uppercase tracking-widest text-xs text-slate-700 dark:text-slate-300">
                    {currentLang === 'fr' ? 'Sommaire' : 'Somè'}
                  </span>
                </div>
                {/* Tout-ouvrir / Tout-fermer next to X — drive the
                    TableOfContents' state via the ref handle. */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mobileTocRef.current?.expandAll()}
                    aria-label={
                      currentLang === 'fr' ? 'Tout ouvrir' : 'Ouvri tout'
                    }
                    title={
                      currentLang === 'fr' ? 'Tout ouvrir' : 'Ouvri tout'
                    }
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mobileTocRef.current?.collapseAll()}
                    aria-label={
                      currentLang === 'fr' ? 'Tout fermer' : 'Fèmen tout'
                    }
                    title={
                      currentLang === 'fr' ? 'Tout fermer' : 'Fèmen tout'
                    }
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label={currentLang === 'fr' ? 'Fermer' : 'Fèmen'}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                <TableOfContents
                  ref={mobileTocRef}
                  hideInternalHeader
                  {...tocProps}
                  onArticleSelect={(article: any) => {
                    onArticleSelect(article)
                    setIsSidebarOpen(false)
                  }}
                  onHeadingNavigate={
                    onHeadingNavigate
                      ? (h: any) => {
                          onHeadingNavigate(h)
                          setIsSidebarOpen(false)
                        }
                      : undefined
                  }
                  onPreambleClick={() => {
                    const willOpen = !preambleExpanded
                    setPreambleExpanded(willOpen)
                    setIsSidebarOpen(false)
                    if (willOpen) {
                      setTimeout(() => {
                        preambleRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }, 100)
                    }
                  }}
                  onIntroClick={() => {
                    const willOpen = !introExpanded
                    setIntroExpanded(willOpen)
                    setIsSidebarOpen(false)
                    if (willOpen) {
                      setTimeout(() => {
                        visasRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }, 100)
                    }
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Sommaire toggle (desktop) — appears once the reader
          scrolls into the body (``stickyActive``), so the sommaire stays
          one tap away after the in-flow "Sommaire" pill has scrolled
          off. It sits *above* the global back-to-top button (which pins
          to bottom-6/8); the bottom-20/24 offset keeps them from
          colliding. White so it reads as a distinct control, not a
          second navy action. */}
      <button
        ref={sommaireFooterRef}
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-pressed={isSidebarOpen}
        aria-label={
          currentLang === 'fr'
            ? isSidebarOpen
              ? 'Masquer le sommaire'
              : 'Afficher le sommaire'
            : isSidebarOpen
              ? 'Kache somè a'
              : 'Montre somè a'
        }
        title={currentLang === 'fr' ? 'Sommaire' : 'Somè'}
        tabIndex={stickyActive ? 0 : -1}
        className={cn(
          'inline-flex items-center justify-center',
          // Right edge, immediately to the LEFT of ScrollToTop.
          // Both are circular icon-only chips of the same size —
          // they read as a paired set in the bottom-right corner.
          // The labeled "Voir le sommaire" affordance lives in the
          // DocumentToolbar's inline row above; the FAB is the
          // discreet shortcut for scrolled readers.
          'fixed z-40 right-20 sm:right-24',
          'bottom-6 sm:bottom-8',
          'h-12 w-12 lg:h-11 lg:w-11 rounded-full',
          'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-lg',
          'hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2',
          'transition-opacity duration-200',
          stickyActive
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        )}
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="w-5 h-5" aria-hidden />
        ) : (
          <PanelLeft className="w-5 h-5" aria-hidden />
        )}
      </button>

      {/* Desktop Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={
              "hidden lg:block lg:flex-shrink-0 lg:w-[25%] lg:bg-slate-50/70 dark:lg:bg-slate-900/70 lg:border-r lg:border-gray-200 dark:lg:border-slate-800 lg:pr-6 lg:py-8 lg:relative lg:before:content-[''] lg:before:absolute lg:before:inset-y-0 lg:before:right-full lg:before:w-screen lg:before:bg-slate-50/70 dark:lg:before:bg-slate-900/70 lg:before:pointer-events-none"
            }
          >
            <div className="lg:sticky lg:top-24 h-[calc(100vh-12rem)]">
              <TableOfContents
                {...tocProps}
                onArticleSelect={onArticleSelect}
                onHeadingNavigate={onHeadingNavigate}
                onPreambleClick={() => {
                  const willOpen = !preambleExpanded
                  setPreambleExpanded(willOpen)
                  if (willOpen) {
                    setTimeout(() => {
                      preambleRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }, 100)
                  }
                }}
                onIntroClick={() => {
                  const willOpen = !introExpanded
                  setIntroExpanded(willOpen)
                  if (willOpen) {
                    setTimeout(() => {
                      visasRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }, 100)
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
