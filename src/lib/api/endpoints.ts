/**
 * Typed wrappers around the LexHaïti API.
 *
 * Base URL is configured via `NEXT_PUBLIC_API_URL` (see .env.local), default
 * `http://localhost:8000/api/v1`. All paths here are relative to that base.
 */
import type { components, paths } from '@/lib/api-types'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api/client'

// Re-exported types — what consumers reach for.
export type LegalTextRead = components['schemas']['LegalTextRead']
export type LegalTextListItem = components['schemas']['LegalTextListItem']
export type ArticleListItem = components['schemas']['ArticleListItem']
export type ArticleWithHistoryRead =
  components['schemas']['ArticleWithHistoryRead']
export type TocNode = components['schemas']['TocNode']
export type PaginatedListResponse =
  components['schemas']['PaginatedResponse_LegalTextListItem_']
export type PaginatedArticlesResponse =
  components['schemas']['PaginatedResponse_ArticleListItem_']
export type PaginatedSearchResponse =
  components['schemas']['PaginatedSearchResponse']
export type SearchHit = components['schemas']['SearchHit']
export type GlobalSearchResponse =
  components['schemas']['GlobalSearchResponse']
export type LegalCategory = components['schemas']['LegalCategory']

/** Which parser strategy runs on a normalised document. Mirrors the
 *  backend ParserProfile enum. NULL on a MoniteurEntry means "auto-pick
 *  from detected_category at parse time". */
export type ParserProfile =
  | 'generic'
  | 'constitution'
  | 'code'
  | 'loi'
  | 'executive_act'
  | 'circulaire'
  | 'communique'
export type CodeSubcategory = components['schemas']['CodeSubcategory']
export type LegalStatus = components['schemas']['LegalStatus']
export type DecisionListItem = components['schemas']['DecisionListItem']
export type DecisionRead = components['schemas']['DecisionRead']
export type PaginatedDecisionsResponse =
  components['schemas']['PaginatedResponse_DecisionListItem_']
export type CitationRead = components['schemas']['CitationRead']
export type CitationNodeType = components['schemas']['CitationNodeType']
export type CitationRelation = components['schemas']['CitationRelation']
export type PaginatedCitationsResponse =
  components['schemas']['PaginatedResponse_CitationRead_']
export type CourtType = components['schemas']['CourtType']

// -----------------------------------------------------------------------
// Legal texts
// -----------------------------------------------------------------------

/**
 * Batch-resolve article IDs → parent-text label + permalink. Used by the
 * citation panel for cross-text references (where the local sibling list
 * doesn't have a hit). Returns a partial list — IDs that don't exist are
 * silently dropped, never throw.
 */
export type ArticleResolved = {
  id: number
  number: string
  slug: string
  text_id: number
  text_slug: string
  text_title_fr: string
}

export async function resolveArticles(ids: number[]) {
  if (ids.length === 0) return [] as ArticleResolved[]
  return apiGet<ArticleResolved[]>('/articles/resolve', {
    params: { ids: ids.join(',') },
  })
}

/**
 * Sort keys accepted by the legal-texts list endpoint — extracted from
 * the regenerated OpenAPI spec so a backend addition (or removal)
 * surfaces here as a TS error instead of silently drifting.
 */
export type LegalTextSort = NonNullable<
  NonNullable<
    paths['/api/v1/legal-texts']['get']['parameters']['query']
  >['sort']
>

/**
 * Where the `q` text is matched. Mirrors the backend Literal in
 * api/routes/legal_texts.py — pulled from the OpenAPI spec.
 */
export type LegalTextQField = NonNullable<
  NonNullable<
    paths['/api/v1/legal-texts']['get']['parameters']['query']
  >['q_field']
>

/**
 * How the `q` text is matched (all words / exact / any / exclude).
 */
export type LegalTextQMode = NonNullable<
  NonNullable<
    paths['/api/v1/legal-texts']['get']['parameters']['query']
  >['q_mode']
>

/**
 * Multi-criterion advanced search. Each criterion has an operator
 * (AND / OR / NOT, ignored on the first), a field selector, a mode,
 * and the search text. Composed server-side with proper SQL — the
 * previous /recherche/avancee implementation composed OR / NOT rows
 * client-side which truncated past `limit=100`.
 */
export type AdvancedSearchCriterion =
  components['schemas']['AdvancedSearchCriterion']
export type AdvancedSearchInput =
  components['schemas']['AdvancedSearchInput']

export async function advancedSearchTexts(payload: AdvancedSearchInput) {
  return apiPost<PaginatedListResponse>(
    '/legal-texts/advanced-search',
    payload,
  )
}

/** Paginated list of legal texts with optional filters and free-text query. */
export async function listTexts(params?: {
  q?: string
  /** Where to match `q` — defaults to 'all' (titles + descriptions + Moniteur ref). */
  q_field?: LegalTextQField
  /** How to match `q` — all words / exact / any / exclude. Defaults to 'all'. */
  q_mode?: LegalTextQMode
  category?: LegalCategory
  code_subcategory?: CodeSubcategory
  status?: LegalStatus
  /** One or more theme tags. ANY-match — repeat for multi-theme. */
  theme?: string[]
  /** Inclusive year range applied against publication_date. */
  year_from?: number
  year_to?: number
  sort?: LegalTextSort
  /**
   * When true and q is set with q_field=all, each item gets up to 2
   * highlighted article snippets (`<mark>...</mark>`) showing where the
   * query matched in the article body.
   */
  with_snippets?: boolean
  limit?: number
  offset?: number
}) {
  return apiGet<PaginatedListResponse>('/legal-texts', { params })
}

/**
 * Hybrid lexical search across legal-text titles and article content.
 * Returns ranked texts with up to 3 highlighted article snippets each.
 */
export async function searchTexts(params: {
  q: string
  category?: LegalCategory
  code_subcategory?: CodeSubcategory
  status?: LegalStatus
  limit?: number
  offset?: number
}): Promise<PaginatedSearchResponse> {
  return apiGet<PaginatedSearchResponse>('/legal-texts/search', { params })
}

/**
 * Cross-entity search — returns matching laws (with article snippets) +
 * matching Moniteur issues in a single call. Backs the landing-page
 * hero search and the dedicated `/recherche` results page.
 */
export async function globalSearch(params: {
  q: string
  legal_text_limit?: number
  moniteur_issue_limit?: number
}): Promise<GlobalSearchResponse> {
  return apiGet<GlobalSearchResponse>('/search', { params })
}

/** Detail by slug. `include` controls how much of the related graph loads. */
export async function getTextBySlug(slug: string, include?: 'toc' | 'all') {
  return apiGet<LegalTextRead>(
    `/legal-texts/${encodeURIComponent(slug)}`,
    { params: { include } },
  )
}

/** Headings tree (sidebar TOC). */
export async function getTextToc(slug: string) {
  return apiGet<TocNode[]>(
    `/legal-texts/${encodeURIComponent(slug)}/toc`,
  )
}

// -----------------------------------------------------------------------
// Articles
// -----------------------------------------------------------------------

export type ArticleVersionRead = components['schemas']['ArticleVersionRead']

/** Just the version timeline for a single article — sorted by
 *  ``version_number``. Cheaper than ``getArticle`` when the caller
 *  only needs the history (Versions accordion, amending-law panel). */
export async function listArticleVersions(articleId: number) {
  return apiGet<ArticleVersionRead[]>(`/articles/${articleId}/versions`)
}

/** Friendly cross-references shape served by the backend's
 *  ``/articles/{id}/references`` endpoint — link cards with kind +
 *  title + href, resolved server-side from the polymorphic
 *  ``citations`` table so the public UI doesn't have to fan out N
 *  follow-up fetches. */
export type ArticleRefKind = 'decision' | 'law' | 'article'

export interface ArticleRefItem {
  kind: ArticleRefKind
  title: string
  href: string
  note?: string | null
  decision_date?: string | null
}

export interface ArticleReferences {
  cited_by: ArticleRefItem[]
  cites: ArticleRefItem[]
}

/** Two-column "Cité par / Cite" payload for an article. Returns
 *  both lists empty when no edges exist — the panel renders nothing
 *  in that case. */
export async function getArticleReferences(articleId: number) {
  return apiGet<ArticleReferences>(`/articles/${articleId}/references`)
}

/** Editor input for the "add a new version" flow on an article.
 *  ``source_legal_text_id`` is mandatory — every new version anchors
 *  to the law that caused the change so the bidirectional history
 *  graph (LegalChange) is queryable from either end. */
