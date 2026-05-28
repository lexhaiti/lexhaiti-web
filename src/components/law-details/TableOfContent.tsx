'use client'

import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatHeadingNumber as fmtHeadingNumberShared } from '@/lib/legal/headingLabels'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  PenLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Article {
  /** Article row id — required so editor-mode reorder buttons can
   *  build the permutation payload. Always present in ArticleEmbed
   *  objects (which is what LawDetail passes through). */
  id: number
  number: string
  heading_id?: number | null
  chapter?: string | null
  title_fr?: string | null
  title_ht?: string | null
  content_fr?: string | null
  content_ht?: string | null
  word_count?: number
  bookmarked?: boolean
}

interface Heading {
  id: number
  key: string
  parent_id?: number | null
  level?: string | null
  number?: string | null
  title_fr?: string | null
  title_ht?: string | null
  content_fr?: string | null
  content_ht?: string | null
  position?: number
}

/** A node in the heading tree with attached articles */
interface TocNode {
  heading: Heading
  articles: Article[]
  children: TocNode[]
}

interface TableOfContentsProps {
  articles: Article[]
  headings?: Heading[]
  currentLang: 'fr' | 'ht'
  /** When the parent text is a code, this drives heading-label
   *  overrides (e.g. « Loi » instead of « Livre » for code_civil). */
  codeSubcategory?: string | null
  onArticleSelect: (article: Article) => void
  /** Optional: fired when a heading row (Titre / Chapitre / Section)
   *  is clicked, IN ADDITION to toggling its tree node. The parent
   *  uses it to jump the body to that chapter and open it. */
  onHeadingNavigate?: (heading: Heading) => void
  selectedArticle?: string
  /** Search query driven by the page-level search panel above the article column. */
  externalQuery?: string
  hasPreamble?: boolean
  onPreambleClick?: () => void
  hasVisas?: boolean
  onVisasClick?: () => void
  hasConsiderants?: boolean
  onConsiderantsClick?: () => void
  /** Editor mode toggles inline heading-title editing. Public viewers
   *  see the same TOC with no edit affordances. */
  isEditor?: boolean
  /** Save handler for a heading inline edit. Called with the heading's
   *  database id, the field being edited, and the new value. Currently
   *  supports three fields:
   *    - ``title_fr`` / ``title_ht`` — heading title in either language
   *    - ``number`` — the displayed numeral / ordinal (e.g. "2" → "II",
   *      "1" → "Première"). Editors hit this when the JSON import gave
   *      Arabic digits but the canonical source uses Roman numerals
   *      or French ordinals.
   *  Parent is responsible for refetching the law so the new value
   *  flows back into the tree. */
  onHeadingTitleSave?: (
    headingId: number,
    field: 'title_fr' | 'title_ht' | 'number',
    next: string,
  ) => Promise<void>
  /** Delete handler for a heading (Titre / Chapitre / Section / …).
   *  Receives the heading id and a flag indicating whether to lift
   *  child articles + sub-headings to the parent before deletion.
   *  Parent component shows a ConfirmDialog before invoking this and
   *  refetches the law on success. */
  onHeadingDelete?: (
    headingId: number,
    reparentChildren: boolean,
  ) => Promise<void>
  /** Open the "Add heading" modal anchored after this heading.
   *  ``afterHeading`` is the heading the new node should slot after;
   *  parent component owns the modal state. */
  onAddSiblingHeading?: (afterHeading: Heading) => void
  /** Open the "Add heading" modal as a child of this heading (used
   *  by the "+" button at the top of an expanded subtree). */
  onAddChildHeading?: (parent: Heading) => void
  /** Open the "Add heading" modal at the text root (no parent). */
  onAddRootHeading?: () => void
  /** Reorder a heading sibling set — parent owns the API call so
   *  it can refetch the law after success. ``parentId`` is null for
   *  top-level headings; the order array covers the sibling set
   *  exactly (full permutation, not just a delta). Invoked when the
   *  editor clicks the ▲ / ▼ arrows on a heading row. */
  onReorderHeadings?: (
    parentId: number | null,
    orderedIds: number[],
  ) => Promise<void>
  /** Reorder articles inside a single heading bucket — same shape
   *  as ``onReorderHeadings`` but for the article rows nested under
   *  a heading. ``headingId=null`` is the text-root bucket (orphan
   *  articles with no heading parent). */
  onReorderArticles?: (
    headingId: number | null,
    orderedIds: number[],
  ) => Promise<void>
  /** Ordered list of heading ids on the path from the LegalText root
   *  down to the currently selected article (Titre → Chapitre → …).
   *  Every heading in this set is rendered in the active colour (red)
   *  so the path stays visible even if the article isn't scrolled
   *  into view — like a breadcrumb embedded in the tree.
   *  Auto-expanded on selection so the path is always visible. */
  activeHeadingIds?: number[]
}

// Heading level labels (Livre, Titre, …) and per-code overrides
// (Code civil uses « Loi » instead of « Livre ») are centralised in
// src/lib/legal/headingLabels.ts so every render site stays in sync.

// Some headings use a French word as their "number" instead of a roman
// numeral / letter — the 1987 Constitution's "Chapitre Préliminaire"
// (TIT VI, Du Conseil Constitutionnel) is the canonical case. The
// constitutional amendment that added it didn't specify a numeric
// position, so editors store the literal word as ``number``. Provide
// the Kreyòl spelling here so the TOC reads natively in HT.
const HEADING_NUMBER_TRANSLATIONS: Record<string, string> = {
  Préliminaire: 'Preliminè',
  préliminaire: 'preliminè',
}

