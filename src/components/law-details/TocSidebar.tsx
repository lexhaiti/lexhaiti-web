'use client'

import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, PanelLeft, PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReaderChrome } from '@/components/layout/ReaderChromeContext'
import { useFooterAvoidance } from '@/lib/hooks/useFooterAvoidance'
import TableOfContents from '@/components/law-details/TableOfContent'
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
  considerantsRef: React.RefObject<HTMLDivElement | null>
  setPreambleExpanded: (expanded: boolean) => void
  setVisasExpanded: (expanded: boolean) => void
  setConsiderantsExpanded: (expanded: boolean) => void
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
  setPreambleExpanded,
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
    // Single "Partie introductive" entry — true when the text has any
    // introductory content (the combined intro_fr field, or the legacy
    // flat columns as a fallback).
    hasIntro: !!(
      (law as any).intro_fr ||
      (law as any).intro_ht ||
      law.visas_fr ||
      law.considerants_fr ||
      law.enacting_formula_fr
    ),
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
      {/* Mobile Accordion */}
      <div className="block lg:hidden w-full mt-6 lg:mt-0 mb-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <PanelLeft className="w-5 h-5 text-red-600" />
            </div>
            <span className="font-bold uppercase tracking-widest text-xs text-slate-700">
              {currentLang === 'fr' ? 'Sommaire' : 'Somè'}
            </span>
          </div>
          <ChevronRight
            className={cn(
              'w-5 h-5 text-gray-400 transition-transform duration-300',
              isSidebarOpen && 'rotate-90',
            )}
          />
        </button>

        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[60vh]">
                <TableOfContents
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
                    setPreambleExpanded(true)
                    setIsSidebarOpen(false)
                    setTimeout(() => {
                      preambleRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }, 100)
                  }}
                  onIntroClick={() => {
                    setIsSidebarOpen(false)
                    setTimeout(() => {
                      visasRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }, 100)
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
          'hidden lg:inline-flex items-center justify-center',
          'fixed z-40 right-6 sm:right-8 bottom-20 sm:bottom-24',
          'h-11 w-11 rounded-full',
          'bg-white text-slate-700 border border-slate-200 shadow-lg',
          'hover:border-primary hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2',
          // Only opacity transitions — the footer-avoidance transform is
          // applied imperatively and must track scroll instantly.
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
              "hidden lg:block lg:flex-shrink-0 lg:w-[25%] lg:bg-slate-50/70 lg:border-r lg:border-gray-200 lg:pr-6 lg:py-8 lg:relative lg:before:content-[''] lg:before:absolute lg:before:inset-y-0 lg:before:right-full lg:before:w-screen lg:before:bg-slate-50/70 lg:before:pointer-events-none"
            }
          >
            <div className="lg:sticky lg:top-24 h-[calc(100vh-12rem)]">
              <TableOfContents
                {...tocProps}
                onArticleSelect={onArticleSelect}
                onHeadingNavigate={onHeadingNavigate}
                onPreambleClick={() => {
                  setPreambleExpanded(true)
                  setTimeout(() => {
                    preambleRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }, 100)
                }}
                onIntroClick={() => {
                  setTimeout(() => {
                    visasRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }, 100)
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
