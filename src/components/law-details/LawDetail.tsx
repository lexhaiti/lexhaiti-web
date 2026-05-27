'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation'
import { EditorBar } from './EditorBar'
import { SignataireBlock } from '@/components/law-details/SignataireBlock'
import { ChangesMadePanel } from '@/components/law-details/_panels/ChangesMadePanel'
import { AddHeadingDialog } from '@/components/law-details/_panels/AddHeadingDialog'
import { AddArticleDialog } from '@/components/law-details/_panels/AddArticleDialog'
import { DeviseEditorDialog } from './_panels/DeviseEditorDialog'
import { useLawDetail } from '@/lib/hooks/useLawDetail'
import { getLevelLabel } from '@/lib/legal/headingLabels'
import { useLanguage } from '@/i18n/LanguageContext'
import { useT } from '@/i18n/useT'
import { TextNotFound } from '@/components/law-details/TextNotFound'
import { useToast } from '@/components/ui/toast-simple'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import type { ArticleEmbed } from '@/lib/api/endpoints'
import { categoryLabels } from './_helpers/categoryLabels'
import {
  pickBilingual,
  type HeadingAnchor,
  type SelectedArticle,
} from './_helpers/lawDetailTypes'

// Sub-components extracted from this file
import { DocumentToolbar } from './DocumentToolbar'
import { EditorPreviewBanner } from './EditorPreviewBanner'
import { LawHero } from './LawHero'
import { TocSidebar } from './TocSidebar'
import { SearchPanel } from './SearchPanel'
import { FormalBlocksSection } from './FormalBlocksSection'
import { ArticleSection } from './ArticleSection'
import { ArticleListView } from './ArticleListView'
import { ViewModeSwitcher } from './ViewModeSwitcher'
import { ClosingAddendum } from './ClosingAddendum'
import { RelatedLaws } from './RelatedLaws'

// View-mode plumbing — shape detection + persisted mode state.
import { detectShape, availableViewModes } from '@/lib/legal/shape'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useHeadingCollapse } from '@/lib/hooks/useHeadingCollapse'
import { lawShortCite } from '@/lib/legal/cite'