export type ArticleVersionAddInput = {
  text_fr: string
  text_ht?: string | null
  title_fr?: string | null
  title_ht?: string | null
  /** ISO yyyy-mm-dd. Falls back to the amending law's promulgation /
   *  publication date server-side when omitted. */
  effective_from?: string | null
  source_legal_text_id: number
  source_article_id?: number | null
  comment?: string | null
}

/** Add a new version of an article caused by an amending legal text.
 *  Creates the ArticleVersion + the LegalChange graph row in one
 *  transaction. The new version becomes the article's current version. */
export async function addArticleVersion(
  articleId: number,
  body: ArticleVersionAddInput,
) {
  return apiPost<ArticleVersionRead>(
    `/editorial/articles/${articleId}/versions`,
    body,
  )
}

/** Editor input for inserting a brand-new article into a legal text.
 *  Two modes share this shape:
 *  - amendment (``source_legal_text_id`` set) — anchored to a
 *    modifying law, writes a LegalChange row server-side.
 *  - parser-correction (``source_legal_text_id`` null) — the article
 *    was always in the original text, OCR/parser missed it. */
export type ArticleInsertInput = {
  number: string
  title_fr?: string | null
  title_ht?: string | null
  text_fr: string
  text_ht?: string | null
  after_article_id?: number | null
  heading_id?: number | null
  effective_from?: string | null
  source_legal_text_id?: number | null
  source_article_id?: number | null
  comment?: string | null
}

/** Insert a new article (typically "9-1" or "9 bis") into a legal
 *  text. Two modes:
 *  - With ``source_legal_text_id`` ⇒ amendment introduction
 *    (writes a LegalChange with ``change_kind=add``).
 *  - Without ⇒ parser-correction: the article was always in the
 *    original text but the OCR/parser missed it. No LegalChange. */
export async function insertArticle(
  slug: string,
  body: ArticleInsertInput,
) {
  return apiPost<ArticleEmbed>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/articles`,
    body,
  )
}

export type BulkArticleItem = {
  number: string
  title_fr?: string | null
  title_ht?: string | null
  text_fr: string
  text_ht?: string | null
  effective_from?: string | null
  source_article_id?: number | null
  comment?: string | null
}

export type ArticlesBulkInsertInput = {
  /** Heading id — server resolves the heading row. */
  heading_id?: number | null
  /** Heading key — alternative to ``heading_id`` for paste-from-JSON
   *  flows where the editor knows the structural key (e.g.
   *  ``"titre-viii"``) but not the row id. */
  heading_key?: string | null
  /** Anchor article id — first item slots right after it; later items
   *  chain. Mutually exclusive with the heading inputs above. */
  after_article_id?: number | null
  items: BulkArticleItem[]
  /** Shared provenance — applied to every item. Omit ⇒ parser-
   *  correction (no LegalChange rows). */
  source_legal_text_id?: number | null
}

/** Insert MANY articles into a legal text in a single atomic batch.
 *  Designed for the "paste 10 articles of Titre VIII" workflow:
 *  every item is anchored to the same heading and chained in
 *  document order. Atomic — any failure rolls back the whole batch.
 *  See ``POST /editorial/legal-texts/{slug}/articles/bulk``.
 *
 *  Pass ``heading_id: null`` (or omit it entirely along with
 *  ``heading_key``/``after_article_id``) to insert at the text root —
 *  used for proclamations / discours that have no structural TOC. */
export async function bulkInsertArticles(
  slug: string,
  body: ArticlesBulkInsertInput,
) {
  return apiPost<ArticleEmbed[]>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/articles/bulk`,
    body,
  )
}

export type BulkHeadingItem = {
  key: string
  level: 'part' | 'book' | 'title' | 'chapter' | 'section' | 'subsection'
  number?: string | null
  title_fr?: string | null
  title_ht?: string | null
  content_fr?: string | null
  content_ht?: string | null
  /** Reference another heading's ``key`` (existing in the text OR
   *  another item earlier in this same batch) to nest under it. */
  parent_key?: string | null
}

export type HeadingsBulkInsertInput = {
  /** Batch-level anchor — applied to every item that doesn't have
   *  its own ``parent_key``. */
  parent_id?: number | null
  after_heading_id?: number | null
  items: BulkHeadingItem[]
}

/** Insert MANY structural headings (titres / chapitres / sections)
 *  into a legal text in one atomic batch. Items can reference each
 *  other via ``parent_key`` so a single payload can describe a full
 *  nested TOC (titre + child sections + sub-sections).
 *  See ``POST /editorial/legal-texts/{slug}/headings/bulk``. */
export async function bulkInsertHeadings(
  slug: string,
  body: HeadingsBulkInsertInput,
) {
  return apiPost<components['schemas']['LegalHeadingRead'][]>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/headings/bulk`,
    body,
  )
}

export type AmendmentBulkInput = components['schemas']['AmendmentBulkInput']
export type AmendmentBulkResult = components['schemas']['AmendmentBulkResult']
export type AmendmentApplied = components['schemas']['AmendmentApplied']
export type AmendmentItem = components['schemas']['AmendmentItem']

/** Apply N amendments declared by an amending legal text. Idempotent —
 *  rows where ``(amending_text_id, amended_article_id)`` already has a
 *  ``LegalChange`` row come back as ``already_applied=true``.
 *  See ``POST /editorial/legal-texts/{amending_slug}/amendments/bulk``. */
export async function applyAmendmentsBulk(
  amendingSlug: string,
  body: AmendmentBulkInput,
) {
  return apiPost<AmendmentBulkResult>(
    `/editorial/legal-texts/${encodeURIComponent(amendingSlug)}/amendments/bulk`,
    body,
  )
}

/** Hard-delete an article + its versions + any LegalChange rows
 *  pointing at it. Used for parser-error cleanup (phantom articles).
 *  Irreversible — caller is responsible for the confirm dialog. */
export async function deleteArticle(articleId: number): Promise<void> {
  return apiDelete(`/editorial/articles/${articleId}`)
}

/** Delete one version of an article's timeline. Rejects deletion of
 *  the only remaining version (use ``deleteArticle`` for that). If
 *  the deleted version was the current one, the highest-numbered
 *  remaining version is promoted server-side. */
export async function deleteArticleVersion(
  articleId: number,
  versionId: number,
): Promise<void> {
  return apiDelete(
    `/editorial/articles/${articleId}/versions/${versionId}`,
  )
}

/** Delete a TOC heading (Titre / Chapitre / Section / …).
 *  When ``reparent_children=true``, the heading's articles +
 *  sub-headings are lifted to its parent before deletion; when
 *  false (default), a non-empty heading is rejected so the editor
 *  consciously opts into a cascade. */
export async function deleteHeading(
  headingId: number,
  opts?: { reparentChildren?: boolean },
): Promise<void> {
  const qs = opts?.reparentChildren ? '?reparent_children=true' : ''
  return apiDelete(`/editorial/headings/${headingId}${qs}`)
}

// -----------------------------------------------------------------------
// "Partie finale" sections — editor-added labelled rich-text blocks
// (résolution, ratification, acte de promulgation, approbation, autre)
// rendered after the articles.
// -----------------------------------------------------------------------

export type LegalTextSectionRead = components['schemas']['LegalTextSectionRead']
export type SectionType = LegalTextSectionRead['section_type']

/** Default bilingual label per section type — used when a section has no
 *  explicit ``label_*`` override (``autre`` always needs its own). */
export const SECTION_TYPE_LABELS: Record<
  SectionType,
  { fr: string; ht: string }
> = {
  promulgation: { fr: 'Acte de promulgation', ht: 'Akt pwomilgasyon' },
  adoption: { fr: 'Adoption', ht: 'Adopsyon' },
  ratification: { fr: 'Ratification', ht: 'Ratifikasyon' },
  resolution: { fr: 'Résolution', ht: 'Rezolisyon' },
  approbation: {
    fr: 'Approbation / Mention finale',
    ht: 'Apwobasyon / Mansyon final',
  },
  autre: { fr: 'Autre', ht: 'Lòt' },
}

/** Resolve a section's display label: explicit override → per-type
 *  default. */
export function sectionLabel(
  section: Pick<LegalTextSectionRead, 'section_type' | 'label_fr' | 'label_ht'>,
  lang: 'fr' | 'ht',
): string {
  const override = lang === 'ht' ? section.label_ht : section.label_fr
  if (override && override.trim()) return override
  const fallbackFr = section.label_fr
  if (lang === 'ht' && fallbackFr && fallbackFr.trim()) return fallbackFr
  return SECTION_TYPE_LABELS[section.section_type]?.[lang] ?? ''
}

export type LegalTextSectionInput = {
  section_type?: SectionType
  label_fr?: string | null
  label_ht?: string | null
  content_fr?: string
  content_ht?: string | null
  position?: number | null
}

export type LegalTextSectionPatch = Partial<LegalTextSectionInput>

export async function createSection(
  slug: string,
  body: LegalTextSectionInput,
) {
  return apiPost<LegalTextSectionRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/sections`,
    body,
  )
}

