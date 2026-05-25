'use client'

import React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, PanelLeft, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
  visasRef,
  considerantsRef,
  setPreambleExpanded,
  setVisasExpanded,
  setConsiderantsExpanded,
  onArticleSelect,
  onAddHeading,
  refetch,
}: TocSidebarProps) {
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
    hasVisas: !!law.visas_fr,
    hasConsiderants: !!law.considerants_fr,
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
                  onVisasClick={() => {
                    setVisasExpanded(true)
                    setIsSidebarOpen(false)
                    setTimeout(() => {
                      visasRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }, 100)
                  }}
                  onConsiderantsClick={() => {
                    setConsiderantsExpanded(true)
                    setIsSidebarOpen(false)
                    setTimeout(() => {
                      considerantsRef.current?.scrollIntoView({
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

      {/* Desktop Sidebar Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="hidden lg:flex fixed bottom-6 right-6 z-40 shadow-lg bg-white border-gray-200 rounded-full w-12 h-12 p-0"
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="w-5 h-5" />
        ) : (
          <PanelLeft className="w-5 h-5" />
        )}
      </Button>

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
                onPreambleClick={() => {
                  setPreambleExpanded(true)
                  setTimeout(() => {
                    preambleRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }, 100)
                }}
                onVisasClick={() => {
                  setVisasExpanded(true)
                  setTimeout(() => {
                    visasRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  }, 100)
                }}
                onConsiderantsClick={() => {
                  setConsiderantsExpanded(true)
                  setTimeout(() => {
                    considerantsRef.current?.scrollIntoView({
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
