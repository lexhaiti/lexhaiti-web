'use client'

import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import dynamic from 'next/dynamic'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { usePathname, useParams, useRouter, useSearchParams } from 'next/navigation'
import { FinalPart } from '@/components/law-details/FinalPart'

// Editor-only overlays. These render only for signed-in editors (gated
// behind ``isEditor``) and never participate in SSR/SEO, yet they were
// previously imported eagerly — pulling the whole editor surface (incl.
// the Tiptap rich-text editor that ``AddArticleDialog`` carries) into
// every public reader's first-load bundle. Loading them via
// ``next/dynamic`` with ``ssr: false`` keeps the heavy editor chunks out
// of the public ``/loi/[slug]`` payload; they fetch on demand the first
// time an editor session mounts them.
const EditorBar = dynamic(
  () => import('./EditorBar').then((m) => ({ default: m.EditorBar })),
  { ssr: false },
)
const ChangesMadePanel = dynamic(
  () =>
    import('@/components/law-details/_panels/ChangesMadePanel').then((m) => ({
      default: m.ChangesMadePanel,
    })),
  { ssr: false },
)
const AddHeadingDialog = dynamic(
  () =>
    import('@/components/law-details/_panels/AddHeadingDialog').then((m) => ({
      default: m.AddHeadingDialog,
    })),
  { ssr: false },
)
const AddArticleDialog = dynamic(
  () =>
    import('@/components/law-details/_panels/AddArticleDialog').then((m) => ({
      default: m.AddArticleDialog,
    })),
  { ssr: false },
)
const DeviseEditorDialog = dynamic(
  () =>
    import('./_panels/DeviseEditorDialog').then((m) => ({
      default: m.DeviseEditorDialog,
    })),
  { ssr: false },
)
import { useLawDetail } from '@/lib/hooks/useLawDetail'
import { getLevelLabel } from '@/lib/legal/headingLabels'
import { useLanguage } from '@/i18n/LanguageContext'
import { useT } from '@/i18n/useT'
import { TextNotFound } from '@/components/law-details/TextNotFound'
import { LawDetailSkeleton } from '@/components/law-details/LawDetailSkeleton'
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
import { ChronoTimelinePanel } from './_panels/ChronoTimelinePanel'
import { EditorPreviewBanner } from './EditorPreviewBanner'
import { LawHero } from './LawHero'
import { TocSidebar } from './TocSidebar'
import { SearchPanel } from './SearchPanel'
import { FormalBlocksSection } from './FormalBlocksSection'
import { ArticleSection } from './ArticleSection'
import { ArticleListView } from './ArticleListView'
import { ViewModeSwitcher } from './ViewModeSwitcher'
import { ChapterNav } from './ChapterNav'
import { FinalSections } from './FinalSections'
import { RelatedLaws } from './RelatedLaws'