export async function updateSection(
  sectionId: number,
  patch: LegalTextSectionPatch,
) {
  return apiPatch<LegalTextSectionRead>(
    `/editorial/sections/${sectionId}`,
    patch,
  )
}

export async function deleteSection(sectionId: number): Promise<void> {
  return apiDelete(`/editorial/sections/${sectionId}`)
}

/** Reorder a text's sections — ``order`` is the desired sequence of
 *  section IDs, top-to-bottom (must cover the set exactly). */
export async function reorderSections(slug: string, order: number[]) {
  return apiPatch<LegalTextSectionRead[]>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/sections/reorder`,
    { order },
  )
}

// -----------------------------------------------------------------------
// Formal-block versions (preamble / visas / considérants / enacting)
// -----------------------------------------------------------------------

/** Versionable formal-block kinds — subset of the backend BlockKind
 *  enum. The other BlockKind values (``structural``, ``signature_block``,
 *  …) belong to the TocNode usage and don't have a versions table. */
export type FormalBlockKind =
  | 'preamble'
  | 'visa'
  | 'considerant'
  | 'enacting_formula'

/** One row of a formal block's version timeline. Derived from the
 *  OpenAPI spec so backend additions flow through automatically. */
export type BlockVersionRead = components['schemas']['BlockVersionRead']

/** Version history for a formal block — newest first. */
export async function listBlockVersions(slug: string, kind: FormalBlockKind) {
  return apiGet<BlockVersionRead[]>(
    `/legal-texts/${encodeURIComponent(slug)}/blocks/${kind}/versions`,
  )
}

/** Editor input for adding a new version of a formal block, anchored
 *  to an amending legal text. */
export type BlockVersionAddInput = {
  text_fr?: string | null
  text_ht?: string | null
  effective_from?: string | null
  source_legal_text_id: number
  comment?: string | null
}

/** Add a new version of a formal block. Creates a LegalChange row
 *  with ``amended_block_kind=<kind>`` so the amending law's
 *  Modifications panel picks it up. */
export async function addBlockVersion(
  slug: string,
  kind: FormalBlockKind,
  body: BlockVersionAddInput,
) {
  return apiPost<BlockVersionRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/blocks/${kind}/versions`,
    body,
  )
}


/** One change this legal text made to an article *or* a formal
 *  block in another text. Powers the "Modifications apportées" panel
 *  on an amending law's detail page. Exactly one target group is
 *  populated per row — article (``amended_article_*``) or block
 *  (``amended_block_kind`` + ``new_block_version_*``). */
export type LegalChangeMadeRead = {
  id: number
  change_kind: string
  effective_on: string | null
  new_version_id: number | null
  new_version_number: number | null
  amended_text_id: number
  amended_text_slug: string
  amended_text_title_fr: string
  amended_article_id: number | null
  amended_article_number: string | null
  amended_article_slug: string | null
  amended_block_kind: string | null
  new_block_version_id: number | null
  new_block_version_number: number | null
  created_at: string
}

/** List all article-edits a legal text made to *other* texts. */
export async function listChangesMadeBy(slug: string) {
  return apiGet<LegalChangeMadeRead[]>(
    `/legal-texts/${encodeURIComponent(slug)}/changes-made`,
  )
}

export type LegalChangeReceivedRead =
  components['schemas']['LegalChangeReceivedRead']

/**
 * All edits other legal texts made to this one — articles + formal
 * blocks. Inverse direction of ``/changes-made``. Powers the redesigned
 * ``/loi/[slug]/amendements`` page, which groups rows by ``change_kind``
 * into "modifiés" / "nouveaux" / "abrogés" sections.
 */
export async function listChangesReceivedBy(slug: string) {
  return apiGet<LegalChangeReceivedRead[]>(
    `/legal-texts/${encodeURIComponent(slug)}/changes-received`,
  )
}

/**
 * All articles in a legal text that have more than one version.
 * Returns each article's full version history embedded — kept for the
 * "modifiés" section of the amendments page which needs the version
 * bodies for the inline diff.
 */
export async function getAmendmentsForText(slug: string) {
  return apiGet<ArticleWithHistoryRead[]>(
    `/legal-texts/${encodeURIComponent(slug)}/amendments`,
  )
}

// -----------------------------------------------------------------------
// Moniteur ingestion pipeline
// -----------------------------------------------------------------------

// Derived from the OpenAPI spec so backend additions (like the
// `number` we just added to SommaireEntry) flow through to consumers
// without a manual edit. The hand-typed version that lived here used
// to drift — it carried no `number` field even after the backend
// surfaced it, breaking the card render.
export type MoniteurIssueRead = components['schemas']['MoniteurIssueRead']

export type MoniteurEntryRead = {
  id: number
  issue_id: number
  position: number
  detected_category:
    | 'constitution'
    | 'code'
    | 'loi'
    | 'loi_constitutionnelle'
    | 'decret'
    | 'arrete'
    | 'circulaire'
    | 'convention'
    | 'ordonnance'
    | 'communique'
    | 'correspondance'
    | 'promulgation'
    | 'errata'
    | 'resolution'
    | 'avis'
    | 'note'
    | 'autre'
    | null
  detected_title: string | null
  display_title: string | null
  detected_number: string | null
  parent_entry_id: number | null
  detected_date: string | null
  summary_fr: string | null
  summary_ht: string | null
  raw_text: string
  confidence: string | null
  page_from: number | null
  page_to: number | null
  review_status: 'pending' | 'accepted' | 'rejected' | 'deferred'
  /** Parser-profile override. NULL means "auto-pick from
   *  detected_category at parse time". Editor-set when the auto
   *  classification is off. */
  parser_profile: ParserProfile | null
  /** Typed parser output — TOC nodes, articles, signatures, parser
   *  metadata, warnings. Read-only on the client; refreshed when /parse
   *  runs on the parent issue or the editor changes parser_profile with
   *  rerun=true. */
  content_ast: Record<string, unknown> | null
  promoted_legal_text_id: number | null
  promoted_legal_text_slug: string | null
  promoted_legal_text_title_fr: string | null
  review_notes: string | null
  reviewed_at: string | null
  /** Translation source — populated when this entry has a known
   *  Kreyòl-companion publication (the "36 → 36-a" pattern). */
  translation_issue_id: number | null
  translation_issue_number: string | null
  translation_issue_year: number | null
  translation_detected_number: string | null
  translation_title_ht: string | null
  translation_page_from: number | null
  translation_page_to: number | null
  translation_summary_ht: string | null
  companion_documents: Array<{
    kind: string
    pages?: string | null
    note?: string | null
  }> | null
  /** Publication language of THIS entry — derived server-side from
   *  whether the entry's issue matches the promoted legal text's
   *  ``moniteur_issue_id`` (fr) or ``moniteur_issue_id_ht`` (ht). NULL
   *  when the entry isn't promoted to a legal text. */
  lang?: 'fr' | 'ht' | null
  created_at: string
  updated_at: string
}

export type MoniteurEntryTranslationPayload = {
  translation_issue_id: number | null
  translation_detected_number?: string | null
  translation_title_ht?: string | null
  translation_page_from?: number | null
  translation_page_to?: number | null
  translation_summary_ht?: string | null
  companion_documents?: Array<{
    kind: string
    pages?: string | null
    note?: string | null
  }> | null
}

/** @deprecated Use MoniteurEntryRead instead */
export type MoniteurLawCandidateRead = MoniteurEntryRead

export type MoniteurIssueWithEntries = MoniteurIssueRead & {
  entries: MoniteurEntryRead[]
}

/** @deprecated Use MoniteurIssueWithEntries instead */
export type MoniteurIssueWithCandidates = MoniteurIssueRead & {
  candidates: MoniteurEntryRead[]
}

export async function listMoniteurIssues(params?: {
  limit?: number
  offset?: number
  only_published?: boolean
}) {
  return apiGet<{
    items: MoniteurIssueRead[]
    total: number
    page: number
    size: number
  }>(`/moniteur/issues`, { params })
}

export async function getMoniteurIssue(id: number) {
  return apiGet<MoniteurIssueWithEntries>(`/moniteur/issues/${id}`)
}

/** Resolve a date-based slug (``28-avril-1987``) to the full issue
 *  payload. Used by the public ``/moniteur/{slug}`` route. */
export async function getMoniteurIssueBySlug(slug: string) {
  return apiGet<MoniteurIssueWithEntries>(
    `/moniteur/issues/by-slug/${encodeURIComponent(slug)}`,
  )
}