function formatHeadingNumber(
  level: string | null | undefined,
  number: string | null | undefined,
  lang: 'fr' | 'ht',
  codeSubcategory?: string | null,
): string {
  return fmtHeadingNumberShared(
    level,
    number,
    lang,
    codeSubcategory,
    HEADING_NUMBER_TRANSLATIONS,
  )
}

/** Per-heading explanatory tooltip — shown next to the TOC row when an
 *  editorial decision needs surfacing to readers. Currently only used
 *  for "Chapitre Préliminaire", where the 1987 amendment that added
 *  the Conseil Constitutionnel didn't specify a chapter number or
 *  title; the literal word "Préliminaire" is an editorial choice.
 *
 *  Keyed on the heading's ``number`` (case-insensitive). Returns the
 *  bilingual copy as a record so the caller can pick the active
 *  language at render time. */
const HEADING_TOOLTIPS: Record<string, { fr: string; ht: string }> = {
  préliminaire: {
    fr:
      "Le chapitre est désigné comme « Préliminaire » par choix éditorial : " +
      "la loi constitutionnelle qui a ajouté ce chapitre ne précise ni " +
      "numéro ni titre pour la section consacrée au Conseil Constitutionnel.",
    ht:
      "Yo rele chapit sa a « Preliminè » dapre yon chwa editoryal : lwa " +
      "konstitisyonèl ki te ajoute chapit sa a pa presize ni nimewo ni tit " +
      "pou seksyon ki konsène Konsèy Konstitisyonèl la.",
  },
}

/** Render the per-language article-number label for a row in the TOC
 *  or the breadcrumb / reader header.
 *
 *  French legal tradition stores the first article as the literal
 *  string ``"premier"`` (and its alinéas as ``premier-1``,
 *  ``premier-2`` …). That spelling has no direct equivalent in Kreyòl:
 *  N° 36-A writes ``Atik 1`` / ``1-1`` in Arabic numerals. We map
 *  the FR canonical number to its HT counterpart here so the TOC,
 *  the reader header, and any breadcrumb stay consistent without
 *  needing per-article ``number_ht`` columns in the DB.
 *
 *  Pre-numbered legacy strings starting with "article" are returned
 *  verbatim — the parser produced them whole and we shouldn't
 *  double-prefix.
 */
function formatArticleNumber(
  rawNumber: string,
  lang: 'fr' | 'ht',
): string {
  const num = rawNumber.trim()
  if (!num) return ''
  if (num.toLowerCase().startsWith('article')) return num
  const prefix = lang === 'ht' ? 'Atik' : 'Art.'
  // "premier" → "1" (HT only). Sub-articles ``premier-N`` → ``1-N``.
  const ht = num === 'premier'
    ? '1'
    : num.startsWith('premier-')
      ? `1-${num.slice('premier-'.length)}`
      : num
  return `${prefix} ${lang === 'ht' ? ht : num}`
}

/** TOC build result. ``roots`` is the heading tree (each node carries
 *  its attached articles + sub-nodes). ``orphans`` is the flat list
 *  of articles with no ``heading_id`` — they render at the very top
 *  of the TOC, *without* a wrapping heading row. (We used to synthesize
 *  a "Dispositions générales" header for them, which surprised editors
 *  who added an article without specifying a section.) */
type TocBuildResult = { roots: TocNode[]; orphans: Article[] }