// View-mode plumbing — shape detection + persisted mode state.
import { detectShape, availableViewModes } from '@/lib/legal/shape'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useHeadingCollapse } from '@/lib/hooks/useHeadingCollapse'
import { useInitialVersions } from '@/lib/hooks/useInitialVersions'
import { lawShortCite } from '@/lib/legal/cite'
import {
  articleNumberEquals,
  normalizeArticleNumber,
} from '@/lib/legal/articleNumber'
import { cn } from '@/lib/utils'
import { useReaderChrome } from '@/components/layout/ReaderChromeContext'


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
  // One-shot signal: when an editor clicks "Modifier" on an article in
  // a list view, we focus that article in the single-article view and
  // ask the viewer to open its editor (edit-from-any-view).
  const [autoEditId, setAutoEditId] = useState<number | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // Hide articles whose status === 'abrogated'. Controlled by the
  // DocumentToolbar above the article list.
  const [hideAbrogated, setHideAbrogated] = useState(false)
  // View-as-of-date toggle. 'today' is the current
  // in-force state of every article (default); 'initial' will
  // eventually render each article's V1 — visual state only for now,
  // backend support pending. The shared toggle paints the active
  // button navy so the user sees which mode they're in.
  const [viewAsOfDate, setViewAsOfDate] = useState<
    'today' | 'initial'
  >('today')
  // "Voir les versions dans le temps" panel — opens an accordion
  // below the toolbar with the law-level change history.
  const [chronoOpen, setChronoOpen] = useState(false)
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
  // Public-preview flag lives on its OWN param (``apercu``) — NOT on
  // ``view``, which is the article view-mode (tous / article / titre /
  // chapitre). Overloading one param made the two fight each other
  // (entering preview wiped the mode, switching mode dropped preview).
  const isPublicPreview = searchParams?.get('apercu') === '1'
  const isEditor = actuallyIsEditor && !isPublicPreview
  const { data: law, status, isLoading, isError, refetch } = useLawDetail(slug)

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
  // The switcher reflects ``viewMode`` immediately (instant button
  // feedback), but the heavy article list renders off ``renderViewMode``
  // — a deferred copy. On a switch (e.g. Un article → Tous, ~500 cards)
  // React keeps the old view painted and builds the new one as a
  // non-blocking, interruptible background render, then swaps it in.
  // ``isViewSwitching`` is true during that window so we can dim the
  // outgoing content for a beat instead of freezing the click.
  const renderViewMode = useDeferredValue(viewMode)
  const isViewSwitching = renderViewMode !== viewMode

  // Shared heading-collapse state — DocumentToolbar's Tout fermer
  // / Tout ouvrir buttons and ArticleListView's per-row chevrons
  // both read + write the same Set through this hook.
  const headingCollapse = useHeadingCollapse(law?.headings ?? [])

  // Lazy-fetch V1 of every amended article when the user picks
  // "Accéder à la version initiale". Reuses the existing
  // ``/articles/{id}/versions`` endpoint (same one the Comparer
  // button hits) so no new backend is needed. Cache survives the
  // toggle so flipping back to "today" and "initial" again is
  // instant.
  const initialVersions = useInitialVersions(
    law?.articles ?? [],
    viewAsOfDate === 'initial',
  )

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

  // Map every heading id → its TOP-LEVEL ancestor id (the root of its
  // branch, parent_id === null). The "Par chapitre" nav steps between
  // these top-level divisions (e.g. Titres), not their child
  // chapters/sections, so prev/next means "previous / next Titre".
  const topAncestorById = useMemo(() => {
    const m = new Map<number, number>()
    const resolve = (id: number): number => {
      const cached = m.get(id)
      if (cached != null) return cached
      const h = headingsById.get(id)
      if (!h || h.parent_id == null) {
        m.set(id, id)
        return id
      }
      const top = resolve(h.parent_id)
      m.set(id, top)
      return top
    }
    for (const h of law?.headings ?? []) resolve(h.id)
    return m
  }, [law?.headings, headingsById])

  // Ordered top-level divisions that carry articles (directly or via
  // descendants), in document (position) order. Each gets a display
  // label ("Titre IX — …") and the first article under it so prev/next
  // can re-select the division.
  const chapters = useMemo(() => {
    const codeSubcategory = law?.code_subcategory ?? null
    const firstArticleByTop = new Map<number, ArticleEmbed>()
    for (const a of law?.articles ?? []) {
      const hid = (a as any).heading_id as number | null | undefined
      if (hid == null) continue
      const topId = topAncestorById.get(hid)
      if (topId != null && !firstArticleByTop.has(topId)) {
        firstArticleByTop.set(topId, a)
      }
    }
    const tops = (law?.headings ?? [])
      .filter((h) => h.parent_id == null)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const out: Array<{
      headingId: number
      label: string
      firstArticle: ArticleEmbed
    }> = []
    for (const h of tops) {
      const first = firstArticleByTop.get(h.id)
      if (!first) continue
      const lvl = getLevelLabel(h.level, currentLang, codeSubcategory) ?? h.level
      const num = h.number ? ` ${h.number}` : ''
      const title =
        currentLang === 'ht' && (h as any).title_ht
          ? (h as any).title_ht
          : h.title_fr
      const label = `${lvl}${num}${title ? ` — ${title}` : ''}`.trim()
      out.push({ headingId: h.id, label, firstArticle: first })
    }
    return out
  }, [law?.headings, law?.articles, law?.code_subcategory, currentLang, topAncestorById])

  const currentChapterIdx = useMemo(() => {
    if (!selectedArticle?.heading_id) return -1
    const topId = topAncestorById.get(selectedArticle.heading_id)
    return chapters.findIndex((c) => c.headingId === topId)
  }, [chapters, selectedArticle?.heading_id, topAncestorById])

  // Dynamic label for the "Par chapitre" switcher segment — follows the
  // law's HIGHEST heading level (the level of the root headings). A
  // Titre-rooted text reads "Titre", a Livre-rooted one "Livre", etc.
  // Falls back to "Chapitre" when there are no headings or the level
  // is unknown. The « N° » suffix on the Code-civil "Loi N°" override
  // is stripped so the chip reads "Loi" rather than "Loi N°". The
  // leading "Par " / "Pa " is dropped — at switcher-pill scale the
  // single-noun reads as a segmented choice without the preposition.
  const chapitreLabel = useMemo(() => {
    const codeSubcategory = law?.code_subcategory ?? null
    const tops = (law?.headings ?? []).filter((h) => h.parent_id == null)
    const level = tops[0]?.level
    const titleCase = (s: string | null) =>
      s ? s.charAt(0).toUpperCase() + s.slice(1) : null
    // Lowercase, then drop a trailing « N° » / « Nº » numéro indicator,
    // then re-title-case so "Loi" / "Titre" / "Livre" all render with
    // the same capitalization rhythm as the surrounding "Tous" /
    // "Article" segments.
    const clean = (s: string | null) =>
      s ? titleCase(s.toLowerCase().replace(/\s*n[°º].*$/i, '').trim()) : null
    const fr = clean(getLevelLabel(level, 'fr', codeSubcategory))
    const ht = clean(getLevelLabel(level, 'ht', codeSubcategory))
    return {
      fr: fr ?? 'Chapitre',
      ht: ht ?? 'Chapit',
    }
  }, [law?.headings, law?.code_subcategory])

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
      // Match modulo separator convention — "11.1" (dot, common in
      // amending-law prose) and "11-1" (dash, the Constitution's
      // canonical form) refer to the same article.
      const target = law.articles.find((a) =>
        articleNumberEquals(a.number, requestedArticleParam),
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

  // When the URL drives a navigation TO an article — scroll it into
  // view. Two cases:
  //   - ``view=article`` (focused single-article mode) → scroll the
  //     focused viewer to the middle of the viewport.
  //   - any other view (Tous / Par chapitre / Document) → the article
  //     is already rendered inline with id="article-{number}" by
  //     ArticleListView; scroll *that* card into view instead.
  // This covers both deep-links from outside (search results, shared
  // URLs) AND the inline ``rt-art-ref`` clicks from the body text —
  // both end up driving the URL ``?article=`` param, which is the
  // single source of truth.
  //
  // Two tricky timings to handle:
  //   1. Cross-text link click: arrives on this page with ?article=N
  //      already set, but ``law`` is still null while the data fetch
  //      is in flight. We MUST re-run once the articles array lands —
  //      that's why ``law?.articles`` is in the dep array.
  //   2. Render windowing: ArticleListView only renders the first
  //      ~70 articles by default; if the target is past that, the
  //      jumpToArticleNumber path widens the window synchronously
  //      *during* the next render, so a single 50ms setTimeout still
  //      misses the element. We poll for up to ~1.5s before giving up.
  useEffect(() => {
    if (!requestedArticleParam) return
    const isFocused = searchParams?.get('view') === 'article'
    if (isFocused) {
      const id = window.setTimeout(() => {
        articleViewerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 50)
      return () => window.clearTimeout(id)
    }
    // Inline list view — poll for the card element. The windowing
    // logic in ArticleListView extends the rendered window to include
    // the jump target on the next render after the URL param changes,
    // and ancestor accordions in chapter view need a tick or two to
    // expand. Total budget: ~1.5s (30 × 50ms).
    let attempts = 0
    let timer: number | null = null
    let raf: number | null = null
    // Try both the URL-as-typed and the dash-normalized form. The
    // card id is built from the article's native ``number`` (e.g.
    // "11-1" in the Constitution), so when an amending law's URL
    // uses dot form ("11.1"), the as-typed lookup misses and the
    // normalized lookup hits.
    const candidates = [
      requestedArticleParam,
      normalizeArticleNumber(requestedArticleParam),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i)
    const findCard = (): HTMLElement | null => {
      for (const c of candidates) {
        const el = document.getElementById(`article-${c}`)
        if (el) return el
      }
      return null
    }
    const tryScroll = () => {
      attempts += 1
      const card = findCard()
      if (card) {
        // ``block: 'start'`` + ``scroll-mt-32`` on the card lands the
        // article title just below the sticky header. ``center`` is
        // brittle here — short articles can render inside the same
        // viewport as their neighbour, and the user reads the wrong
        // one as the "landed" article.
        card.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Content-visibility:auto on the cards above replaces
        // intrinsic-size placeholders with real heights as they
        // enter the viewport, shifting absolute Y. Settle that with
        // a second scrollIntoView two frames later — same target,
        // by then heights are stable. (One frame is sometimes too
        // soon when the browser batches the layout passes.)
        raf = window.requestAnimationFrame(() => {
          raf = window.requestAnimationFrame(() => {
            const stable = findCard()
            if (stable) {
              stable.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          })
        })
        return
      }
      if (attempts < 30) {
        timer = window.setTimeout(tryScroll, 50)
      }
    }
    timer = window.setTimeout(tryScroll, 50)
    return () => {
      if (timer != null) window.clearTimeout(timer)
      if (raf != null) window.cancelAnimationFrame(raf)
    }
  }, [requestedArticleParam, searchParams, law?.articles])

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
  // Container ref for the article-reference link delegation handler
  // below. The backend linkifier stamps every inline "article 295"
  // mention as ``<a class="rt-art-ref" href="?article=295">``; we
  // intercept clicks on those anchors here so the URL update is
  // shallow (no Next.js full-route nav) and the existing
  // ``requestedArticleParam`` effect picks up the change and scrolls
  // the matching article into view.
  const lawDetailRootRef = React.useRef<HTMLDivElement>(null)

  // Defensive href upgrade for cross-text rt-art-ref anchors. The
  // backend linkifier v4 emits ``?view=article&article=N`` directly,
  // but pre-v4 rows that haven't been re-backfilled yet still have
  // ``?article=N`` alone, AND the React click-handler intercept below
  // hasn't been reliably firing in prod (Next.js's own anchor
  // capture-phase handler may be intercepting first, swallowing
  // bubble-phase listeners). Walking the DOM right after the law
  // body renders and rewriting the hrefs in place makes the link
  // correct *as a regular link* — no JS intercept, no backfill
  // dependency. Idempotent (skips anchors already correct) and
  // re-runs each time the law data changes so freshly-mounted
  // articles get the same treatment.
  useEffect(() => {
    const root = lawDetailRootRef.current
    if (!root) return
    const anchors = root.querySelectorAll<HTMLAnchorElement>(
      'a.rt-art-ref[data-target]',
    )
    anchors.forEach((a) => {
      const href = a.getAttribute('href') || ''
      // Skip anchors that already have view=article (v4 backfilled
      // OR already upgraded by this hook on a previous render).
      if (href.includes('view=article')) return
      // Only rewrite cross-text shape (starts with /loi/).
      if (!href.startsWith('/loi/')) return
      try {
        const url = new URL(href, window.location.origin)
        url.searchParams.set('view', 'article')
        a.setAttribute('href', url.pathname + url.search)
      } catch {
        // Malformed href — leave it untouched.
      }
    })
  }, [law?.id, law?.articles])

  // Article-reference link interception.
  // The backend linkifier (services/text/linkify.py) rewrites every
  // inline "article 295" / "art. 1382" / "article 267.2" mention in
  // body text as ``article <a class="rt-art-ref" data-article="N"
  // href="?article=N">N</a>`` (same-law) or with an absolute
  // ``href="/loi/{slug}?article=N"`` + ``data-target="{slug}"`` when
  // the law amends exactly one other law (cross-text routing).
  // Two click outcomes:
  //   1. Relative href (``?article=N``) — same law. We intercept and
  //      call ``router.replace`` so the URL ``?article`` param
  //      updates without a full route change (the existing
  //      ``requestedArticleParam`` effect above then selects +
  //      scrolls to the article).
  //   2. Absolute href (``/loi/{slug}?article=N``) — cross-text.
  //      Do NOT preventDefault: let Next.js handle the click as a
  //      regular client-side route change to the destination law.
  // Modifier-clicks (cmd/ctrl/shift/middle-click) always fall
  // through to the browser so "open in new tab" still works for
  // both shapes.
  useEffect(() => {
    const root = lawDetailRootRef.current
    if (!root) return
    const onClick = (e: MouseEvent) => {
      // Let modifier-clicks / middle-clicks through — opens in new tab
      // is a useful escape hatch when comparing two articles.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }
      // ``closest`` walks up through inline tags (the linkifier emits
      // anchors that can sit inside <strong>, <em>, etc.).
      const target = (e.target as Element | null)?.closest?.(
        'a.rt-art-ref',
      ) as HTMLAnchorElement | null
      if (!target) return
      // Read the href *attribute* directly (not the resolved DOM
      // property) — the attribute carries the original shape
      // ("?article=N" vs "/loi/{slug}?article=N"), the property
      // resolves to an absolute URL in both cases. The attribute
      // shape is what tells us which click path to take.
      const hrefAttr = target.getAttribute('href') || ''
      if (hrefAttr.startsWith('/loi/')) {
        // Cross-text reference — the href is ALREADY correct
        // (the on-mount useEffect above rewrote any pre-v4 anchors
        // to include ``view=article``). Let the browser do its
        // default anchor navigation, which Next.js intercepts as a
        // regular client-side route change. The earlier JS
        // intercept here was unreliable: Next.js's own anchor
        // capture handler seems to swallow it on real user clicks,
        // leaving the page stuck on the source law.
        return
      }
      // Pull the article number off the data attribute (cheaper than
      // re-parsing the href). Bail when both are missing — leaves the
      // browser to handle the click as-is (defensive; the linkifier
      // always emits both).
      const num =
        target.dataset.article ||
        new URL(target.href, window.location.origin).searchParams.get('article')
      if (!num) return
      e.preventDefault()
      // Build the next query string from the *current* one so other
      // params (view, lang, theme) survive the shallow nav.
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('article', num)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [router, pathname, searchParams])
  // Sentinel placed at the top of the in-flow tools row. Once it
  // scrolls under where the header sits, we flip ``stickyActive`` —
  // the signal that the reader is now in the body, which fades in the
  // floating reading controls (Sommaire toggle + back-to-top).
  const toolsSentinelRef = React.useRef<HTMLDivElement>(null)
  const { stickyActive, setStickyActive } = useReaderChrome()
  useEffect(() => {
    const onScroll = () => {
      const el = toolsSentinelRef.current
      // No sentinel (law still loading / richtext shape) → header stays.
      if (!el) {
        setStickyActive(false)
        return
      }
      // Activate once the tools row has scrolled up to ~the header
      // line; deactivate (header returns) when it drops back below.
      setStickyActive(el.getBoundingClientRect().top <= 72)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      // Leaving the page must restore the header for every other route.
      setStickyActive(false)
    }
  }, [setStickyActive])
  const preambleRef = React.useRef<HTMLDivElement>(null)
  // visasRef doubles as the scroll anchor for the combined "Partie
  // introductive" block.
  const visasRef = React.useRef<HTMLDivElement>(null)
  // Préambule + Partie introductive open/close state — lifted here so
  // the sommaire entries and the body blocks stay in sync (clicking the
  // sommaire entry toggles the body block, and vice versa).
  const [preambleExpanded, setPreambleExpanded] = useState(false)
  const [introExpanded, setIntroExpanded] = useState(false)

  // Render the skeleton for BOTH the initial ``idle`` state (before the
  // fetch effect has run — useLawDetail starts at 'idle', not 'loading')
  // AND the in-flight ``loading`` state. Gating only on ``isLoading`` let
  // the very first paint fall through to ``TextNotFound`` (a short page),
  // which then jumped to the tall skeleton a frame later — that bounce
  // shoved the site footer down from inside the viewport and was the
  // dominant CLS contributor on this route. The shape-matched skeleton
  // (dark hero band + two-column body) now paints from frame one, so the
  // loaded page swaps in without reflowing the above-the-fold layout.
  // See LawDetailSkeleton for more.
  if (isLoading || (status === 'idle' && !law)) {
    return <LawDetailSkeleton />
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

  // Préambule is its own block; the rest of the introductory part is the
  // single combined ``intro_fr/ht`` field (the flat per-kind columns were
  // dropped in migration 0046), handled inside FormalBlocksSection.
  const preambleDisplay = pickBilingual(law.preamble_fr, law.preamble_ht, currentLang)

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

  // Editor "Modifier" from a list view (Tous / Par titre): focus the
  // article in the single-article view AND open its inline editor there
  // — so editing is reachable from any view, in one click.
  const handleEditArticle = (article: any) => {
    setSelectedArticle(article)
    setViewMode('article')
    setAutoEditId(article.id)
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('article', String(article.number))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setTimeout(() => {
      articleViewerRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  // Sommaire → body navigation. Clicking a heading (Titre / Chapitre /
  // Section) in the sommaire jumps the body to that chapter and opens
  // it: we find the first article anywhere under the heading and
  // select it (chapter view filters to it; tous view scrolls to it),
  // expanding the heading in the body tree if it was collapsed.
  const handleHeadingNavigate = (heading: any) => {
    if (!heading?.id || !law) return
    const childrenByParent = new Map<number, number[]>()
    for (const h of law.headings ?? []) {
      if (h.parent_id != null) {
        const arr = childrenByParent.get(h.parent_id) ?? []
        arr.push(h.id)
        childrenByParent.set(h.parent_id, arr)
      }
    }
    const subtree = new Set<number>()
    const stack = [heading.id as number]
    while (stack.length) {
      const id = stack.pop()!
      subtree.add(id)
      for (const c of childrenByParent.get(id) ?? []) stack.push(c)
    }
    // Expand the heading in the body tree (tous view) so the target
    // article isn't hidden behind a collapsed ancestor.
    if (headingCollapse.isCollapsed(heading.id)) headingCollapse.toggle(heading.id)
    const firstArticle = (law.articles ?? []).find(
      (a: any) => a.heading_id != null && subtree.has(a.heading_id),
    )
    if (firstArticle) {
      handleArticleSelect(firstArticle)
    } else {
      setTimeout(() => {
        articleViewerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
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
      ref={lawDetailRootRef}
      className={`min-h-screen bg-white dark:bg-slate-950 ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-slate-950' : ''}`}
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
              preambleExpanded={preambleExpanded}
              setPreambleExpanded={setPreambleExpanded}
              introExpanded={introExpanded}
              setIntroExpanded={setIntroExpanded}
              onArticleSelect={handleArticleSelect}
              onHeadingNavigate={handleHeadingNavigate}
              onAddHeading={setAddHeadingAnchor}
              refetch={refetch}
            />
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 pb-12 sm:pb-16 lg:py-8">
            {/* Sentinel — once it scrolls up to the header line the
                ReaderChrome flips ``stickyActive``, which slides the
                global header away for more reading room and reveals the
                scroll-to-top button. */}
            <div ref={toolsSentinelRef} aria-hidden className="h-0" />

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
                      chapitreLabel={chapitreLabel}
                      lang={currentLang}
                    />
                  ) : null
                }
              />
            )}

            {shape !== 'richtext' &&
              hasArticles &&
              !(shape === 'switchable' && viewMode === 'article') && (
                <DocumentToolbar
                  lang={currentLang}
                  viewAsOfDate={viewAsOfDate}
                  onChangeViewAsOfDate={(next) => {
                    setViewAsOfDate(next)
                    if (next === 'initial' && law.articles?.[0]) {
                      const el = document.getElementById(
                        `article-${String(law.articles[0].number)}`,
                      )
                      el?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  }}
                  chronoOpen={chronoOpen}
                  onToggleChrono={() => setChronoOpen((v) => !v)}
                  hideAbrogated={hideAbrogated}
                  onToggleHideAbrogated={() =>
                    setHideAbrogated((v) => !v)
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
                  // Mobile-only: Sommaire toggle shares a row with the
                  // Outils dropdown trigger inside DocumentToolbar.
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => handleSidebarToggle(!isSidebarOpen)}
                />
              )}

            {shape !== 'richtext' &&
              hasArticles &&
              !(shape === 'switchable' && viewMode === 'article') && (
                <ChronoTimelinePanel
                  lawSlug={law.slug}
                  lang={currentLang}
                  lawPublicationDate={
                    law.publication_date ??
                    law.moniteur_issue_publication_date ??
                    law.issuing_date ??
                    null
                  }
                  articles={law.articles ?? []}
                  headings={law.headings ?? []}
                  codeSubcategory={law.code_subcategory ?? null}
                  open={chronoOpen}
                  onClose={() => setChronoOpen(false)}
                />
              )}

            {/* IdentityMasthead removed — it re-printed the devise
                + "CONSTITUTION" header that the hero already shows. */}

            <FormalBlocksSection
              law={law}
              currentLang={currentLang}
              isEditor={isEditor}
              preambleDisplay={preambleDisplay}
              preambleRef={preambleRef}
              visasRef={visasRef}
              preambleExpanded={preambleExpanded}
              onPreambleExpandedChange={setPreambleExpanded}
              introExpanded={introExpanded}
              onIntroExpandedChange={setIntroExpanded}
              showInitialVersion={viewAsOfDate === 'initial'}
              refetch={refetch}
            />

            <div
              ref={articleViewerRef}
              className={cn(
                'mb-2 scroll-mt-24 transition-opacity duration-150',
                // Dim the outgoing view for the brief beat while the
                // deferred render builds the incoming one.
                isViewSwitching && 'opacity-50',
              )}
            >
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
                // Render off the DEFERRED view mode so a switch doesn't
                // block on building ~500 cards — the old view stays
                // painted until the new one is ready.
                const vm = renderViewMode
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
                      autoEditId={autoEditId}
                      onAutoEditHandled={() => setAutoEditId(null)}
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
                  if (vm === 'article') {
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
                        autoEditId={autoEditId}
                        onAutoEditHandled={() => setAutoEditId(null)}
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
                      onEditArticle={handleEditArticle}
                      searchQuery={pageSearchQuery}
                      searchScope={pageSearchScope}
                      jumpToArticleNumber={requestedArticleParam}
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
                      autoEditId={autoEditId}
                      onAutoEditHandled={() => setAutoEditId(null)}
                    />
                  )
                }
                return (
                  <>
                    <ArticleListView
                      articles={
                        vm === 'chapitre' && selectedArticle
                          ? (law.articles ?? []).filter(
                              (a: any) =>
                                a.heading_id != null &&
                                selectedArticle.heading_id != null &&
                                topAncestorById.get(a.heading_id) ===
                                  topAncestorById.get(
                                    selectedArticle.heading_id,
                                  ),
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
                      onEditArticle={handleEditArticle}
                      searchQuery={pageSearchQuery}
                      searchScope={pageSearchScope}
                      jumpToArticleNumber={requestedArticleParam}
                      hideAbrogated={hideAbrogated}
                      collapsed={headingCollapse.collapsed}
                      onToggleCollapsed={headingCollapse.toggle}
                      showInitialVersion={viewAsOfDate === 'initial'}
                      initialV1ById={initialVersions.v1ById}
                      emptyLabel={
                        vm === 'chapitre'
                          ? currentLang === 'fr'
                            ? 'Aucun article dans cette section.'
                            : 'Pa gen atik nan seksyon sa a.'
                          : undefined
                      }
                    />
                    {/* Prev/next Titre strip — Par chapitre only, placed
                        BELOW the chapter so the reader advances after
                        finishing it. Steps between top-level divisions. */}
                    {vm === 'chapitre' && currentChapterIdx >= 0 && (
                      <div className="mt-6">
                        <ChapterNav
                          lang={currentLang}
                          currentLabel={chapters[currentChapterIdx]?.label ?? ''}
                          prevLabel={
                            chapters[currentChapterIdx - 1]?.label ?? null
                          }
                          nextLabel={
                            chapters[currentChapterIdx + 1]?.label ?? null
                          }
                          index={currentChapterIdx}
                          total={chapters.length}
                          onPrev={() => {
                            const prev = chapters[currentChapterIdx - 1]
                            if (prev) handleArticleSelect(prev.firstArticle)
                          }}
                          onNext={() => {
                            const next = chapters[currentChapterIdx + 1]
                            if (next) handleArticleSelect(next.firstArticle)
                          }}
                        />
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Partie finale — closing formula + signatures as one
                combined rich-text field (closing_fr/ht). */}
            <FinalPart
              law={law}
              currentLang={currentLang}
              isEditor={isEditor}
              refetch={refetch}
            />

            {/* Partie finale — additional labelled sections (résolution,
                ratification, acte de promulgation, approbation, …). The
                old single closing_addendum block was folded into these
                (migration 0049, as an `approbation` section). */}
            <FinalSections
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
                  category: law.category,
                  code_subcategory: law.code_subcategory ?? null,
                  status: law.status,
                  official_number: law.official_number ?? null,
                  issuing_authority: law.issuing_authority ?? null,
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
            {/* Modest spacer (h-12) so the last content item doesn't
                sit flush against the floating Sommaire / ScrollToTop
                pair when the user scrolls all the way to the bottom.
                Disabled at lg+ where the FABs are less collision-
                prone. The previous h-24 left an awkward void; h-12
                is enough to clear the FABs' shadow without the
                cavernous feel. */}
            <div aria-hidden className="h-12 lg:h-0" />
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  )
}