/** Build the human-readable URL slug for a Moniteur issue. Falls back
 *  to the numeric ID when ``publication_date`` is null (rare — happens
 *  only for half-imported issues that haven't been processed yet). */
export function moniteurIssueSlug(issue: {
  id: number
  publication_date?: string | null
  slug?: string | null
  number?: string | null
}): string {
  if (issue.slug) return issue.slug
  if (!issue.publication_date) return String(issue.id)
  // Reconstruct on the client when the backend response predates the
  // slug-emitting Pydantic update. Same format the backend uses
  // (see backend/schemas/moniteur.py MoniteurIssueRead.model_validate).
  const [y, m, d] = issue.publication_date.split('-')
  const months = [
    'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
  ]
  const idx = parseInt(m, 10) - 1
  if (idx < 0 || idx > 11) return String(issue.id)
  const base = `${parseInt(d, 10)}-${months[idx]}-${y}`
  // Append the lowercased number suffix when the issue number isn't
  // purely numeric — disambiguates paired regular + special issues on
  // the same date (e.g. N° 36 vs N° 36-A, both 28 avril 1987).
  const num = (issue.number ?? '').trim()
  if (num && !/^\d+$/.test(num)) {
    const safe = num
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[/.]/g, '-')
    return `${base}-no-${safe}`
  }
  return base
}

export async function createMoniteurIssue(payload: {
  number: string
  year: number
  publication_date?: string | null
  edition_label?: string | null
  director?: string | null
  director_role?: string | null
}) {
  return apiPost<MoniteurIssueRead>(`/moniteur/issues`, payload)
}