/** Build a tree from flat headings + attach articles to their heading nodes */
function buildTocTree(headings: Heading[], articles: Article[]): TocBuildResult {
  // Map heading id -> TocNode
  const nodeMap = new Map<number, TocNode>()
  for (const h of headings) {
    nodeMap.set(h.id, { heading: h, articles: [], children: [] })
  }

  // Attach articles to their heading; articles with no/unknown
  // heading_id end up in ``orphans`` and render flat at the TOC root.
  const orphans: Article[] = []
  for (const article of articles) {
    if (article.heading_id && nodeMap.has(article.heading_id)) {
      nodeMap.get(article.heading_id)!.articles.push(article)
    } else {
      orphans.push(article)
    }
  }

  // Build parent-child relationships
  const roots: TocNode[] = []
  for (const h of headings) {
    const node = nodeMap.get(h.id)!
    if (h.parent_id && nodeMap.has(h.parent_id)) {
      nodeMap.get(h.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by position
  const sortNodes = (nodes: TocNode[]) => {
    nodes.sort(
      (a, b) => (a.heading.position ?? 0) - (b.heading.position ?? 0),
    )
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(roots)

  return { roots, orphans }
}

/** Fallback when no headings exist: every article is an orphan. The
 *  previous behaviour synthesised a "Dispositions générales" wrapper
 *  per ``chapter`` string, but the chapter field was rarely populated
 *  and the wrapper was misleading — flat works better. */
function buildFlatGroups(articles: Article[]): TocBuildResult {
  return { roots: [], orphans: articles.slice() }
}

/** Count all articles in a node and its descendants */
function countArticles(node: TocNode): number {
  return (
    node.articles.length +
    node.children.reduce((sum, c) => sum + countArticles(c), 0)
  )
}

/** Collect all articles from a tree (for filtering) */
function collectAllArticles(nodes: TocNode[]): Article[] {
  const result: Article[] = []
  const walk = (n: TocNode) => {
    result.push(...n.articles)
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return result
}

/** Filter tree by search query, returning a new tree with only matching articles */
function filterTree(
  nodes: TocNode[],
  query: string,
  lang: 'fr' | 'ht',
): TocNode[] {
  if (!query.trim()) return nodes
  const q = query.toLowerCase()

  const filterNode = (node: TocNode): TocNode | null => {
    const matchingArticles = node.articles.filter((a) => {
      const title = lang === 'ht' && a.title_ht ? a.title_ht : a.title_fr
      const content =
        lang === 'ht' && a.content_ht ? a.content_ht : a.content_fr
      return (
        a.number?.toLowerCase().includes(q) ||
        title?.toLowerCase().includes(q) ||
        content?.toLowerCase().includes(q)
      )
    })

    const filteredChildren = node.children
      .map(filterNode)
      .filter(Boolean) as TocNode[]

    if (matchingArticles.length === 0 && filteredChildren.length === 0) {
      return null
    }

    return { ...node, articles: matchingArticles, children: filteredChildren }
  }

  return nodes.map(filterNode).filter(Boolean) as TocNode[]
}

export default function TableOfContents({
  articles = [],
  headings = [],
  currentLang = 'fr',
  codeSubcategory = null,
  onArticleSelect,
  onHeadingNavigate,
  selectedArticle,
  externalQuery,
  hasPreamble,
  onPreambleClick,
  hasVisas,
  onVisasClick,
  hasConsiderants,
  onConsiderantsClick,
  isEditor = false,
  onHeadingTitleSave,
  onHeadingDelete,
  onAddSiblingHeading,
  onAddChildHeading,
  onAddRootHeading,
  onReorderHeadings,
  onReorderArticles,
  activeHeadingIds,
}: TableOfContentsProps) {
  // Lookup-friendly set for "is this heading on the active path?"
  // checks during render. Memoised so we don't rebuild it on every
  // mouseenter / keystroke.
  const activePathSet = useMemo(
    () => new Set(activeHeadingIds ?? []),
    [activeHeadingIds],
  )
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})
  const searchQuery = externalQuery ?? ''

  // Inline-edit state for heading titles. Only one heading can be in
  // edit mode at a time — keyed by heading_id so the right row gets
  // its textbox. Local draft is held here, not in the parent — the
  // parent only learns about a change when the editor saves.
  const [editingHeadingId, setEditingHeadingId] = useState<number | null>(null)
  const [headingDraft, setHeadingDraft] = useState<string>('')
  const [headingSaving, setHeadingSaving] = useState<boolean>(false)
  const [headingError, setHeadingError] = useState<string | null>(null)
  // Parallel inline-edit state for heading NUMBER (the "I", "II",
  // "Première"… label rendered next to the level word). Kept separate
  // from the title edit so the editor can change a number without
  // dirtying the title input.
  const [editingNumberHeadingId, setEditingNumberHeadingId] = useState<
    number | null
  >(null)
  const [numberDraft, setNumberDraft] = useState<string>('')
  const [numberSaving, setNumberSaving] = useState<boolean>(false)
  const [numberError, setNumberError] = useState<string | null>(null)
  // Pending-delete state for the heading-delete ConfirmDialog. Set
  // when the editor clicks the Trash icon on a heading row; cleared
  // on confirm or cancel. The dialog mounts once at the bottom of
  // the tree so we don't render one per row.
  const [pendingDelete, setPendingDelete] = useState<Heading | null>(null)
  const [deletingHeading, setDeletingHeading] = useState(false)

  // Per-row lock for the ▲/▼ reorder arrows so a slow PATCH doesn't
  // let the editor queue a second swap on the same row. Keyed by
  // ``"h:<id>"`` for headings, ``"a:<id>"`` for articles. We don't
  // optimistically update — the parent's refetch reseats positions
  // after the PATCH lands, so the buttons stay accurate.
  const [reorderInflight, setReorderInflight] = useState<string | null>(null)

  function startEditHeading(h: Heading) {
    const current =
      (currentLang === 'ht' ? h.title_ht : h.title_fr) ?? ''
    setEditingHeadingId(h.id)
    setHeadingDraft(current)
    setHeadingError(null)
  }
  function cancelEditHeading() {
    setEditingHeadingId(null)
    setHeadingDraft('')
    setHeadingError(null)
  }
  async function saveEditHeading(h: Heading) {
    if (!onHeadingTitleSave) return
    setHeadingSaving(true)
    setHeadingError(null)
    try {
      const field: 'title_fr' | 'title_ht' =
        currentLang === 'ht' ? 'title_ht' : 'title_fr'
      await onHeadingTitleSave(h.id, field, headingDraft.trim())
      cancelEditHeading()
    } catch (e) {
      setHeadingError(e instanceof Error ? e.message : String(e))
    } finally {
      setHeadingSaving(false)
    }
  }

  function startEditNumber(h: Heading) {
    setEditingNumberHeadingId(h.id)
    setNumberDraft((h.number ?? '').trim())
    setNumberError(null)
  }
  function cancelEditNumber() {
    setEditingNumberHeadingId(null)
    setNumberDraft('')
    setNumberError(null)
  }
  async function saveEditNumber(h: Heading) {
    if (!onHeadingTitleSave) return
    setNumberSaving(true)
    setNumberError(null)
    try {
      await onHeadingTitleSave(h.id, 'number', numberDraft.trim())
      cancelEditNumber()
    } catch (e) {
      setNumberError(e instanceof Error ? e.message : String(e))
    } finally {
      setNumberSaving(false)
    }
  }

  // Build the heading tree. ``orphans`` is the flat list of articles
  // with no ``heading_id`` — they render at the top of the TOC without
  // a wrapping heading row.
  const tocTree = useMemo(() => {
    if (headings.length > 0) {
      return buildTocTree(headings, articles)
    }
    return buildFlatGroups(articles)
  }, [headings, articles])

  // Sibling-set maps derived from the *unfiltered* tree — drive the
  // reorder arrows' enabled/disabled state and the permutation
  // payload sent to the backend. We can't rely on the filtered tree
  // because a search query would shrink the sibling set and a
  // partial reorder would be rejected by the API.
  //
  //   headingSiblings: parent_id (null = root)        → ordered TocNode[]
  //   articleSiblings: heading_id (null = orphans)    → ordered Article[]
  const { headingSiblings, articleSiblings } = useMemo(() => {
    const hMap = new Map<number | null, TocNode[]>()
    const aMap = new Map<number | null, Article[]>()
    const walkH = (nodes: TocNode[], parentId: number | null) => {
      // ``nodes`` is already position-sorted by buildTocTree.
      hMap.set(parentId, nodes)
      for (const n of nodes) {
        // Articles directly under this heading — already preserved
        // in the insertion order of ``articles``, which the backend
        // returns sorted by Article.position.
        aMap.set(n.heading.id, n.articles)
        walkH(n.children, n.heading.id)
      }
    }
    walkH(tocTree.roots, null)
    // Orphan articles share the "null heading" bucket with any
    // text-root articles. ``buildFlatGroups`` puts every article
    // into ``orphans`` when no headings exist; the regular tree
    // path leaves ``orphans`` populated only for unattached rows.
    aMap.set(null, tocTree.orphans)
    return { headingSiblings: hMap, articleSiblings: aMap }
  }, [tocTree])

  // Reorder a heading row by ±1 within its sibling set. Builds the
  // full permutation from the sibling map (not the filtered tree),
  // skips no-op moves at the boundary, and relays the IDs to the
  // parent so it can PATCH the API and refetch the law. The inflight
  // lock keys off ``h:<id>`` so the same row can't queue a second
  // swap until the first lands.
  async function moveHeadingBy(node: TocNode, delta: -1 | 1) {
    if (!onReorderHeadings) return
    const parentId = node.heading.parent_id ?? null
    const siblings = headingSiblings.get(parentId) ?? []
    const idx = siblings.findIndex((n) => n.heading.id === node.heading.id)
    const target = idx + delta
    if (idx < 0 || target < 0 || target >= siblings.length) return
    const reordered = siblings.slice()
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(target, 0, moved)
    const orderedIds = reordered.map((n) => n.heading.id)
    const key = `h:${node.heading.id}`
    setReorderInflight(key)
    try {
      await onReorderHeadings(parentId, orderedIds)
    } finally {
      setReorderInflight((current) => (current === key ? null : current))
    }
  }

  // Reorder an article row by ±1 within its heading bucket. Same
  // shape as moveHeadingBy: build the full permutation from the
  // unfiltered bucket, refuse no-op boundary moves, relay to the
  // parent. headingId is null for the text-root / orphan bucket.
  async function moveArticleBy(article: Article, delta: -1 | 1) {
    if (!onReorderArticles) return
    const headingId = article.heading_id ?? null
    const bucket = articleSiblings.get(headingId) ?? []
    const idx = bucket.findIndex((a) => a.id === article.id)
    const target = idx + delta
    if (idx < 0 || target < 0 || target >= bucket.length) return
    const reordered = bucket.slice()
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(target, 0, moved)
    const orderedIds = reordered.map((a) => a.id)
    const key = `a:${article.id}`
    setReorderInflight(key)
    try {
      await onReorderArticles(headingId, orderedIds)
    } finally {
      setReorderInflight((current) => (current === key ? null : current))
    }
  }

  // Filter by search — runs over the heading tree only; orphans use a
  // dedicated filter so a search query like "1382" finds an orphan
  // article that no heading contains.
  const filteredTree = useMemo(
    () => filterTree(tocTree.roots, searchQuery, currentLang),
    [tocTree.roots, searchQuery, currentLang],
  )
  const filteredOrphans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tocTree.orphans
    return tocTree.orphans.filter((a) => {
      const title =
        currentLang === 'ht' && a.title_ht ? a.title_ht : a.title_fr
      const content =
        currentLang === 'ht' && a.content_ht ? a.content_ht : a.content_fr
      return (
        a.number?.toLowerCase().includes(q) ||
        title?.toLowerCase().includes(q) ||
        content?.toLowerCase().includes(q)
      )
    })
  }, [tocTree.orphans, searchQuery, currentLang])

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    const keys: Record<string, boolean> = {}
    const walk = (nodes: TocNode[]) => {
      for (const n of nodes) {
        keys[n.heading.key] = true
        walk(n.children)
      }
    }
    walk(tocTree.roots)
    setExpandedSections(keys)
  }

  const collapseAll = () => setExpandedSections({})

  // Accordion-style expansion: when an article is selected, ONLY the
  // headings on the path to that article stay expanded. Every other
  // branch closes. The intent is "let me see exactly where I am, no
  // distractions" — clicking Article 89 in Titre III shouldn't leave
  // Titre II's full subtree open and forcing the user to scroll past
  // it.
  //
  // Manual user actions (toggleSection / expandAll / collapseAll)
  // override the accordion: once you click a chevron to open or close
  // a branch, that survives until the NEXT article selection. The
  // accordion only re-applies when `activeHeadingIds` changes, i.e.
  // when a new article is picked — not on every render.
  React.useEffect(() => {
    if (!activeHeadingIds || activeHeadingIds.length === 0) return
    const idToKey = new Map(headings.map((h) => [h.id, h.key]))
    const activeKeys = new Set(
      activeHeadingIds
        .map((id) => idToKey.get(id))
        .filter((k): k is string => Boolean(k)),
    )
    setExpandedSections(() => {
      const next: Record<string, boolean> = {}
      for (const key of activeKeys) {
        next[key] = true
      }
      return next
    })
  }, [activeHeadingIds, headings])

  // Scroll the selected article into view inside the TOC. Two
  // requestAnimationFrame ticks let React + framer-motion settle the
  // expand-collapse from the accordion effect above before we measure
  // the target's position — otherwise the target is still offscreen
  // (or doesn't yet exist in the DOM) when scrollIntoView fires.
  //
  // ``block: 'center'`` keeps the row visually centred in the scroll
  // viewport with surrounding context — ``nearest`` would skip the
  // scroll when the target is already barely on-screen, which feels
  // sticky when navigating sequentially through articles.
  React.useEffect(() => {
    if (!selectedArticle) return
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.getElementById(`toc-article-${selectedArticle}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [selectedArticle, expandedSections])

  /** Render a single article row — shared between the nested-in-
   *  heading case (renderNode) and the orphan list at the TOC root.
   *  Uses ``role=button`` instead of ``<button>`` so the per-row
   *  reorder arrows (in editor mode) can nest cleanly: a real
   *  ``<button>`` inside another ``<button>`` is invalid HTML and
   *  trips React's hydration check. Keyboard a11y is preserved via
   *  tabIndex + onKeyDown. ``bucketHeadingId`` is the parent
   *  heading id (null for orphans / text-root articles) — drives
   *  boundary detection for the ▲▼ buttons. */
  const renderArticleRow = (article: Article, bucketHeadingId: number | null) => {
    const isSelected = selectedArticle === article.number
    const title =
      currentLang === 'ht' && article.title_ht
        ? article.title_ht
        : article.title_fr

    const bucket = articleSiblings.get(bucketHeadingId) ?? []
    const idx = bucket.findIndex((a) => a.id === article.id)
    const isFirst = idx <= 0
    const isLast = idx < 0 || idx >= bucket.length - 1
    const busy = reorderInflight === `a:${article.id}`
    const showArrows = isEditor && onReorderArticles && !searchQuery

    return (
      <div
        key={article.id}
        id={`toc-article-${article.number}`}
        role="button"
        tabIndex={0}
        onClick={() => onArticleSelect(article)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onArticleSelect(article)
          }
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors group/item cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm ${
          isSelected
            ? 'text-red-600 font-semibold'
            : 'text-gray-600 hover:text-red-600'
        }`}
      >
        <FileText
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isSelected
              ? 'text-red-600'
              : 'text-gray-400 group-hover/item:text-red-600 transition-colors'
          }`}
        />
        <span
          className={`flex-shrink-0 tabular-nums ${
            isSelected ? '' : 'text-gray-900'
          }`}
        >
          {formatArticleNumber(article.number, currentLang)}
        </span>
        {title && (
          <span className="text-xs text-gray-500 truncate min-w-0">
            — {title}
          </span>
        )}
        {showArrows && (
          <span className="ml-auto flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                moveArticleBy(article, -1)
              }}
              disabled={isFirst || busy}
              className="opacity-0 group-hover/item:opacity-100 transition-opacity text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
              aria-label={
                currentLang === 'fr' ? "Monter l'article" : 'Monte atik la'
              }
              title={
                currentLang === 'fr' ? "Monter l'article" : 'Monte atik la'
              }
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                moveArticleBy(article, 1)
              }}
              disabled={isLast || busy}
              className="opacity-0 group-hover/item:opacity-100 transition-opacity text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed"
              aria-label={
                currentLang === 'fr' ? "Descendre l'article" : 'Desann atik la'
              }
              title={
                currentLang === 'fr' ? "Descendre l'article" : 'Desann atik la'
              }
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
    )
  }

  /** Render a single heading node recursively */
  const renderNode = (node: TocNode, depth: number = 0) => {
    const { heading, articles: nodeArticles, children } = node
    const isExpanded = !!expandedSections[heading.key]
    // True when this heading is an ancestor of (or contains) the
    // currently selected article. Used to red-highlight the entire
    // path from the root down to the article, so the user always
    // sees the structural context — like a breadcrumb embedded in
    // the tree, not just on the article row itself.
    const isOnActivePath = activePathSet.has(heading.id)

    const headingLabel =
      currentLang === 'ht' && heading.title_ht
        ? heading.title_ht
        : heading.title_fr
    const headingContent =
      currentLang === 'ht' && heading.content_ht
        ? heading.content_ht
        : heading.content_fr

    // Level-based styling
    const isTopLevel = depth === 0
    const indent = depth > 0 ? `ml-${Math.min(depth * 3, 9)}` : ''

    return (
      <div key={heading.key} className={`mb-1 ${indent}`}>
        {/* Section header — rendered as a button-like div, not a real
            <button>, because in editor mode the row contains inline
            action buttons (pencil to rename, plus to insert sibling).
            A <button> inside a <button> is invalid HTML and trips
            React's hydration check. Keyboard / a11y semantics are
            preserved via role + tabIndex + onKeyDown. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            toggleSection(heading.key)
            onHeadingNavigate?.(heading)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleSection(heading.key)
              onHeadingNavigate?.(heading)
            }
          }}
          className={`w-full flex flex-col gap-1 px-3 py-2 text-left transition-colors group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-sm ${
            isTopLevel ? '' : 'py-1.5'
          }`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-red-600 flex-shrink-0" />
            ) : (
              <ChevronRight
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isOnActivePath
                    ? 'text-red-600'
                    : 'text-gray-400 group-hover:text-red-600'
                }`}
              />
            )}

            <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
              {/* Heading number — inline-editable in editor mode. Click
                  the badge to swap it for a text input; the level label
                  ("Titre", "Chapitre", "Section"…) is re-prefixed
                  client-side in ``formatHeadingNumber`` so the editor
                  only types the number itself ("II", "Première", "1
                  bis", …). */}
              {editingNumberHeadingId === heading.id ? (
                <span
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    value={numberDraft}
                    disabled={numberSaving}
                    onChange={(e) => setNumberDraft(e.target.value)}
                    // Same reason as the title input: stop the
                    // Space-bar (and every other key) from bubbling
                    // to the parent button, which would toggle the
                    // accordion. Numbers can contain spaces too
                    // ("2 bis", "9-1 ter"), so this matters here.
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveEditNumber(heading)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEditNumber()
                      }
                    }}
                    className={`w-20 rounded border border-amber-300 bg-amber-50/50 px-1.5 py-0.5 font-black uppercase tracking-widest text-slate-800 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
                      isTopLevel ? 'text-xs' : 'text-[10px]'
                    }`}
                    placeholder={currentLang === 'fr' ? 'II' : 'II'}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      saveEditNumber(heading)
                    }}
                    disabled={numberSaving}
                    className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    aria-label={
                      currentLang === 'fr' ? 'Enregistrer' : 'Anrejistre'
                    }
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      cancelEditNumber()
                    }}
                    disabled={numberSaving}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    aria-label={currentLang === 'fr' ? 'Annuler' : 'Anile'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (heading.number || isEditor) ? (
                <span
                  className={`group/num inline-flex items-center gap-1 font-black uppercase tracking-widest transition-colors flex-shrink-0 ${
                    isTopLevel ? 'text-xs' : 'text-[10px]'
                  } ${
                    isOnActivePath
                      ? 'text-red-600'
                      : 'text-gray-900 group-hover:text-red-600'
                  }`}
                >
                  {heading.number ? (
                    formatHeadingNumber(
                      heading.level,
                      heading.number,
                      currentLang,
                      codeSubcategory,
                    )
                  ) : (
                    <span className="italic text-slate-400 normal-case tracking-normal">
                      {currentLang === 'fr'
                        ? '(sans numéro)'
                        : '(san nimewo)'}
                    </span>
                  )}
                  {isEditor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditNumber(heading)
                      }}
                      className="opacity-0 group-hover/num:opacity-100 transition-opacity text-slate-400 hover:text-primary"
                      title={
                        currentLang === 'fr'
                          ? 'Modifier le numéro de la section'
                          : 'Modifye nimewo seksyon an'
                      }
                      aria-label={
                        currentLang === 'fr'
                          ? 'Modifier le numéro'
                          : 'Modifye nimewo a'
                      }
                    >
                      <PenLine className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ) : null}
              {/* Editorial-decision tooltip — surfaces only on rows
                  whose ``number`` is in HEADING_TOOLTIPS (currently
                  just "Préliminaire" for TIT VI's Conseil
                  Constitutionnel chapter). Click target is a tiny
                  info dot so it doesn't compete with the section's
                  primary click action. ``e.stopPropagation`` keeps
                  the row's toggle from firing when the user opens
                  the tooltip. */}
              {(() => {
                const tooltipKey = (heading.number ?? '').trim().toLowerCase()
                const tip = HEADING_TOOLTIPS[tooltipKey]
                if (!tip) return null
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center text-slate-400 hover:text-primary cursor-help flex-shrink-0"
                        aria-label={
                          currentLang === 'fr'
                            ? "Pourquoi 'Préliminaire' ?"
                            : "Poukisa 'Preliminè' ?"
                        }
                      >
                        <Info className="w-3 h-3" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-xs text-xs leading-relaxed"
                    >
                      {tip[currentLang]}
                    </TooltipContent>
                  </Tooltip>
                )
              })()}
              {heading.number && (headingLabel || isEditor) && (
                <span
                  className="text-gray-300 flex-shrink-0 text-[10px]"
                  aria-hidden
                >
                  ·
                </span>
              )}
              {editingHeadingId === heading.id ? (
                /* Inline edit mode for this heading title. Clicking
                   inside doesn't propagate to the toggle button. */
                <span
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    autoFocus
                    value={headingDraft}
                    disabled={headingSaving}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    // Stop *all* keydowns from bubbling up to the
                    // parent <div role="button"> wrapper — otherwise
                    // pressing Space inside the input toggles the
                    // accordion (the wrapper handles Space/Enter as
                    // "open/close section"). Enter + Escape get
                    // their own handling here.
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveEditHeading(heading)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEditHeading()
                      }
                    }}
                    className="flex-1 min-w-0 rounded-md border border-amber-300 bg-amber-50/50 px-2 py-1 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder={
                      currentLang === 'fr'
                        ? 'Titre de la section…'
                        : 'Tit seksyon an…'
                    }
                  />
                  <button
                    type="button"
                    onClick={() => saveEditHeading(heading)}
                    disabled={headingSaving}
                    className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    aria-label={currentLang === 'fr' ? 'Enregistrer' : 'Sove'}
                  >
                    {headingSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditHeading}
                    disabled={headingSaving}
                    className="text-slate-400 hover:text-red-600 disabled:opacity-50"
                    aria-label={currentLang === 'fr' ? 'Annuler' : 'Anile'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ) : (
                <>
                  {headingLabel ? (
                    <span
                      className={`text-sm font-semibold transition-colors line-clamp-2 min-w-0 ${
                        isOnActivePath
                          ? 'text-red-600'
                          : 'text-gray-700 group-hover:text-red-600'
                      }`}
                    >
                      {headingLabel}
                      {/* Page is Kreyòl but this heading only has a
                          French title → flag the fallback so editors
                          and readers know it isn't translated yet. */}
                      {currentLang === 'ht' && !heading.title_ht && heading.title_fr && (
                        <span
                          className="ml-1.5 inline-flex align-middle text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1 py-0 cursor-help"
                          title="Poko tradwi an kreyòl"
                        >
                          FR
                        </span>
                      )}
                    </span>
                  ) : isEditor ? (
                    /* Editor sees a placeholder for missing title so
                       they can click to add one — the parser sometimes
                       finds the number but not the title (truncated
                       OCR). */
                    <span className="text-sm italic text-slate-400 line-clamp-2 min-w-0">
                      {currentLang === 'fr' ? 'Sans titre' : 'San tit'}
                    </span>
                  ) : null}
                  {isEditor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditHeading(heading)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary flex-shrink-0"
                      aria-label={
                        currentLang === 'fr'
                          ? 'Modifier le titre'
                          : 'Modifye tit la'
                      }
                    >
                      <PenLine className="w-3 h-3" />
                    </button>
                  )}
                  {isEditor && onAddSiblingHeading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddSiblingHeading(heading)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 flex-shrink-0"
                      aria-label={
                        currentLang === 'fr'
                          ? 'Ajouter une section après celle-ci'
                          : 'Ajoute yon seksyon apre sa'
                      }
                      title={
                        currentLang === 'fr'
                          ? 'Ajouter une section après celle-ci (parser-cleanup)'
                          : 'Ajoute yon seksyon apre sa (netwaye pasè)'
                      }
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                  {isEditor && onHeadingDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete(heading)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 flex-shrink-0"
                      aria-label={
                        currentLang === 'fr'
                          ? 'Supprimer cette section'
                          : 'Efase seksyon sa'
                      }
                      title={
                        currentLang === 'fr'
                          ? 'Supprimer (parser-cleanup)'
                          : 'Efase (netwaye pasè)'
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {/* Reorder arrows — editor-only. Hidden while a
                      sidebar search query is active (we'd be
                      reordering only the visible siblings, which the
                      backend would reject as a partial permutation).
                      The disabled state at the sibling boundary keeps
                      keyboard / pointer users from no-op clicks. */}
                  {isEditor && onReorderHeadings && !searchQuery && (() => {
                    const siblings =
                      headingSiblings.get(heading.parent_id ?? null) ?? []
                    const idx = siblings.findIndex(
                      (n) => n.heading.id === heading.id,
                    )
                    const isFirst = idx <= 0
                    const isLast = idx < 0 || idx >= siblings.length - 1
                    const busy = reorderInflight === `h:${heading.id}`
                    return (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveHeadingBy(node, -1)
                          }}
                          disabled={isFirst || busy}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed flex-shrink-0"
                          aria-label={
                            currentLang === 'fr'
                              ? 'Monter cette section'
                              : 'Monte seksyon sa'
                          }
                          title={
                            currentLang === 'fr'
                              ? 'Monter dans le sommaire'
                              : 'Monte nan somè a'
                          }
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            moveHeadingBy(node, 1)
                          }}
                          disabled={isLast || busy}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400 disabled:cursor-not-allowed flex-shrink-0"
                          aria-label={
                            currentLang === 'fr'
                              ? 'Descendre cette section'
                              : 'Desann seksyon sa'
                          }
                          title={
                            currentLang === 'fr'
                              ? 'Descendre dans le sommaire'
                              : 'Desann nan somè a'
                          }
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )
                  })()}
                </>
              )}
            </div>

          </div>

          {headingError && editingHeadingId === heading.id && (
            <p className="text-[11px] text-red-600 ml-6">{headingError}</p>
          )}
          {numberError && editingNumberHeadingId === heading.id && (
            <p className="text-[11px] text-red-600 ml-6">{numberError}</p>
          )}

          {headingContent && isExpanded && (
            <p className="ml-6 text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
              {headingContent}
            </p>
          )}
        </div>

        {/* Expanded content: articles + child headings */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Direct articles */}
              {nodeArticles.length > 0 && (
                <div className="ml-6 mt-1 mb-2">
                  {nodeArticles.map((article) =>
                    renderArticleRow(article, heading.id),
                  )}
                </div>
              )}

              {/* Child heading nodes (recursive) */}
              {children.length > 0 && (
                <div className="ml-2">
                  {children.map((child) => renderNode(child, depth + 1))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col max-w-full">
      {/* Header */}
      <div className="pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {currentLang === 'fr' ? 'Sommaire' : 'Somè'}
          </div>
          <div className="flex items-center gap-2">
            {/* Editor-only "Add at root" — opens the AddHeadingDialog
                with no anchor, creating a new top-level Titre / Livre /
                Partie. Sub-headings get their own + button on hover. */}
            {isEditor && onAddRootHeading && (
              <button
                onClick={onAddRootHeading}
                className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                title={
                  currentLang === 'fr'
                    ? 'Ajouter une section à la racine'
                    : 'Ajoute yon seksyon nan rasin'
                }
                aria-label={
                  currentLang === 'fr'
                    ? 'Ajouter une section à la racine'
                    : 'Ajoute yon seksyon nan rasin'
                }
              >
                <Plus className="w-3 h-3 text-emerald-600" />
              </button>
            )}
            <button
              onClick={expandAll}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title={currentLang === 'fr' ? 'Tout ouvrir' : 'Ouvri tout'}
            >
              <Maximize2 className="w-3 h-3 text-gray-500" />
            </button>
            <button
              onClick={collapseAll}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title={currentLang === 'fr' ? 'Tout fermer' : 'Fèmen tout'}
            >
              <Minimize2 className="w-3 h-3 text-gray-500" />
            </button>
          </div>
        </div>

      </div>

      {/* Tree */}
      <ScrollArea className="flex-1">
        <div className="pt-3">
          {hasPreamble && onPreambleClick && (
            <button
              onClick={onPreambleClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:text-red-600 transition-colors mb-1"
            >
              <ChevronRight className="w-4 h-4 text-red-600 flex-shrink-0" />
              {/* Kreyòl: "Premye koze" is the canonical translation
                  used in N° 36-A — keep them aligned. The previous
                  "Preanmbil" was a literal anglicisation that doesn't
                  match the Konstitisyon's own wording. */}
              <span>{currentLang === 'fr' ? 'Préambule' : 'Premye koze'}</span>
            </button>
          )}
          {hasVisas && onVisasClick && (
            <button
              onClick={onVisasClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:text-red-600 transition-colors mb-1 ml-3"
            >
              <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {/* Kreyòl uses "Viza" (z, not s) — matches the
                  Konstitisyon's own orthography. */}
              <span>{currentLang === 'fr' ? 'Visas' : 'Viza'}</span>
            </button>
          )}
          {hasConsiderants && onConsiderantsClick && (
            <button
              onClick={onConsiderantsClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:text-red-600 transition-colors mb-1 ml-3"
            >
              <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>{currentLang === 'fr' ? 'Considérants' : 'Konsideran'}</span>
            </button>
          )}
          {/* Orphan articles — sit at the top of the TOC scroll area,
              with no wrapping heading row. Used to be a synthetic
              "Dispositions générales" group; that was misleading
              because the title was made up by the renderer. Each row
              is the same button used inside renderNode for attached
              articles. */}
          {filteredOrphans.length > 0 && (
            <div className="mb-3">
              {filteredOrphans.map((article) => renderArticleRow(article, null))}
            </div>
          )}
          {filteredTree.length > 0 ? (
            filteredTree.map((node) => renderNode(node, 0))
          ) : filteredOrphans.length === 0 ? (
            <div className="animate-in fade-in duration-500 p-8 text-center text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {currentLang === 'fr'
                  ? 'Aucun article trouvé'
                  : 'Pa gen atik jwenn'}
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Heading-delete confirm. Two stages baked in:
          1. Default — if the heading has child articles / sub-headings,
             confirm with ``reparentChildren=true`` so the contents
             survive (lifted to the parent).
          2. Empty heading — same dialog, but the body just says it's
             empty and the cascade flag is a no-op. */}
      {onHeadingDelete && (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(o) => {
            if (!o && !deletingHeading) setPendingDelete(null)
          }}
          onConfirm={async () => {
            if (!pendingDelete) return
            setDeletingHeading(true)
            try {
              // Default cascade: reparent. Editor would have to drag
              // contents elsewhere first if they wanted a subtree
              // wipe (not supported through this surface).
              await onHeadingDelete(pendingDelete.id, true)
              setPendingDelete(null)
            } finally {
              setDeletingHeading(false)
            }
          }}
          title={
            currentLang === 'fr'
              ? `Supprimer « ${pendingDelete?.title_fr ?? pendingDelete?.number ?? ''} » ?`
              : `Efase « ${pendingDelete?.title_fr ?? pendingDelete?.number ?? ''} » ?`
          }
          description={
            currentLang === 'fr'
              ? "Les articles et sous-sections de cette section seront déplacés vers la section parente (sans perte). La section elle-même sera supprimée."
              : 'Atik ak sou-seksyon yo pral deplase nan seksyon paran an (san pèdi). Seksyon an menm pral efase.'
          }
          confirmLabel={
            currentLang === 'fr' ? 'Supprimer' : 'Efase'
          }
          cancelLabel={currentLang === 'fr' ? 'Annuler' : 'Anile'}
          destructive
          loading={deletingHeading}
        />
      )}
    </div>
  )
}