export default function LawDetail() {
  const { language, setLanguage } = useLanguage()
  const { t } = useT()
  const { toast } = useToast()
  const currentLang = language as 'fr' | 'ht'

  // ``?lang=ht`` (or ``?lang=fr``) on the URL is a one-shot "open this
  // page in that language" hint.
  const langParam = useSearchParams()?.get('lang')
  useEffect(() => {
    if (langParam === 'ht' && language !== 'ht') setLanguage('ht')
    else if (langParam === 'fr' && language !== 'fr') setLanguage('fr')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langParam])

  const [selectedArticle, setSelectedArticle] =
    useState<SelectedArticle | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // Hide articles whose status === 'abrogated'. Controlled by the
  // DocumentToolbar above the article list.
  const [hideAbrogated, setHideAbrogated] = useState(false)
  const [addHeadingAnchor, setAddHeadingAnchor] = useState<
    HeadingAnchor | null
  >(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pageSearchScope, setPageSearchScope] = useState<'sommaire' | 'code'>(
    'sommaire',
  )
  const [pageSearchQuery, setPageSearchQuery] = useState('')

  const params = useParams()
  const slug = params?.slug as string
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const { isEditor: actuallyIsEditor, user: editorUser } = useEditorMode()
  const isPublicPreview = searchParams?.get('view') === 'public'
  const isEditor = actuallyIsEditor && !isPublicPreview
  const { data: law, isLoading, isError, refetch } = useLawDetail(slug)

  // Find current article index
  const currentArticleIndex = useMemo(() => {
    if (!selectedArticle || !law?.articles) return -1
    return law.articles.findIndex(
      (a) => a.number === selectedArticle.number,
    )
  }, [selectedArticle, law?.articles])

  // Article counts for the hero "Contenu" stat.
  const hasArticles = !!law?.articles && law.articles.length > 0
  const isDocumentMode =
    (law?.display_mode ?? 'articles') === 'document'
  const showStructuralUi = (hasArticles || isEditor) && !isDocumentMode
  const [emptyAddArticleOpen, setEmptyAddArticleOpen] = useState(false)
  const [deviseEditorOpen, setDeviseEditorOpen] = useState(false)

  // ────────────────────────────────────────────────────────────────
  // View-mode plumbing
  //
  // Shape detection runs every time the law data changes; from the
  // shape we know which view-mode buttons make sense (tous /
  // chapitre / article). The hook resolves the active mode from URL
  // > localStorage > smart default.
  // ────────────────────────────────────────────────────────────────
  const shape = useMemo(
    () =>
      detectShape({
        displayMode: law?.display_mode,
        articleCount: law?.articles?.length ?? 0,
        headingCount: law?.headings?.length ?? 0,
      }),
    [law?.display_mode, law?.articles?.length, law?.headings?.length],
  )
  const hasChapters = (law?.headings?.length ?? 0) > 0
  const availableModes = useMemo(
    () => availableViewModes(shape, hasChapters),
    [shape, hasChapters],
  )
  const hasArticleDeepLink = !!searchParams?.get('article')
  const [viewMode, setViewMode] = useViewMode({
    available: availableModes,
    hasDeepLink: hasArticleDeepLink,
  })

  // Shared heading-collapse state — DocumentToolbar's Tout fermer
  // / Tout ouvrir buttons and ArticleListView's per-row chevrons
  // both read + write the same Set through this hook.
  const headingCollapse = useHeadingCollapse(law?.headings ?? [])

  const articleCounts = useMemo(() => {
    if (!law?.articles || law.articles.length === 0) {
      return {
        total: 0,
        topLevel: 0,
        highestNumber: 0,
        abrogated: 0,
        rawCount: 0,
        wholeTextAbrogated: false,
      }
    }
    const seenTopLevel = new Set<string>()
    let highest = 0
    let abrogated = 0
    for (const a of law.articles) {
      const num = String(a.number ?? '').trim().toLowerCase()
      if (/^(premier|\d+)$/.test(num)) seenTopLevel.add(num)
      const m = num.match(/^(\d+)/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > highest) highest = n
      }
      if (a.status === 'abrogated') abrogated += 1
    }
    const wholeTextAbrogated =
      law.status === 'abrogated' || abrogated === law.articles.length
    return {
      total: wholeTextAbrogated
        ? law.articles.length
        : law.articles.length - abrogated,
      topLevel: seenTopLevel.size,
      highestNumber: highest,
      abrogated,
      rawCount: law.articles.length,
      wholeTextAbrogated,
    }
  }, [law?.articles, law?.status])

  // Heading id -> row lookup
  const headingsById = useMemo(() => {
    const headings = law?.headings ?? []
    return new Map<number, (typeof headings)[number]>(
      headings.map((h) => [h.id, h]),
    )
  }, [law?.headings])

  // Walk the heading tree from the selected article up to the root.
  const articleBreadcrumb = useMemo(() => {
    if (!selectedArticle?.heading_id || !law?.headings) return []
    const path: typeof law.headings = []
    let current: (typeof law.headings)[number] | undefined = headingsById.get(
      selectedArticle.heading_id,
    )
    let safety = 10
    while (current && safety-- > 0) {
      path.unshift(current)
      current = current.parent_id ? headingsById.get(current.parent_id) : undefined
    }
    return path
  }, [selectedArticle, law?.headings, headingsById])

  // Bloc-style nav hints
  const blocHints = useMemo(() => {
    if (!law?.articles || !law?.headings || currentArticleIndex < 0) {
      return { prev: null as string | null, next: null as string | null }
    }
    const currentHeadingId = selectedArticle?.heading_id ?? null
    const codeSubcategory = law.code_subcategory ?? null

    const hint = (article: ArticleEmbed | undefined): string | null => {
      if (!article) return null
      const numStr = String(article.number ?? '')
      const numLabel = numStr.toLowerCase().startsWith('article')
        ? numStr
        : currentLang === 'ht'
          ? `Atik ${
              numStr === 'premier'
                ? '1'
                : numStr.startsWith('premier-')
                  ? `1-${numStr.slice('premier-'.length)}`
                  : numStr
            }`
          : `Art. ${numStr}`
      const crosses = article.heading_id !== currentHeadingId
      if (!crosses || !article.heading_id) return numLabel
      const h = headingsById.get(article.heading_id)
      if (!h) return numLabel
      const lvlLabel =
        getLevelLabel(h.level, currentLang, codeSubcategory) ?? h.level
      return `${numLabel} · ${lvlLabel} ${h.number ?? ''}`.trim()
    }

    return {
      prev: hint(law.articles[currentArticleIndex - 1]),
      next: hint(law.articles[currentArticleIndex + 1]),
    }
  }, [law?.articles, law?.headings, law?.code_subcategory, currentArticleIndex, selectedArticle?.heading_id, currentLang, headingsById])

  // Auto-select an article whenever the ``?article=N`` URL param
  // changes (initial load, deep-link from search, or in-page Link
  // navigation like the list-view "Vue article unique" row). The
  // earlier version short-circuited once any article was selected
  // — that left clicks from inside the same page stuck on the
  // previous article. Now: URL drives selection; absence of the
  // param falls back to the first article only on the very first
  // mount.
  const requestedArticleParam = searchParams?.get('article') ?? null
  useEffect(() => {
    if (!law?.articles || law.articles.length === 0) return
    if (requestedArticleParam) {
      const target = law.articles.find(
        (a) => String(a.number) === requestedArticleParam,
      )
      if (target && target.id !== selectedArticle?.id) {
        setSelectedArticle(target)
      }
      return
    }
    // No ?article= in the URL — keep the existing selection if we
    // already have one (toggling between Tous / Par chapitre modes
    // strips the param but shouldn't reset the article).
    if (!selectedArticle) {
      setSelectedArticle(law.articles[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [law?.articles, requestedArticleParam])

  // When the URL drives a navigation TO focused-article mode, scroll
  // the article into the middle of the viewport so the reader doesn't
  // have to hunt for it. Only fires when ``view=article`` is the
  // active mode (otherwise the list-view shows everything inline
  // and a scroll-jump would feel jarring).
  useEffect(() => {
    if (!requestedArticleParam) return
    if (searchParams?.get('view') !== 'article') return
    // Defer to next paint so the focused viewer has a chance to
    // render before we measure + scroll.
    const id = window.setTimeout(() => {
      articleViewerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 50)
    return () => window.clearTimeout(id)
  }, [requestedArticleParam, searchParams])

  // Re-bind selectedArticle to the freshest copy whenever law.articles changes.
  useEffect(() => {
    if (!selectedArticle || !law?.articles) return
    const fresh = law.articles.find(
      (a: any) => a.id === selectedArticle.id,
    ) ??
      law.articles.find((a: any) => a.number === selectedArticle.number)
    if (fresh && fresh !== selectedArticle) {
      setSelectedArticle(fresh)
    }
  }, [law?.articles, selectedArticle])

  // Default sidebar state — recomputed on EVERY view-mode change.
  // Tous / Par chapitre always start with the sommaire hidden so
  // the article cards get the full width; Un article opens it on
  // desktop so the reader can navigate from the TOC. Mobile always
  // starts collapsed (the sidebar is an in-page accordion there).
  // The user can still manually open / close the sommaire within
  // a mode — the auto-default only kicks in when the mode itself
  // changes.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isMobile = window.innerWidth < 1024
    if (isMobile) {
      setIsSidebarOpen(false)
      return
    }
    setIsSidebarOpen(viewMode === 'article')
  }, [viewMode])

  const handleSidebarToggle = (open: boolean) => {
    setIsSidebarOpen(open)
  }

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const articleViewerRef = React.useRef<HTMLDivElement>(null)
  const preambleRef = React.useRef<HTMLDivElement>(null)
  const visasRef = React.useRef<HTMLDivElement>(null)
  const considerantsRef = React.useRef<HTMLDivElement>(null)
  const [preambleExpanded, setPreambleExpanded] = useState(false)
  const [visasExpanded, setVisasExpanded] = useState(false)
  const [considerantsExpanded, setConsiderantsExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-red-600" />
      </div>
    )
  }

  if (isError || !law) {
    return <TextNotFound />
  }

  const title =
    currentLang === 'ht' && law.title_ht ? law.title_ht : law.title_fr
  const officialTitleStored =
    currentLang === 'ht'
      ? (law.official_title_ht ?? null)
      : (law.official_title_fr ?? null)
  const description =
    currentLang === 'ht' && law.description_ht
      ? law.description_ht
      : law.description_fr
  const category = categoryLabels[law.category] || categoryLabels.loi

  const preambleDisplay = pickBilingual(law.preamble_fr, law.preamble_ht, currentLang)
  const visasDisplay = pickBilingual(law.visas_fr, law.visas_ht, currentLang)
  const considerantsDisplay = pickBilingual(
    law.considerants_fr,
    law.considerants_ht,
    currentLang,
  )
  const mentionsProceduralesDisplay = pickBilingual(
    (law as any).mentions_procedurales_fr,
    (law as any).mentions_procedurales_ht,
    currentLang,
  )
  const enactingDisplay = pickBilingual(
    law.enacting_formula_fr,
    law.enacting_formula_ht,
    currentLang,
  )

  const handleArticleSelect = (article: any) => {
    setSelectedArticle(article)
    // Update ``?article=N`` so the state is shareable + a refresh
    // lands the reader on the same article.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('article', String(article.number))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // Pick the scroll target based on which renderer is active:
    //   - Un article mode → focused viewer (the bespoke chrome
    //     rendered by ArticleSection).
    //   - Tous / Par chapitre → the inline article card with
    //     id="article-${number}" rendered by ArticleListView.
    //   - Document shape (flat short decree) → inline card too.
    setTimeout(() => {
      const inlineCard =
        shape !== 'switchable' || viewMode !== 'article'
          ? document.getElementById(`article-${article.number}`)
          : null
      if (inlineCard) {
        inlineCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        articleViewerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }
    }, 100)
  }

  const handlePrevious = () => {
    if (law.articles && currentArticleIndex > 0) {
      setSelectedArticle(law.articles[currentArticleIndex - 1])
    }
  }

  const handleNext = () => {
    if (law.articles && currentArticleIndex < law.articles.length - 1) {
      setSelectedArticle(law.articles[currentArticleIndex + 1])
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: description ?? undefined,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast(t('lawDetail.actions.linkCopied'))
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast(t('lawDetail.actions.linkCopied'))
  }

  const relatedLaws: any[] = []

  return (
    <TooltipProvider delayDuration={150}>
    <div
      className={`min-h-screen bg-white ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}
    >
      {actuallyIsEditor && (
        <EditorPreviewBanner
          isPublicPreview={isPublicPreview}
          currentLang={currentLang}
          searchParams={searchParams}
        />
      )}

      <LawHero
        law={law}
        slug={slug}
        title={title}
        description={description}
        category={category}
        currentLang={currentLang}
        language={language}
        isEditor={isEditor}
        isDocumentMode={isDocumentMode}
        articleCounts={articleCounts}
        refetch={refetch}
      />

      {/* Main Content */}
      <div className="relative container pt-0">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {showStructuralUi && (
            <TocSidebar
              law={law}
              currentLang={currentLang}
              isEditor={isEditor}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={handleSidebarToggle}
              selectedArticle={selectedArticle}
              pageSearchScope={pageSearchScope}
              pageSearchQuery={pageSearchQuery}
              articleBreadcrumb={articleBreadcrumb}
              preambleRef={preambleRef}
              visasRef={visasRef}
              considerantsRef={considerantsRef}
              setPreambleExpanded={setPreambleExpanded}
              setVisasExpanded={setVisasExpanded}
              setConsiderantsExpanded={setConsiderantsExpanded}
              onArticleSelect={handleArticleSelect}
              onAddHeading={setAddHeadingAnchor}
              refetch={refetch}
            />
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 pb-12 sm:pb-16 lg:py-8">
            {showStructuralUi && (
              <SearchPanel
                currentLang={currentLang}
                pageSearchScope={pageSearchScope}
                pageSearchQuery={pageSearchQuery}
                onScopeChange={setPageSearchScope}
                onQueryChange={setPageSearchQuery}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => handleSidebarToggle(!isSidebarOpen)}
                rightControls={
                  // Switcher renders for any shape that gives the
                  // user a real choice — switchable (chaptered) and
                  // also document (flat short decree, where it
                  // collapses to Tous + Un article so "Vue article
                  // unique" can actually swap layouts).
                  shape !== 'richtext' &&
                  hasArticles &&
                  availableModes.length > 1 ? (
                    <ViewModeSwitcher
                      mode={viewMode}
                      available={availableModes}
                      onChange={setViewMode}
                      visibleCount={(() => {
                        if (viewMode === 'article')
                          return selectedArticle ? 1 : 0
                        if (viewMode === 'chapitre' && selectedArticle) {
                          return (law.articles ?? []).filter(
                            (a: any) =>
                              a.heading_id === selectedArticle.heading_id,
                          ).length
                        }
                        return law.articles?.length ?? 0
                      })()}
                      lang={currentLang}
                    />
                  ) : null
                }
              />
            )}

            {/* IdentityMasthead removed — it re-printed the devise
                + "CONSTITUTION" header that the hero already shows. */}

            <FormalBlocksSection
              law={law}
              currentLang={currentLang}
              isEditor={isEditor}
              preambleDisplay={preambleDisplay}
              visasDisplay={visasDisplay}
              considerantsDisplay={considerantsDisplay}
              mentionsProceduralesDisplay={mentionsProceduralesDisplay}
              enactingDisplay={enactingDisplay}
              preambleRef={preambleRef}
              visasRef={visasRef}
              considerantsRef={considerantsRef}
              refetch={refetch}
            />

            {/* Document toolbar — sits between the SearchPanel and
                the article content. Renders the "Accéder à la
                version initiale" link, the "Masquer les articles
                abrogés" toggle, and "Copier le lien". The Imprimer
                button is gone (the hero already has a PDF download
                tile). The toolbar self-hides on shapes / view modes
                that don't need it (focused single-article view,
                richtext blob). */}
            {shape !== 'richtext' &&
              hasArticles &&
              !(shape === 'switchable' && viewMode === 'article') && (
                <DocumentToolbar
                  lang={currentLang}
                  hideAbrogated={hideAbrogated}
                  onToggleHideAbrogated={() =>
                    setHideAbrogated((v) => !v)
                  }
                  onJumpToInitial={
                    law.articles && law.articles.length > 0
                      ? () => {
                          const first = law.articles[0]
                          const el = document.getElementById(
                            `article-${String(first.number)}`,
                          )
                          if (el) {
                            el.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            })
                          }
                        }
                      : undefined
                  }
                  onCollapseAll={
                    (law.headings?.length ?? 0) > 0
                      ? headingCollapse.collapseAll
                      : undefined
                  }
                  onExpandAll={
                    (law.headings?.length ?? 0) > 0
                      ? headingCollapse.expandAll
                      : undefined
                  }
                />
              )}

            <div ref={articleViewerRef} className="mb-8 scroll-mt-24">
              {/* ── Article rendering branches by view mode ───────────
                  - 'article' (current default) → ArticleSection: one
                    focused article with prev/next + full chrome.
                  - 'tous' → ArticleListView: every article inline,
                    heading break-rows between sections.
                  - 'chapitre' → ArticleListView filtered to articles
                    sharing the selected article's direct heading. V1
                    uses ``heading_id`` equality (same direct parent);
                    walking up to a chapter-level ancestor is a future
                    refinement. */}
              {(() => {
                // Decision table for which renderer takes over:
                //
                //   richtext  → ArticleSection (handles document_mode
                //               internally and reads document_body_*).
                //   document  → ArticleListView with all articles —
                //               flat short text feels like a printed
                //               document when articles flow inline.
                //   switchable + article → ArticleSection (focused
                //               viewer, current default).
                //   switchable + tous → ArticleListView all.
                //   switchable + chapitre → ArticleListView filtered
                //               to selectedArticle's direct parent
                //               heading.
                if (shape === 'richtext') {
                  return (
                    <ArticleSection
                      law={law}
                      currentLang={currentLang}
                      isEditor={isEditor}
                      isDocumentMode={isDocumentMode}
                      hasArticles={hasArticles}
                      selectedArticle={selectedArticle}
                      currentArticleIndex={currentArticleIndex}
                      title={title}
                      articleBreadcrumb={articleBreadcrumb}
                      blocHints={blocHints}
                      onPrevious={handlePrevious}
                      onNext={handleNext}
                      onShare={handleShare}
                      onCopyLink={handleCopyLink}
                      onEmptyAddArticle={() => setEmptyAddArticleOpen(true)}
                      refetch={refetch}
                    />
                  )
                }
                if (shape === 'document') {
                  // Flat short decree: switcher offers Tous + Un
                  // article (no chapter). When viewMode is 'article'
                  // we route to the focused viewer so "Vue article
                  // unique" actually swaps the layout (used to fall
                  // back to the list view, which made the link a
                  // no-op).
                  if (viewMode === 'article') {
                    return (
                      <ArticleSection
                        law={law}
                        currentLang={currentLang}
                        isEditor={isEditor}
                        isDocumentMode={isDocumentMode}
                        hasArticles={hasArticles}
                        selectedArticle={selectedArticle}
                        currentArticleIndex={currentArticleIndex}
                        title={title}
                        articleBreadcrumb={articleBreadcrumb}
                        blocHints={blocHints}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        onShare={handleShare}
                        onCopyLink={handleCopyLink}
                        onEmptyAddArticle={() =>
                          setEmptyAddArticleOpen(true)
                        }
                        refetch={refetch}
                      />
                    )
                  }
                  return (
                    <ArticleListView
                      articles={law.articles ?? []}
                      headings={law.headings ?? []}
                      lawSlug={law.slug}
                      lawShortTitle={lawShortCite(law.title_fr)}
                      codeSubcategory={law.code_subcategory ?? null}
                      currentLang={currentLang}
                      isEditor={isEditor}
                      lawId={law.id}
                      onArticleChanged={refetch}
                      searchQuery={pageSearchQuery}
                      searchScope={pageSearchScope}
                      hideAbrogated={hideAbrogated}
                      collapsed={headingCollapse.collapsed}
                      onToggleCollapsed={headingCollapse.toggle}
                    />
                  )
                }
                if (viewMode === 'article') {
                  return (
                    <ArticleSection
                      law={law}
                      currentLang={currentLang}
                      isEditor={isEditor}
                      isDocumentMode={isDocumentMode}
                      hasArticles={hasArticles}
                      selectedArticle={selectedArticle}
                      currentArticleIndex={currentArticleIndex}
                      title={title}
                      articleBreadcrumb={articleBreadcrumb}
                      blocHints={blocHints}
                      onPrevious={handlePrevious}
                      onNext={handleNext}
                      onShare={handleShare}
                      onCopyLink={handleCopyLink}
                      onEmptyAddArticle={() => setEmptyAddArticleOpen(true)}
                      refetch={refetch}
                    />
                  )
                }
                return (
                  <ArticleListView
                    articles={
                      viewMode === 'chapitre' && selectedArticle
                        ? (law.articles ?? []).filter(
                            (a: any) =>
                              a.heading_id === selectedArticle.heading_id,
                          )
                        : (law.articles ?? [])
                    }
                    headings={law.headings ?? []}
                    lawSlug={law.slug}
                    lawShortTitle={lawShortCite(law.title_fr)}
                    codeSubcategory={law.code_subcategory ?? null}
                    currentLang={currentLang}
                    isEditor={isEditor}
                    lawId={law.id}
                    lawPublicationDate={
                      law.publication_date ??
                      law.moniteur_issue_publication_date ??
                      null
                    }
                    onArticleChanged={refetch}
                    searchQuery={pageSearchQuery}
                    searchScope={pageSearchScope}
                    hideAbrogated={hideAbrogated}
                    collapsed={headingCollapse.collapsed}
                    onToggleCollapsed={headingCollapse.toggle}
                    emptyLabel={
                      viewMode === 'chapitre'
                        ? currentLang === 'fr'
                          ? 'Aucun article dans cette section.'
                          : 'Pa gen atik nan seksyon sa a.'
                        : undefined
                    }
                  />
                )
              })()}
            </div>

            {/* Signataires block */}
            {(law.signers && law.signers.length > 0) ||
            law.official_formula ||
            isEditor ? (
              <SignataireBlock
                slug={law.slug}
                signers={(law.signers ?? []) as any}
                officialFormula={law.official_formula ?? null}
                category={law.category as any}
                lang={currentLang}
                isEditor={isEditor}
                onChanged={refetch}
                promulgationDate={law.promulgation_date ?? null}
                issuingDate={law.issuing_date ?? null}
              />
            ) : null}

            <ClosingAddendum
              law={law}
              currentLang={currentLang}
              isEditor={isEditor}
              refetch={refetch}
            />

            {isEditor && (
              <ChangesMadePanel lawSlug={law.slug} lang={currentLang} />
            )}

            {isEditor && law && (
              <EditorBar
                slug={law.slug}
                status={
                  (law.editorial_status ?? 'draft') as
                    | 'draft'
                    | 'pending_review'
                    | 'published'
                    | 'rejected'
                }
                editorEmail={editorUser?.email ?? null}
                metadata={{
                  slug: law.slug,
                  title_fr: law.title_fr,
                  title_ht: law.title_ht ?? null,
                  official_title_fr: law.official_title_fr ?? null,
                  official_title_ht: law.official_title_ht ?? null,
                  description_fr: law.description_fr ?? null,
                  description_ht: law.description_ht ?? null,
                  issuing_date: law.issuing_date ?? null,
                  promulgation_date: law.promulgation_date ?? null,
                  publication_date: law.publication_date ?? null,
                  moniteur_ref: law.moniteur_ref ?? null,
                  mentions_procedurales_fr:
                    law.mentions_procedurales_fr ?? null,
                  mentions_procedurales_ht:
                    law.mentions_procedurales_ht ?? null,
                  category: law.category,
                  code_subcategory: law.code_subcategory ?? null,
                  status: law.status,
                  official_number: law.official_number ?? null,
                  issuing_authority: law.issuing_authority ?? null,
                  official_formula: law.official_formula ?? null,
                  enacting_formula_fr: law.enacting_formula_fr ?? null,
                  enacting_formula_ht: law.enacting_formula_ht ?? null,
                  abrogated_by: law.abrogated_by
                    ? {
                        slug: law.abrogated_by.slug,
                        title_fr: law.abrogated_by.title_fr,
                        title_ht: law.abrogated_by.title_ht ?? null,
                      }
                    : null,
                  // Pass current theme tags (auto + editor) so the
                  // editor can see what's already attached and toggle
                  // additions / removals.
                  theme_tags: law.theme_tags ?? [],
                  // Per-document block-order toggle (mentions
                  // procédurales before considérants for 19th-century
                  // texts). Defaults to false / modern drafting.
                  mentions_procedurales_before_considerants:
                    (law as any).mentions_procedurales_before_considerants ?? false,
                }}
                headings={law.headings ?? []}
                onChanged={refetch}
              />
            )}

            {isEditor && law && (
              <AddHeadingDialog
                open={addHeadingAnchor !== null}
                onOpenChange={(o) => {
                  if (!o) setAddHeadingAnchor(null)
                }}
                lawSlug={law.slug}
                afterHeadingId={
                  addHeadingAnchor?.kind === 'after'
                    ? addHeadingAnchor.heading.id
                    : null
                }
                parentId={
                  addHeadingAnchor?.kind === 'child'
                    ? addHeadingAnchor.heading.id
                    : null
                }
                anchorLabel={(() => {
                  if (addHeadingAnchor?.kind === 'after') {
                    const h = addHeadingAnchor.heading
                    return (
                      h.title_fr ||
                      (h.number ? `Section ${h.number}` : null)
                    )
                  }
                  if (addHeadingAnchor?.kind === 'child') {
                    const h = addHeadingAnchor.heading
                    return (
                      h.title_fr ||
                      (h.number ? `Section ${h.number}` : null)
                    )
                  }
                  return null
                })()}
                lang={currentLang}
                onCreated={() => refetch()}
              />
            )}

            {isEditor && law && (
              <AddArticleDialog
                open={emptyAddArticleOpen}
                onOpenChange={setEmptyAddArticleOpen}
                lawSlug={law.slug}
                lawId={law.id}
                afterArticleId={null}
                afterArticleLabel={null}
                mode="correction"
                lang={currentLang}
                onCreated={() => refetch()}
              />
            )}

            {isEditor && law && (
              <DeviseEditorDialog
                open={deviseEditorOpen}
                onOpenChange={setDeviseEditorOpen}
                lawSlug={law.slug}
                initialFr={(law as any).devise_fr ?? null}
                initialHt={(law as any).devise_ht ?? null}
                onSaved={() => refetch()}
              />
            )}

            <RelatedLaws relatedLaws={relatedLaws} currentLang={currentLang} />
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