export async function uploadMoniteurFile(id: number, file: File) {
  // Routed through a local Next.js API route, not /api/v1/*, for the same
  // reason as extractMoniteurMetadata — large multipart uploads choke the
  // dev rewrite. See web/src/app/api/moniteur/issues/[id]/upload/route.ts.
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`/api/moniteur/issues/${id}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  if (!r.ok) {
    let detail: string | undefined
    try {
      detail = (await r.json())?.detail
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return (await r.json()) as MoniteurIssueRead
}

/** Upload a pre-transcribed version of the Moniteur file. When present,
 *  the parse pipeline reads text from this instead of running OCR. */
export async function uploadMoniteurTranscript(id: number, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`/api/moniteur/issues/${id}/upload-transcript`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  if (!r.ok) {
    let detail: string | undefined
    try {
      detail = (await r.json())?.detail
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return (await r.json()) as MoniteurIssueRead
}

export type ExtractedMoniteurMetadata = {
  number: string | null
  year: number | null
  publication_date: string | null
  edition_label: string | null
  director: string | null
  /** Director's institutional title — what appears in parens after the
   *  name on the cover page (e.g. "Major Forces Armées d'Haïti",
   *  "Secrétaire d'État à la Communication"). */
  director_role: string | null
  confidence: Record<string, number>
  /** Auto-detected sommaire entries — the import form pre-fills its
   *  sommaire step when this is non-empty. */
  suggested_sommaire?: Array<{
    detected_category: SommaireEntryInput['detected_category']
    detected_title: string | null
    detected_number: string | null
    page_from: number
    page_to: number
  }>
}

/** Run OCR + cover-page regex on an uploaded PDF and return proposed
 *  metadata, without persisting anything. The editor reviews + corrects
 *  the result before triggering the actual create-issue flow.
 *
 *  Routes through a local Next.js API route (rather than the /api/v1/*
 *  rewrite) because Next's dev rewrite drops large multipart uploads —
 *  Moniteur PDFs are routinely 30-80 MB. The local route streams the body
 *  to FastAPI server-side. */
export async function extractMoniteurMetadata(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch('/api/moniteur/extract-metadata', {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  if (!r.ok) {
    let detail: string | undefined
    try {
      detail = (await r.json())?.detail
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return (await r.json()) as ExtractedMoniteurMetadata
}

export async function parseMoniteurIssue(id: number) {
  return apiPost<MoniteurIssueWithEntries>(
    `/moniteur/issues/${id}/parse`,
    {},
  )
}

export type SommaireEntryInput = components['schemas']['SommaireEntryInput']

/** Pre-fill the editor's known sommaire so the parser can skip boundary
 *  detection and OCR per declared page range instead. */
export async function setMoniteurSommaire(
  id: number,
  entries: SommaireEntryInput[],
) {
  return apiPost<MoniteurIssueWithEntries>(
    `/moniteur/issues/${id}/sommaire`,
    { entries },
  )
}

/** Hard-delete a Moniteur issue (and its entries + uploaded PDF). */
export async function deleteMoniteurIssue(id: number) {
  const r = await fetch(`/api/v1/moniteur/issues/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!r.ok) {
    let detail: string | undefined
    try {
      detail = (await r.json())?.detail
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
}

/** Hard-delete a single Moniteur entry (e.g. a promulgation companion
 *  row that doesn't belong, or an over-eager parser candidate). Does
 *  NOT cascade to the promoted legal_text — only the sommaire row in
 *  this issue is removed. Editor-only on the backend. */
export async function deleteMoniteurEntry(id: number): Promise<void> {
  return apiDelete(`/moniteur/entries/${id}`)
}

export async function reviewMoniteurEntry(
  id: number,
  payload: {
    review_status?: 'pending' | 'accepted' | 'rejected' | 'deferred'
    detected_category?: string | null
    detected_title?: string | null
    // Curated display form of the title — kept in sync with
    // ``detected_title`` by the editor panel so the public
    // ``/moniteur/[id]`` page (which reads ``display_title ||
    // detected_title``) reflects every edit.
    display_title?: string | null
    detected_number?: string | null
    detected_date?: string | null
    parent_entry_id?: number | null
    review_notes?: string | null
    raw_text?: string | null
  },
) {
  return apiPatch<MoniteurEntryRead>(
    `/moniteur/candidates/${id}`,
    payload,
  )
}

/** Attach or clear the translation pointer on a Moniteur entry — used
 *  when a Kreyòl-companion issue (e.g. 36-a) is the source of the HT
 *  version of this content. The companion documents JSON describes any
 *  side-documents (lettre de promulgation, etc.) that appear with it. */
export async function setMoniteurEntryTranslation(
  id: number,
  payload: MoniteurEntryTranslationPayload,
) {
  return apiPatch<MoniteurEntryRead>(
    `/moniteur/candidates/${id}/translation`,
    payload,
  )
}

/** Pin (or clear) the parser-profile override on a Moniteur entry. When
 *  `rerun` is true the typed parser runs synchronously and the entry's
 *  `content_ast` is refreshed in the same request. Otherwise the
 *  override is saved but the AST stays stale until the next /parse run
 *  on the parent issue. */
export async function setMoniteurEntryParserProfile(
  id: number,
  payload: { parser_profile: ParserProfile | null; rerun?: boolean },
) {
  return apiPatch<MoniteurEntryRead>(
    `/moniteur/candidates/${id}/parser-profile`,
    payload,
  )
}

export type TranscriptPreview = components['schemas']['TranscriptPreview']

/** Live preview of how the splitter would carve up an entry's raw_text
 *  into préambule / visas / considérants / formule d'adoption /
 *  articles. Pass `raw_text` to preview against unsaved edits. */
export async function previewMoniteurEntrySplit(
  id: number,
  raw_text?: string,
) {
  return apiPost<TranscriptPreview>(
    `/moniteur/candidates/${id}/preview-split`,
    raw_text === undefined ? {} : { raw_text },
  )
}

export async function promoteMoniteurEntry(id: number) {
  return apiPost<MoniteurEntryRead>(
    `/moniteur/candidates/${id}/promote`,
    {},
  )
}

// -----------------------------------------------------------------------
// Citations (the legal graph) — only the article-side helpers are
// wired today. Decisions / jurisprudence are a later phase, not built.
// -----------------------------------------------------------------------

async function listCitations(params?: {
  source_type?: CitationNodeType
  source_id?: number
  target_type?: CitationNodeType
  target_id?: number
  relation?: CitationRelation
  limit?: number
  offset?: number
}) {
  return apiGet<PaginatedCitationsResponse>('/citations', { params })
}

/** Outgoing edges from an article: what does it cite? */
export async function citationsFromArticle(articleId: number) {
  return listCitations({ source_type: 'article', source_id: articleId })
}

/** Incoming edges to an article: what cites it? */
export async function citationsToArticle(articleId: number) {
  return listCitations({ target_type: 'article', target_id: articleId })
}

// -----------------------------------------------------------------------
// Jurisprudence (court decisions) — public read endpoints.
//
// The base `DecisionListItem` / `DecisionRead` types come from the
// generated OpenAPI spec (`@/lib/api-types`). The detail page renders
// considerably more structure than the current backend schema exposes
// (parties, procedural history, moyens with court responses, judges,
// dispositif, cited articles). Those richer fields are declared as
// optional supplemental types below — keep them as `?` so existing
// records (and the live backend response) continue to type-check until
// the backend agent catches up. Whatever the backend omits, the UI
// gracefully degrades.
//
// TODO(backend): mirror the structures below in the Pydantic
// `DecisionRead` schema so the OpenAPI codegen pulls them in.
// -----------------------------------------------------------------------

/** Role a party takes in a court proceeding. Mirrors the prospective
 *  backend enum. Open-ended `string` fallback so unexpected legacy
 *  values render with a generic label instead of crashing. */
export type DecisionPartyRole =
  | 'pourvoyante'
  | 'intimee'
  | 'demandeur'
  | 'defendeur'
  | 'appelant'
  | 'intime'
  | 'demanderesse'
  | 'defenderesse'
  | 'partie_civile'
  | 'consort'
  | 'representant'
  | string

/** Role a magistrate plays on the bench. */
export type DecisionJudgeRole =
  | 'president'
  | 'juge'
  | 'rapporteur'
  | 'substitut'
  | 'greffier'
  | 'commissaire_gouvernement'
  | 'avocat_general'
  | string

/** Whether a moyen (ground) was accepted, rejected, or unaddressed. */
export type MoyenOutcome = 'accepted' | 'rejected' | 'unaddressed' | string

/** Outcome of the decision itself. Common Haitian/civil-law verbs. */
export type DecisionOutcome =
  | 'rejet'
  | 'cassation'
  | 'cassation_partielle'
  | 'confirmation'
  | 'infirmation'
  | 'irrecevabilite'
  | 'desistement'
  | 'autre'
  | string

/** One party to the proceeding. `name` is post-anonymization when
 *  `parties_anonymized=true` on the parent decision. */
export type DecisionParty = {
  id?: number
  name: string
  role: DecisionPartyRole
  /** Free-text qualifier — "et consorts", "société anonyme", etc. */
  qualifier?: string | null
  /** Counsel for this party — typed string "Me X, avocat". */
  counsel?: string | null
}

/** One magistrate on the bench. */
export type DecisionJudge = {
  id?: number
  name: string
  role: DecisionJudgeRole
}

/** One ground of appeal / cassation. Each moyen typically has a
 *  petitioner's argument and the court's response. */
export type DecisionMoyen = {
  id?: number
  /** 1-based position within the decision. */
  number: number
  /** Optional short label — "Premier moyen", "Deuxième moyen, …". */
  title_fr?: string | null
  title_ht?: string | null
  /** The petitioner's argument as paraphrased in the decision. */
  argument_fr?: string | null
  argument_ht?: string | null
  /** The court's response / motif. */
  response_fr?: string | null
  response_ht?: string | null
  /** Did the court accept or reject this moyen? */
  outcome?: MoyenOutcome | null
}

/** A prior decision in the procedural chain — TPI → appel → cassation. */
export type DecisionProceduralStep = {
  id?: number
  /** Court that rendered the prior decision. */
  court: CourtType | string
  /** ISO yyyy-mm-dd. */
  date: string
  /** Short description — "Jugement du TPI", "Arrêt de la Cour d'appel", … */
  label_fr?: string | null
  label_ht?: string | null
  /** Optional case number / docket reference. */
  case_number?: string | null
  /** Outcome at that step, free-text. */
  outcome?: string | null
}

/** An article cited by the decision — resolved to a legal text + article. */
export type DecisionCitedArticle = {
  id?: number
  /** The cited article's number ("1382", "2228", "8-1"). */
  article_number: string
  /** Parent text slug for the `/loi/<slug>?article=<n>` link. May be
   *  null when the citation points at a text not yet in the corpus. */
  text_slug?: string | null
  text_title_fr?: string | null
  text_title_ht?: string | null
  /** Optional context — "à l'appui du premier moyen", etc. */
  context_fr?: string | null
  context_ht?: string | null
}

/** Subject tag attached to a decision — droit civil, droit immobilier,
 *  etc. Same shape as the legal-text theme tags. */
export type DecisionSubjectTag = {
  /** Backend enum / slug — used as the filter key. */
  key: string
  /** Display label (bilingual). */
  label_fr?: string | null
  label_ht?: string | null
}

/** Rich detail payload — extends the OpenAPI-typed `DecisionRead` with
 *  the structured fields the detail page renders.
 *
 *  ``parties`` / ``moyens`` / ``procedural_history`` are OMITTED from the
 *  generated base before being re-declared: the backend's OpenAPI now
 *  ships its own (differently-named) shapes for these — ``Party.lawyers``
 *  vs our ``counsel``, ``Moyen.title/body_fr`` vs our
 *  ``title_fr/argument_fr``, procedural ``decision_date`` vs our ``date``.
 *  Intersecting (`&`) the two would merge into an unusable type; the
 *  ``Omit`` lets these supplemental types fully *override* the generated
 *  fields, which is what the detail page + editor seed already expect.
 *  (See the TODO above — the read contract is still being reconciled.) */
export type DecisionDetail = Omit<
  DecisionRead,
  'parties' | 'moyens' | 'procedural_history'
> & {
  /** Parties to the proceeding. */
  parties?: DecisionParty[]
  /** Procedural history — prior decisions, in chronological order. */
  procedural_history?: DecisionProceduralStep[]
  /** Grounds raised and the court's response. */
  moyens?: DecisionMoyen[]
  /** Dispositif text ("PAR CES MOTIFS, …"). Plain prose; pre-formatted. */
  dispositif_fr?: string | null
  dispositif_ht?: string | null
  /** Magistrates on the bench. */
  judges?: DecisionJudge[]
  /** Articles cited in the reasoning. */
  cited_articles?: DecisionCitedArticle[]
  /** Subject tags. */
  subject_tags?: DecisionSubjectTag[]
}

/** Rich list-item payload — extends the OpenAPI-typed
 *  `DecisionListItem` with counts and tags used in the row card. */
export type DecisionListItemRich = DecisionListItem & {
  /** Number of moyens — shown in the row's footer stat strip. */
  moyens_count?: number
  /** Number of cited articles. */
  cited_articles_count?: number
  /** Subject chips on the row card. */
  subject_tags?: DecisionSubjectTag[]
  /** Convenience: title or first line of the summary (FR). When the
   *  backend hasn't synthesized this, the UI falls back to summary_fr. */
  title_fr?: string | null
  title_ht?: string | null
}

/** Paginated list response — same shape as the OpenAPI version, just
 *  re-aliased to the enriched item type. */
export type PaginatedDecisionsResponseRich = {
  items: DecisionListItemRich[]
  total: number
  page: number
  size: number
}

/** Paginated list of court decisions. */
export async function listDecisions(params?: {
  q?: string
  court?: CourtType
  /** ISO yyyy-mm-dd, inclusive lower bound for `decision_date`. */
  from?: string
  /** ISO yyyy-mm-dd, inclusive upper bound. */
  to?: string
  /** Subject filter — backend `DecisionSubjectTag.key`. */
  subject?: string
  limit?: number
  offset?: number
}) {
  return apiGet<PaginatedDecisionsResponseRich>('/decisions', { params })
}

/** Single decision by slug. */
export async function getDecisionBySlug(slug: string) {
  return apiGet<DecisionDetail>(`/decisions/${encodeURIComponent(slug)}`)
}

// -----------------------------------------------------------------------
// Editorial — import pipeline
// -----------------------------------------------------------------------

/** Parse result from the document analysis endpoint. */
export type ParsedHeadingResponse = {
  key: string
  level: string
  number: string
  title_fr: string
  parent_key: string | null
  position: number
}

export type ParsedArticleResponse = {
  number: string
  content_fr: string
  /** Matched HT text from bilingual parse (aligned by article number). */
  content_ht: string | null
  heading_path: string[]
  heading_key: string | null
  title: string | null
  title_ht: string | null
}

export type DocumentParseResponse = {
  headings: ParsedHeadingResponse[]
  articles: ParsedArticleResponse[]
  preamble: string
  preamble_ht: string | null
  parser_confidence: number
  warnings: string[]
  official_number?: string | null
  issuing_authority?: string | null
  official_formula?: string | null
  /** Article counts — non-zero when an HT file was uploaded. */
  fr_article_count: number
  ht_article_count: number
  matched_count: number
}

/**
 * Parse a legal document (PDF/DOCX/TXT) into structured headings + articles.
 *
 * Routes through a local Next.js API route for the same reason as
 * Moniteur uploads — large multipart uploads choke the dev rewrite.
 */
export type TranslationStats = {
  legal_texts_total: number
  legal_texts_with_ht: number
  legal_texts_fully_translated: number
  legal_texts_fr_only: number
  articles_total: number
  articles_translated: number
  moniteur_entries_total: number
  moniteur_entries_with_translation_pointer: number
  moniteur_entries_pending_translation: number
}

export type TranslationWorklistItem = {
  id: number
  slug: string
  title_fr: string
  category: string
  editorial_status: string
  total_articles: number
  translated_articles: number
  pct: number
}

export async function getTranslationStats() {
  return apiGet<TranslationStats>('/editorial/translations/stats')
}

export async function getTranslationWorklist(params?: {
  coverage?: 'all' | 'none' | 'partial' | 'complete'
  limit?: number
}) {
  return apiGet<TranslationWorklistItem[]>('/editorial/translations', {
    params,
  })
}

// ============================================================
// Chronologie de la législation (editorial-only)
// Backed by ``legislation_index_entries`` — historical references
// extracted from the 2001 Ministère de la Justice ``Index
// Chronologique de la Législation Haïtienne (1804-2000)``.
// ============================================================

export type LegislationInForceStatus =
  | 'unknown'
  | 'in_force'
  | 'abrogated'
  | 'superseded'
  | 'modified'

export type LegislationIndexEntryRead = {
  id: number
  source: string
  source_page: number | null
  display_order: number
  chapter: string | null
  section: string | null
  description_fr: string
  detected_category: string | null
  act_date: string | null
  act_date_raw: string | null
  moniteur_number: string | null
  moniteur_year: number | null
  moniteur_date: string | null
  moniteur_date_raw: string | null
  in_force_status: LegislationInForceStatus
  in_force_notes: string | null
  in_force_verified_at: string | null
  notes: string | null
  legal_text_id: number | null
  moniteur_issue_id: number | null
  legal_text_slug: string | null
  legal_text_title_fr: string | null
}

export type LegislationIndexListResponse = {
  items: LegislationIndexEntryRead[]
  total: number
  limit: number
  offset: number
}

export type LegislationIndexStats = {
  total: number
  chapters: number
  sections: number
  by_chapter: Record<string, number>
  by_section: Record<string, number>
  by_in_force_status: Record<string, number>
  with_act_date: number
  with_moniteur_ref: number
  imported: number
  year_min: number | null
  year_max: number | null
}

export async function getChronologieStats() {
  return apiGet<LegislationIndexStats>('/editorial/chronologie/stats')
}

export async function listChronologie(params?: {
  limit?: number
  offset?: number
  chapter?: string
  section?: string
  in_force_status?: LegislationInForceStatus
  year_from?: number
  year_to?: number
  only_imported?: boolean
  q?: string
}) {
  return apiGet<LegislationIndexListResponse>('/editorial/chronologie', {
    params,
  })
}

export async function updateChronologieEntry(
  id: number,
  payload: {
    in_force_status?: LegislationInForceStatus
    in_force_notes?: string | null
    notes?: string | null
    legal_text_id?: number | null
    moniteur_issue_id?: number | null
  },
) {
  return apiPatch<LegislationIndexEntryRead>(
    `/editorial/chronologie/${id}`,
    payload,
  )
}

export type TranslationMatchResponse = {
  article_id: number
  article_number: string
  article_slug: string
  existing_text_fr: string | null
  existing_text_ht: string | null
  parsed_content_ht: string | null
  parsed_title_ht: string | null
  status: 'matched' | 'fr_only' | 'existing_ht'
}

export type TranslationParseResponse = {
  legal_text_slug: string
  matches: TranslationMatchResponse[]
  warnings: string[]
  fr_article_count: number
  parsed_ht_count: number
  matched_count: number
  preamble_ht: string | null
}

/**
 * Parse a Kreyòl translation DOCX and align against an existing legal
 * text's FR articles. Returns one row per FR article with the matched
 * HT text (if any). The caller renders a side-by-side preview before
 * committing each row via the per-article PATCH endpoint.
 */
export async function parseTranslation(
  slug: string,
  file: File,
): Promise<TranslationParseResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(
    `/api/editorial/legal-texts/${encodeURIComponent(slug)}/parse-translation`,
    { method: 'POST', body: fd },
  )
  if (!r.ok) {
    let detail: string | undefined
    try {
      const body = await r.json()
      detail = body?.detail ?? body?.error?.message
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `Translation parse failed (HTTP ${r.status})`)
  }
  return (await r.json()) as TranslationParseResponse
}

export async function parseDocument(
  file: File,
  fileHt?: File | null,
): Promise<DocumentParseResponse> {
  const fd = new FormData()
  fd.append('file', file)
  if (fileHt) fd.append('file_ht', fileHt)
  const r = await fetch('/api/editorial/parse-document', {
    method: 'POST',
    body: fd,
  })
  if (!r.ok) {
    let detail: string | undefined
    try {
      const body = await r.json()
      detail = body?.detail ?? body?.error?.message
    } catch {
      detail = await r.text()
    }
    throw new Error(detail || `Parse failed (HTTP ${r.status})`)
  }
  return (await r.json()) as DocumentParseResponse
}

/** Payload shape for creating a new legal text with structure. */
export type LegalTextCreatePayload = {
  slug: string
  category: string
  code_subcategory?: string | null
  jurisdiction?: string
  title_fr: string
  title_ht?: string | null
  description_fr?: string | null
  description_ht?: string | null
  preamble_fr?: string | null
  preamble_ht?: string | null
  // Combined introductory part (visas + considérants + mentions +
  // enacting formula). The flat per-kind fields were dropped in
  // migration 0046; callers fold them into intro_fr / intro_ht.
  intro_fr?: string | null
  intro_ht?: string | null
  // Combined closing part ("partie finale") — formula + signatures.
  closing_fr?: string | null
  closing_ht?: string | null
  issuing_authority?: string | null
  promulgation_date?: string | null
  publication_date?: string | null
  moniteur_ref?: string | null
  moniteur_issue_id?: number | null
  status?: string
  headings?: Array<{
    key: string
    parent_key?: string | null
    level: string
    number?: string | null
    title_fr?: string | null
    title_ht?: string | null
    position?: number
  }>
  articles?: Array<{
    number: string
    slug: string
    heading_key?: string | null
    position?: number
    version: {
      text_fr: string
      text_ht?: string | null
      title_fr?: string | null
      title_ht?: string | null
    }
  }>
}

/**
 * Create a new draft LegalText with headings + articles.
 * This is the "commit" step after the editor reviews the parsed structure.
 */
export async function createLegalText(payload: LegalTextCreatePayload) {
  return apiPost<LegalTextRead>('/editorial/legal-texts', payload)
}

// -----------------------------------------------------------------------
// Editorial — auth-required endpoints (carry the Auth.js cookie)
// -----------------------------------------------------------------------

export type EditorIdentity = {
  id: number
  email: string | null
  name: string | null
  role: 'admin' | 'reviewer' | 'editor'
}

/**
 * Editor list — sees ALL editorial statuses (drafts + published + ...).
 * Default `editorial_status` is undefined → no filter, returns everything.
 * Pass 'draft' / 'published' to narrow.
 */
export async function listEditorialTexts(params?: {
  q?: string
  category?: LegalCategory
  code_subcategory?: CodeSubcategory
  status?: LegalStatus
  editorial_status?: 'draft' | 'pending_review' | 'published' | 'rejected'
  year_from?: number
  year_to?: number
  limit?: number
  offset?: number
}) {
  return apiGet<PaginatedListResponse>('/editorial/legal-texts', { params })
}

/**
 * Editorial detail — sees drafts. Used in editor mode instead of the public
 * `/legal-texts/{slug}` endpoint.
 */
export async function getEditorialTextBySlug(
  slug: string,
  include: 'toc' | 'all' = 'all',
) {
  return apiGet<LegalTextRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}`,
    { params: { include } },
  )
}

export async function publishLegalText(slug: string) {
  return apiPost<LegalTextRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/publish`,
  )
}

/** Submit a draft for peer review. Flips ``editorial_status`` to
 *  ``pending_review`` so another editor sees it on the review
 *  queue. Idempotent on already-pending texts; refuses if the text
 *  is already published — use ``unpublishLegalText`` first. */
export async function submitLegalTextForReview(slug: string) {
  return apiPost<LegalTextRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/submit-for-review`,
  )
}

export async function unpublishLegalText(slug: string, comment: string) {
  return apiPost<{ ok: boolean }>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/unpublish`,
    { comment },
  )
}

export async function requestChanges(slug: string, comment: string) {
  return apiPost<{ ok: boolean }>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/request-changes`,
    { comment },
  )
}

/**
 * Editor metadata update. Send only the fields you want to change; unset
 * keys are left untouched. Pass `null` to clear nullable fields.
 */
export type LegalTextMetadataPatch = {
  /** Override the auto-generated permalink slug. Lowercase ASCII +
   *  digits + hyphens, 1–200 chars, no leading/trailing hyphen.
   *  Caller is responsible for redirecting to the new URL on
   *  success (the patched ``LegalTextRead.slug`` reflects it). */
  slug?: string
  title_fr?: string
  title_ht?: string | null
  /** Moniteur-verbatim form of the title (no date), distinct from the
   *  citation-form ``title_*`` above. Editable per-field; pass `null`
   *  to clear, `undefined` (omit) to leave untouched. */
  official_title_fr?: string | null
  official_title_ht?: string | null
  description_fr?: string | null
  description_ht?: string | null
  promulgation_date?: string | null // ISO date "YYYY-MM-DD"
  publication_date?: string | null
  moniteur_ref?: string | null
  category?: LegalCategory
  code_subcategory?: CodeSubcategory | null
  status?: LegalStatus
  // Page-1 + post-dispositif official metadata. Editable per-field;
  // pass `null` to clear, `undefined` (omit) to leave untouched.
  official_number?: string | null
  issuing_authority?: string | null
  closing_fr?: string | null
  closing_ht?: string | null
  // Formal blocks (Phase 1 — editable in-place via EditableFormalBlock).
  preamble_fr?: string | null
  preamble_ht?: string | null
  /** Single combined "partie introductive" — visas + considérants +
   *  mentions + enacting formula in one field. Supersedes the per-kind
   *  columns below (kept for legacy data only). */
  intro_fr?: string | null
  intro_ht?: string | null
  visas_fr?: string | null
  visas_ht?: string | null
  considerants_fr?: string | null
  considerants_ht?: string | null
  /** Procedural mentions — "Sur le rapport du …" / "Et après
   *  délibération …". Sits between considérants and the dispositif
   *  word. Editable bilingually via the same EditableFormalBlock. */
  mentions_procedurales_fr?: string | null
  mentions_procedurales_ht?: string | null
  enacting_formula_fr?: string | null
  enacting_formula_ht?: string | null
  /** 'left' (default) or 'center' — display alignment of the
   *  enacting-formula block on the reader page. */
  enacting_formula_align?: 'left' | 'center'
  /** Whether to show the national devise banner above the document. */
  show_devise_banner?: boolean
  /** Whether to show the document-type heading (e.g. "LOI" / "DÉCRET"). */
  show_doc_type?: boolean
  /** Custom devise text (overrides default Haitian motto). */
  devise_fr?: string | null
  devise_ht?: string | null
  /** Custom document-type label (e.g. "ARRÊTÉ" instead of auto-generated). */
  doc_type_label_fr?: string | null
  doc_type_label_ht?: string | null
  comment?: string | null
}

export async function updateLegalTextMetadata(
  slug: string,
  patch: LegalTextMetadataPatch,
) {
  return apiPatch<LegalTextRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/metadata`,
    patch,
  )
}

/**
 * Replace the editor-confirmed theme set on a legal text. Pass an
 * empty array to clear all editor tags. Auto-suggester tags coexist
 * separately; a matching auto tag is promoted to "editor" instead
 * of being duplicated server-side.
 *
 * Returns the updated LegalText (with `theme_tags` reflecting the
 * new set, including any unchanged auto tags).
 */
export async function updateLegalTextThemes(
  slug: string,
  themes: string[],
) {
  return apiPut<LegalTextRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/themes`,
    { themes },
  )
}

/** Hard-delete a draft legal text (and cascade its dependents). The
 *  backend refuses on published texts; the editor must unpublish
 *  first via ``unpublishLegalText``. */
export async function deleteLegalText(slug: string): Promise<void> {
  return apiDelete(`/editorial/legal-texts/${encodeURIComponent(slug)}`)
}

/**
 * Editor article-content update — bilingual title + body. Send only the
 * fields you want to change; unset keys leave the version untouched.
 *
 * Versioning policy is server-side: a draft version is mutated in place;
 * a published version is superseded by a new draft (next version_number).
 */
export type ArticleContentPatch = {
  /** Article identifier ("1", "1er", "premier", "2-1", "1-bis"). Lives
   *  on the Article row, not the version — updating it is a rename,
   *  no version bump. The slug stays stable so permalinks survive. */
  number?: string
  title_fr?: string | null
  title_ht?: string | null
  text_fr?: string
  text_ht?: string | null
  comment?: string | null
}

/**
 * Payload for ``PATCH /editorial/articles/{id}/version-status``.
 * Flips the current version's lifecycle status without creating a
 * new version or touching the body — distinct from
 * ``ArticleContentPatch`` (content edits) and the add-version flow
 * (amending-law-driven supersede).
 */
export type ArticleVersionStatusPatch = {
  status: 'in_force' | 'abrogated' | 'suspended' | 'transferred' | 'obsolete'
  effective_to?: string | null
  comment?: string | null
}

export type ArticleEmbed = components['schemas']['ArticleEmbed']

export type LegalHeadingRead = {
  id: number
  legal_text_id: number
  parent_id: number | null
  level: string | null
  key: string
  number: string | null
  title_fr: string | null
  title_ht: string | null
  position: number | null
}

// Signers are no longer a structured entity — the closing formula +
// signatures live together in the ``closing_fr`` / ``closing_ht`` rich
// field ("partie finale"), edited inline via the FinalPart block. The
// LegalSigner* types + CRUD helpers were removed in that refactor.

/** Inline-edit for a heading title in the TOC tree. Bilingual — pass
 *  either field independently; null leaves the existing value
 *  untouched, empty string clears it. */
export async function updateHeadingTitle(
  headingId: number,
  patch: { title_fr?: string | null; title_ht?: string | null },
) {
  return apiPatch<LegalHeadingRead>(
    `/editorial/headings/${headingId}/title`,
    patch,
  )
}

/** Insert a new TOC heading. Anchor is one of:
 *  - ``after_heading_id`` — slot after that heading, inherit its
 *    parent. Sibling positions shift by +1 server-side.
 *  - ``parent_id`` — append at the end of that parent's children.
 *  Specify exactly one. */
export type LegalHeadingInsertInput = {
  key: string
  level: 'part' | 'book' | 'title' | 'chapter' | 'section' | 'subsection'
  number?: string | null
  title_fr?: string | null
  title_ht?: string | null
  content_fr?: string | null
  content_ht?: string | null
  after_heading_id?: number | null
  parent_id?: number | null
}

export async function insertHeading(
  slug: string,
  body: LegalHeadingInsertInput,
) {
  return apiPost<LegalHeadingRead>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/headings`,
    body,
  )
}

/** Full patch for an existing heading — distinct from
 *  ``updateHeadingTitle`` (title-only). Can re-parent, renumber,
 *  change the level, or move the position. */
export type LegalHeadingPatch = {
  level?: 'part' | 'book' | 'title' | 'chapter' | 'section' | 'subsection'
  number?: string | null
  title_fr?: string | null
  title_ht?: string | null
  content_fr?: string | null
  content_ht?: string | null
  parent_id?: number | null
  position?: number
}

export async function updateHeading(
  headingId: number,
  patch: LegalHeadingPatch,
) {
  return apiPatch<LegalHeadingRead>(
    `/editorial/headings/${headingId}`,
    patch,
  )
}

/** Reorder a heading sibling set. ``parent_id=null`` targets the
 *  top-level (text-root) headings; an existing heading id targets
 *  its children. ``order`` is the desired sequence of heading ids
 *  top-to-bottom and must cover the sibling set exactly — backend
 *  rejects partial / extra lists. Cross-parent moves are not
 *  supported here; the caller must re-parent first via
 *  ``updateHeading`` and then reorder. */
export async function reorderHeadings(
  slug: string,
  body: { parent_id: number | null; order: number[] },
) {
  return apiPatch<LegalHeadingRead[]>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/headings/reorder`,
    body,
  )
}

/** Reorder articles inside a single heading bucket.
 *  ``heading_id=null`` targets the text-root bucket (articles
 *  attached directly to the LegalText, no heading parent — used
 *  for proclamations / discours). ``order`` is the desired
 *  sequence of article ids top-to-bottom and must cover the
 *  bucket exactly — backend rejects partial / extra lists. */
export async function reorderArticles(
  slug: string,
  body: { heading_id: number | null; order: number[] },
) {
  return apiPatch<ArticleEmbed[]>(
    `/editorial/legal-texts/${encodeURIComponent(slug)}/articles/reorder`,
    body,
  )
}

export async function updateArticleContent(
  articleId: number,
  patch: ArticleContentPatch,
) {
  return apiPatch<ArticleEmbed>(
    `/editorial/articles/${articleId}/content`,
    patch,
  )
}

export async function updateArticleVersionStatus(
  articleId: number,
  patch: ArticleVersionStatusPatch,
) {
  return apiPatch<ArticleEmbed>(
    `/editorial/articles/${articleId}/version-status`,
    patch,
  )
}

// ---------------------------------------------------------------------------
// Admin: user management
// ---------------------------------------------------------------------------
// All routes here require the caller to be ``UserRole.admin`` — the
// backend dependency raises 403 otherwise. The dashboard at
// /editorial/users consumes these.

export type AdminUserRead = components['schemas']['AdminUserRead']
export type AdminUserCreate = components['schemas']['AdminUserCreate']
export type AdminUserUpdate = components['schemas']['AdminUserUpdate']

export async function listAdminUsers() {
  return apiGet<AdminUserRead[]>('/admin/users')
}

export async function createAdminUser(payload: AdminUserCreate) {
  return apiPost<AdminUserRead>('/admin/users', payload)
}

export async function updateAdminUser(userId: number, patch: AdminUserUpdate) {
  return apiPatch<AdminUserRead>(`/admin/users/${userId}`, patch)
}

export async function deleteAdminUser(userId: number) {
  return apiDelete<void>(`/admin/users/${userId}`)
}

// -----------------------------------------------------------------------
// Editorial — Jurisprudence (court decisions)
//
// Mirror of the LegalText editorial surface: list-all-statuses, get-with-
// drafts, create, patch, delete, submit-for-review, publish, unpublish,
// request-changes. The backend routes below follow the same naming
// convention as ``/editorial/legal-texts/*``; until the backend agent
// catches up, these helpers will surface 404s as ApiError(status=404)
// and the UI gracefully degrades with an "Editorial API not available"
// toast.
//
// TODO(backend): mirror the route shapes below in
// ``api/routes/editorial/decisions.py``.
// -----------------------------------------------------------------------

export type EditorialStatus = 'draft' | 'pending_review' | 'published' | 'rejected'

/** Roles accepted on the editor side — wider than the public read type
 *  to cover party shapes the editor types in. */
export type EditorialPartyRole =
  | 'pourvoyante'
  | 'intimee'
  | 'demandeur'
  | 'defendeur'
  | 'appelant'
  | 'intime'
  | 'partie_civile'
  | 'consort'

/** Roles a magistrate can hold on the bench during the editor flow. */
export type EditorialJudgeRole =
  | 'president'
  | 'vice_president'
  | 'juge'
  | 'rapporteur'
  | 'substitut'
  | 'greffier'

export type DecisionPartyInput = {
  /** Pourvoyante, intimée, etc. */
  role: EditorialPartyRole | string
  name: string
  /** Person ⇒ no representative; company ⇒ representative_name surfaces. */
  party_type?: 'person' | 'company' | null
  representative_name?: string | null
  /** Counsel — typically "Me X, du Barreau de Y" — kept as nested rows
   *  so we can render them as cards on the editor panel. */
  lawyers?: Array<{ name: string; barreau?: string | null }>
}

export type DecisionJudgeInput = {
  name: string
  role: EditorialJudgeRole | string
  /** 1-based display order; null leaves backend default (insertion order). */
  order?: number | null
}

export type DecisionProceduralStepInput = {
  /** Court that rendered the prior decision — free-text (TPI X, Cour
   *  d'appel de …) since the historical chain isn't constrained to the
   *  CourtType enum. */
  court: string
  /** ISO yyyy-mm-dd. */
  decision_date: string
  case_number?: string | null
  outcome?: string | null
}

export type DecisionMoyenInput = {
  /** 1-based position. Editor can renumber for re-ordering. */
  number: number
  title?: string | null
  body_fr?: string | null
  body_ht?: string | null
  court_response_fr?: string | null
  court_response_ht?: string | null
  outcome?: 'accepted' | 'rejected' | 'partial' | string | null
}

/** Full create / replace payload for a decision. PATCH endpoints accept
 *  a partial form of the same shape — the helper types
 *  ``DecisionPatch`` below picks the relevant subset. */
export type DecisionCreatePayload = {
  slug: string
  court: CourtType
  chamber?: string | null
  formation?: string | null
  case_number?: string | null
  /** ISO yyyy-mm-dd. */
  decision_date: string
  hearing_date?: string | null
  outcome?: DecisionOutcome | null
  parties_anonymized?: boolean
  /** Subject tag keys — backend resolves to DecisionSubjectTag rows. */
  subject_matter?: string[]
  parties?: DecisionPartyInput[]
  judges?: DecisionJudgeInput[]
  procedural_history?: DecisionProceduralStepInput[]
  moyens?: DecisionMoyenInput[]
  dispositif_fr?: string | null
  dispositif_ht?: string | null
  full_text_fr?: string | null
  full_text_ht?: string | null
  summary_fr?: string | null
  summary_ht?: string | null
  headnotes_fr?: string | null
  headnotes_ht?: string | null
  comment?: string | null
}

/** PATCH body for an existing decision. Same shape as the create
 *  payload but every field optional — only send what changed. */
export type DecisionPatch = Partial<DecisionCreatePayload>

/** Rich list-item that mirrors the public ``DecisionListItemRich`` but
 *  adds the editorial_status pill — the editor list shows all statuses,
 *  not just published. */
export type EditorialDecisionListItem = DecisionListItemRich & {
  editorial_status?: EditorialStatus
}

export type PaginatedEditorialDecisions = {
  items: EditorialDecisionListItem[]
  total: number
  page: number
  size: number
}

/** Editor list — sees every editorial status (draft + pending + …).
 *  Pass ``editorial_status`` to narrow. Empty ⇒ no filter. */
export async function listEditorialDecisions(params?: {
  q?: string
  court?: CourtType
  from?: string
  to?: string
  subject?: string
  editorial_status?: EditorialStatus
  limit?: number
  offset?: number
}) {
  return apiGet<PaginatedEditorialDecisions>('/editorial/decisions', {
    params,
  })
}

/** Editorial detail — returns drafts the public route 404s on. */
export async function getEditorialDecisionBySlug(slug: string) {
  return apiGet<DecisionDetail>(
    `/editorial/decisions/${encodeURIComponent(slug)}`,
  )
}

/** Create a new draft decision. Returns the freshly-inserted row so the
 *  caller can redirect to its editorial detail page. */
export async function createDecision(body: DecisionCreatePayload) {
  return apiPost<DecisionDetail>('/editorial/decisions', body)
}

/** Patch metadata / structured fields of an existing decision. Backend
 *  no-ops unchanged keys; the helper sends only the fields the caller
 *  passes. */
export async function updateDecision(slug: string, patch: DecisionPatch) {
  return apiPatch<DecisionDetail>(
    `/editorial/decisions/${encodeURIComponent(slug)}`,
    patch,
  )
}

/** Hard-delete a draft decision (and cascade its parties / judges /
 *  moyens / procedural steps). Refuses on published rows — editor must
 *  unpublish first. */
export async function deleteDecision(slug: string): Promise<void> {
  return apiDelete(`/editorial/decisions/${encodeURIComponent(slug)}`)
}

/** Submit a draft for peer review. Flips ``editorial_status`` to
 *  ``pending_review``; idempotent on already-pending rows. */
export async function submitDecisionForReview(slug: string) {
  return apiPost<DecisionDetail>(
    `/editorial/decisions/${encodeURIComponent(slug)}/submit-for-review`,
  )
}

/** Publish (or approve a pending review and publish in one shot). */
export async function publishDecision(slug: string) {
  return apiPost<DecisionDetail>(
    `/editorial/decisions/${encodeURIComponent(slug)}/publish`,
  )
}

/** Unpublish a published decision back to draft. Comment is required
 *  for the audit log. */
export async function unpublishDecision(slug: string, comment: string) {
  return apiPost<{ ok: boolean }>(
    `/editorial/decisions/${encodeURIComponent(slug)}/unpublish`,
    { comment },
  )
}

/** Send a "needs changes" signal back to the author. Flips
 *  ``editorial_status`` to ``rejected`` with a comment attached. */
export async function requestDecisionChanges(slug: string, comment: string) {
  return apiPost<{ ok: boolean }>(
    `/editorial/decisions/${encodeURIComponent(slug)}/request-changes`,
    { comment },
  )
}
