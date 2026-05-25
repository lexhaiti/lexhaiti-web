'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Ban, Loader2, Save, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast-simple'
import { useT } from '@/i18n/useT'
import { ApiError } from '@/lib/api/client'
import {
  listEditorialTexts,
  type LegalTextMetadataPatch,
  updateLegalTextMetadata,
  updateLegalTextThemes,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { THEME_LABELS, type LegalThemeKey } from '@/lib/themes'

type LegalTextListItem = components['schemas']['LegalTextListItem']

// Copy lives at `metadataEditor.*` and `editorial.import.legalText.{categoryOptions,statusOptions}.*`
// in i18n/{fr,ht}.ts.

const CATEGORY_VALUES = [
  'constitution',
  'code',
  'loi',
  'loi_constitutionnelle',
  'decret',
  'arrete',
  'circulaire',
  'convention',
  'ordonnance',
] as const

const SUBCATEGORY_OPTS = [
  { value: 'code_civil', label: 'Code civil' },
  { value: 'code_penal', label: 'Code pénal' },
  { value: 'code_travail', label: 'Code du travail' },
  { value: 'code_commerce', label: 'Code de commerce' },
  { value: 'code_rural', label: 'Code rural' },
  { value: 'code_procedure_civile', label: 'Code de procédure civile' },
  { value: 'code_procedure_penale', label: 'Code de procédure pénale' },
  { value: 'autre', label: 'Autre' },
]

// Mirrors the backend ``LegalStatus`` enum. ``historique`` is for
// pre-constitutional founding documents (Acte de l'Indépendance,
// Dessalines' Discours…) that were never operative in the modern
// legal sense but stand as founding records — distinct from
// ``abrogated`` (in force then repealed). The trailing three are
// treaty-specific lifecycle markers (signed → ratified → in_force →
// possibly denounced); they only apply to international agreements
// but show up in the dropdown so the editor can mark a treaty row
// correctly without round-tripping through the API.
const STATUS_VALUES = [
  'in_force',
  'partially_abrogated',
  'abrogated',
  'historique',
  'signed',
  'ratified',
  'denounced',
] as const

export type LegalTextMetadata = {
  slug: string
  title_fr: string
  title_ht: string | null
  /** Moniteur-verbatim form of the title (no date) — distinct from
   *  the citation-form ``title_*`` above. Rendered in the LawDetail
   *  body under the doc-type heading. */
  official_title_fr: string | null
  official_title_ht: string | null
  description_fr: string | null
  description_ht: string | null
  issuing_date: string | null
  promulgation_date: string | null
  publication_date: string | null
  moniteur_ref: string | null
  /** Provenance line ("Source : … Voir <url>.") rendered as the
   *  Source tile in the hero. Bilingual; the FR side is the primary
   *  carrier — HT is rarely set. */
  mentions_procedurales_fr: string | null
  mentions_procedurales_ht: string | null
  category: string
  code_subcategory: string | null
  status: string
  // Page-1 + post-dispositif official metadata. All optional — old
  // corpus rows predate the columns and many older laws lack the
  // modern header structure entirely.
  official_number: string | null
  issuing_authority: string | null
  official_formula: string | null
  // Short formula that sits just *above* the article block on the
  // reader page — e.g. "Sur proposition de … le Sénat a adopté la
  // loi suivante :". Distinct from ``official_formula`` (the long
  // page-1 + post-dispositif sovereignty/promulgation block).
  enacting_formula_fr: string | null
  enacting_formula_ht: string | null
  // Whole-text abrogator — present when an editor has recorded
  // which law abrogated this one. Rendered as a chip on the hero;
  // editable here when status==abrogated. ``null`` when unset.
  abrogated_by: {
    slug: string
    title_fr: string
    title_ht: string | null
  } | null
  /** Theme tags currently attached to the text (auto + editor).
   *  We surface them here so the editor sees what's already set
   *  (including auto-suggester picks) and can confirm / extend. */
  theme_tags?: Array<{
    theme: string
    source: 'auto' | 'editor'
  }>
  /** When true, « Mentions procédurales » prints BEFORE the
   *  considérants block on the reader page. Default false (modern
   *  drafting order). 19th-century Haitian laws often need this set. */
  mentions_procedurales_before_considerants?: boolean
}

// Closed vocabulary of theme keys — kept in sync with the backend
// LegalTheme enum (see schemas/enums.py) and the THEME_LABELS map
// at lib/themes.ts. Order is editorial: most-used domains first.
const THEME_KEYS: LegalThemeKey[] = [
  'droit_famille',
  'successions',
  'foncier',
  'droit_societes',
  'droit_travail',
  'droit_fiscal',
  'droit_bancaire',
  'propriete_intellectuelle',
  'droit_administratif',
  'marches_publics',
  'protection_sociale',
  'environnement',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: LegalTextMetadata
  onSaved?: () => void
  /** Fires when the saved patch changed the slug. Parent is
   *  responsible for navigating to the new URL (the LawDetail page
   *  uses ``router.replace`` so the back button doesn't return to
   *  the old slug). The argument is the new slug. */
  onSlugChanged?: (newSlug: string) => void
}

export function MetadataEditor({
  open,
  onOpenChange,
  text,
  onSaved,
  onSlugChanged,
}: Props) {
  const { t, language } = useT()
  const isFr = language !== 'ht'
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  // Status labels reuse the `searchAdvanced.statusPills.*` keys; the same
  // `LegalStatus` enum values are surfaced on both screens.
  const statusLabel = (value: string): string =>
    t(`searchAdvanced.statusPills.${value}`)

  const categoryLabel = (value: string): string =>
    t(`editorial.import.legalText.categoryOptions.${value}`)

  // Local form state, seeded from the current text. Reset whenever the
  // sheet reopens so editors don't carry stale drafts across sessions.
  const [form, setForm] = useState(() => ({
    slug: text.slug,
    title_fr: text.title_fr,
    title_ht: text.title_ht ?? '',
    official_title_fr: text.official_title_fr ?? '',
    official_title_ht: text.official_title_ht ?? '',
    description_fr: text.description_fr ?? '',
    description_ht: text.description_ht ?? '',
    issuing_date: text.issuing_date ?? '',
    promulgation_date: text.promulgation_date ?? '',
    publication_date: text.publication_date ?? '',
    moniteur_ref: text.moniteur_ref ?? '',
    mentions_procedurales_fr: text.mentions_procedurales_fr ?? '',
    mentions_procedurales_ht: text.mentions_procedurales_ht ?? '',
    category: text.category,
    code_subcategory: text.code_subcategory ?? '',
    status: text.status,
    official_number: text.official_number ?? '',
    issuing_authority: text.issuing_authority ?? '',
    official_formula: text.official_formula ?? '',
    enacting_formula_fr: text.enacting_formula_fr ?? '',
    enacting_formula_ht: text.enacting_formula_ht ?? '',
    comment: '',
  }))

  // Whole-text abrogator picker — tracked separately from the column
  // form because it writes a LegalChange row, not a LegalText column.
  // Seeded from the parent text's ``abrogated_by``; reset on reopen.
  const [abrogatingLaw, setAbrogatingLaw] = useState<
    LegalTextListItem | null
  >(() => seedAbrogatingLaw(text.abrogated_by))

  // Theme tags — tracked separately because they write to a different
  // endpoint (PUT /editorial/legal-texts/{slug}/themes). Seeded from
  // the parent's ``theme_tags``; reset on reopen. We keep both the
  // selected set (editor + auto promotions) and the original snapshot
  // for the diff.
  const seedThemeSet = (
    tags?: Array<{ theme: string; source: 'auto' | 'editor' }>,
  ): Set<LegalThemeKey> => {
    const s = new Set<LegalThemeKey>()
    if (!tags) return s
    for (const t of tags) {
      // Treat both auto + editor tags as "currently applied". Saving
      // them under PUT promotes any auto match to editor — server
      // handles de-dup.
      s.add(t.theme as LegalThemeKey)
    }
    return s
  }
  const [selectedThemes, setSelectedThemes] = useState<Set<LegalThemeKey>>(
    () => seedThemeSet(text.theme_tags),
  )

  // 19th-century-style ordering toggle. See LegalText column with
  // the same name. Tracked separately from the main form because
  // it's a boolean, while ``form`` carries only string fields.
  const [mpBeforeConsiderants, setMpBeforeConsiderants] = useState<boolean>(
    () => !!text.mentions_procedurales_before_considerants,
  )

  // Reset form on each open so changes don't leak across openings.
  function handleOpenChange(next: boolean) {
    if (next) {
      setForm({
        slug: text.slug,
        title_fr: text.title_fr,
        title_ht: text.title_ht ?? '',
        official_title_fr: text.official_title_fr ?? '',
        official_title_ht: text.official_title_ht ?? '',
        description_fr: text.description_fr ?? '',
        description_ht: text.description_ht ?? '',
        issuing_date: text.issuing_date ?? '',
        promulgation_date: text.promulgation_date ?? '',
        publication_date: text.publication_date ?? '',
        moniteur_ref: text.moniteur_ref ?? '',
        mentions_procedurales_fr: text.mentions_procedurales_fr ?? '',
        mentions_procedurales_ht: text.mentions_procedurales_ht ?? '',
        category: text.category,
        code_subcategory: text.code_subcategory ?? '',
        status: text.status,
        official_number: text.official_number ?? '',
        issuing_authority: text.issuing_authority ?? '',
        official_formula: text.official_formula ?? '',
        enacting_formula_fr: text.enacting_formula_fr ?? '',
        enacting_formula_ht: text.enacting_formula_ht ?? '',
        comment: '',
      })
      setAbrogatingLaw(seedAbrogatingLaw(text.abrogated_by))
      setSelectedThemes(seedThemeSet(text.theme_tags))
      setMpBeforeConsiderants(!!text.mentions_procedurales_before_considerants)
    }
    onOpenChange(next)
  }

  function toggleTheme(theme: LegalThemeKey) {
    setSelectedThemes((prev) => {
      const next = new Set(prev)
      if (next.has(theme)) {
        next.delete(theme)
      } else {
        next.add(theme)
      }
      return next
    })
  }

  function patch<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function save() {
    if (!form.title_fr.trim()) {
      toast(t('metadataEditor.titleFrEmpty'))
      return
    }
    // Slug format check — mirrors the backend ``_SLUG_RE`` so the
    // editor gets immediate feedback instead of a round-trip error
    // dressed up as a generic "failed" toast.
    const trimmedSlug = form.slug.trim()
    if (!trimmedSlug) {
      toast(t('metadataEditor.slugEmpty'))
      return
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/.test(trimmedSlug)) {
      toast(t('metadataEditor.slugInvalid'))
      return
    }
    // Build a minimal patch — only fields that actually changed. The backend
    // also no-ops unchanged values, but this keeps the audit log diff clean
    // and the request payload small.
    const original = {
      slug: text.slug,
      title_fr: text.title_fr,
      title_ht: text.title_ht ?? '',
      official_title_fr: text.official_title_fr ?? '',
      official_title_ht: text.official_title_ht ?? '',
      description_fr: text.description_fr ?? '',
      description_ht: text.description_ht ?? '',
      issuing_date: text.issuing_date ?? '',
      promulgation_date: text.promulgation_date ?? '',
      publication_date: text.publication_date ?? '',
      moniteur_ref: text.moniteur_ref ?? '',
      mentions_procedurales_fr: text.mentions_procedurales_fr ?? '',
      mentions_procedurales_ht: text.mentions_procedurales_ht ?? '',
      category: text.category,
      code_subcategory: text.code_subcategory ?? '',
      status: text.status,
      official_number: text.official_number ?? '',
      issuing_authority: text.issuing_authority ?? '',
      official_formula: text.official_formula ?? '',
      enacting_formula_fr: text.enacting_formula_fr ?? '',
      enacting_formula_ht: text.enacting_formula_ht ?? '',
    }
    const body: LegalTextMetadataPatch = {}
    ;(Object.keys(original) as (keyof typeof original)[]).forEach((key) => {
      const a = (form as Record<string, string>)[key].trim()
      const b = String(original[key] ?? '').trim()
      if (a === b) return
      // Empty string for nullable fields → null. title_fr + slug are
      // non-nullable on the backend, so they get passed through
      // verbatim (empty-slug validation happens above in the form
      // guards).
      if (key === 'title_fr') {
        body.title_fr = a
      } else if (key === 'slug') {
        body.slug = a
      } else if (key === 'category') {
        body.category = a as LegalTextMetadataPatch['category']
      } else if (key === 'status') {
        body.status = a as LegalTextMetadataPatch['status']
      } else if (key === 'code_subcategory') {
        body.code_subcategory = a
          ? (a as LegalTextMetadataPatch['code_subcategory'])
          : null
      } else {
        ;(body as Record<string, string | null>)[key] = a === '' ? null : a
      }
    })

    // Abrogated-by pointer — diffed separately because it's not a
    // column on the LegalText. Backend interprets ``null`` as "clear
    // the LegalChange row" and a slug as "upsert" (see
    // ``abrogated_by_slug`` in ``LegalTextMetadataUpdate``).
    const originalAbrogatingSlug = text.abrogated_by?.slug ?? null
    const currentAbrogatingSlug = abrogatingLaw?.slug ?? null
    if (originalAbrogatingSlug !== currentAbrogatingSlug) {
      ;(body as Record<string, string | null>).abrogated_by_slug =
        currentAbrogatingSlug
    }

    // Boolean toggle for the 19th-century block order.
    if (
      mpBeforeConsiderants !==
      !!text.mentions_procedurales_before_considerants
    ) {
      ;(body as Record<string, boolean>).mentions_procedurales_before_considerants =
        mpBeforeConsiderants
    }

    // Theme tag diff — separate API endpoint (PUT /themes). Editor-
    // confirmed snapshot at open time vs current selection. Only
    // call the endpoint when the set actually changed.
    const originalThemeSet = seedThemeSet(text.theme_tags)
    const themesChanged =
      originalThemeSet.size !== selectedThemes.size ||
      [...selectedThemes].some((t) => !originalThemeSet.has(t))

    if (Object.keys(body).length === 0 && !themesChanged) {
      onOpenChange(false)
      return
    }

    if (form.comment.trim()) body.comment = form.comment.trim()

    startTransition(async () => {
      try {
        let updated = text as unknown as { slug: string }
        if (Object.keys(body).length > 0) {
          updated = await updateLegalTextMetadata(text.slug, body)
        }
        if (themesChanged) {
          // Use the (possibly new) slug if the metadata patch renamed
          // the text; otherwise the current one.
          await updateLegalTextThemes(
            updated.slug ?? text.slug,
            [...selectedThemes],
          )
        }
        toast(t('metadataEditor.saved'))
        onOpenChange(false)
        // If the slug changed, notify the parent so it can redirect
        // the URL — the old slug now 404s on subsequent reads.
        if (body.slug && updated.slug && updated.slug !== text.slug) {
          onSlugChanged?.(updated.slug)
        } else {
          onSaved?.()
        }
      } catch (err) {
        const code = err instanceof ApiError ? ` (${err.status})` : ''
        toast(`${t('metadataEditor.failed')}${code}`)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0"
      >
        <SheetHeader className="px-8 pt-8 pb-2">
          <SheetTitle>{t('metadataEditor.title')}</SheetTitle>
          <SheetDescription>{t('metadataEditor.desc')}</SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-6 px-8 pb-32">
          <Field label={t('metadataEditor.titleFr')}>
            <Input
              value={form.title_fr}
              onChange={(e) => patch('title_fr', e.target.value)}
              required
            />
          </Field>

          <Field label={t('metadataEditor.titleHt')}>
            <Input
              value={form.title_ht}
              onChange={(e) => patch('title_ht', e.target.value)}
            />
          </Field>

          {/* Moniteur-verbatim title — multi-line so editors can paste
              the original printed form which often wraps over 2–3
              lines (the page-1 sommaire and the heading above the
              issuing authority both carry the same long uppercase
              sentence). Kept in its own pair of fields so the
              citation-form title above stays clean. */}
          <Field
            label={t('metadataEditor.officialTitleFr')}
            hint={t('metadataEditor.officialTitleHint')}
          >
            <Textarea
              rows={3}
              value={form.official_title_fr}
              onChange={(e) => patch('official_title_fr', e.target.value)}
            />
          </Field>

          <Field label={t('metadataEditor.officialTitleHt')}>
            <Textarea
              rows={3}
              value={form.official_title_ht}
              onChange={(e) => patch('official_title_ht', e.target.value)}
            />
          </Field>

          {/* Slug override — the parser produces a slug from the
              title, which can run to 80+ characters for long
              arrêté titles. The editor can shorten it here. The
              backend validates the format and rejects collisions. */}
          <Field
            label={t('metadataEditor.slug')}
            hint={t('metadataEditor.slugHint')}
          >
            <Input
              value={form.slug}
              onChange={(e) => patch('slug', e.target.value)}
              className="font-mono text-sm"
              spellCheck={false}
            />
            {form.slug !== text.slug && (
              <p className="mt-1 text-[11px] text-amber-700">
                {t('metadataEditor.slugChangedWarning')}
              </p>
            )}
          </Field>

          <Field
            label={t('metadataEditor.descFr')}
            hint={t('metadataEditor.descHint')}
          >
            <Textarea
              rows={3}
              value={form.description_fr}
              onChange={(e) => patch('description_fr', e.target.value)}
            />
          </Field>

          <Field label={t('metadataEditor.descHt')}>
            <Textarea
              rows={3}
              value={form.description_ht}
              onChange={(e) => patch('description_ht', e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('metadataEditor.category')}>
              <Select
                value={form.category}
                onValueChange={(v) => patch('category', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {categoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t('metadataEditor.legalStatus')}>
              <Select
                value={form.status}
                onValueChange={(v) => patch('status', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Abrogating-act picker — only relevant when status is
              ``abrogated``. We still render the existing chip when the
              user reverts the status without clearing the pointer, so
              the editor can see + clear stale links. */}
          {(form.status === 'abrogated' || abrogatingLaw) && (
            <Field
              label={t('metadataEditor.abrogatingAct', {
                fallback: 'Acte abrogeant',
              })}
              hint={t('metadataEditor.abrogatingActHint', {
                fallback:
                  'La loi / le décret qui a abrogé ce texte. Apparaît sous forme de pastille « Abrogée par … » sur la fiche.',
              })}
            >
              <AbrogatingLawPicker
                value={abrogatingLaw}
                onChange={setAbrogatingLaw}
                isFr={isFr}
              />
            </Field>
          )}

          {/* Thématiques — closed-vocabulary chips. The full LegalTheme
              enum is rendered; selected chips are filled (editor-confirmed
              on save), unselected sit as outline. Auto-suggester tags that
              already match are pre-selected and get promoted to "editor"
              source on save. */}
          <Field
            label={
              isFr ? 'Thématiques' : 'Tèm'
            }
            hint={
              isFr
                ? "Sélectionnez les domaines de droit que ce texte couvre. Apparaît comme pastilles thématiques sur la fiche et alimente le filtre /lois?theme=…"
                : 'Chwazi domèn dwa tèks sa a kouvri. Parèt kòm pastil tematik sou fich la epi alimante filtè /lois?theme=…'
            }
          >
            <div className="flex flex-wrap gap-2">
              {THEME_KEYS.map((key) => {
                const isSelected = selectedThemes.has(key)
                const label = THEME_LABELS[key][isFr ? 'fr' : 'ht']
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTheme(key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-300/50 hover:bg-amber-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900',
                    )}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <span aria-hidden="true">✓</span>}
                    {label}
                  </button>
                )
              })}
            </div>
            {selectedThemes.size > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                {isFr
                  ? `${selectedThemes.size} thématique${selectedThemes.size > 1 ? 's' : ''} sélectionnée${selectedThemes.size > 1 ? 's' : ''}.`
                  : `${selectedThemes.size} tèm chwazi.`}
              </p>
            )}
          </Field>

          {form.category === 'code' && (
            <Field label={t('metadataEditor.codeSubcategory')}>
              <Select
                value={form.code_subcategory || '__none'}
                onValueChange={(v) =>
                  patch('code_subcategory', v === '__none' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— {t('metadataEditor.none')} —</SelectItem>
                  {SUBCATEGORY_OPTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              label={t('metadataEditor.issuingDate', {
                fallback: "Date d'émission",
              })}
              hint={t('metadataEditor.issuingDateHint', {
                fallback: '« Fait à …, le … » / adoption parlementaire',
              })}
            >
              <Input
                type="date"
                value={form.issuing_date}
                onChange={(e) => patch('issuing_date', e.target.value)}
              />
            </Field>
            <Field label={t('metadataEditor.promulgationDate')}>
              <Input
                type="date"
                value={form.promulgation_date}
                onChange={(e) => patch('promulgation_date', e.target.value)}
              />
            </Field>
            <Field label={t('metadataEditor.publicationDate')}>
              <Input
                type="date"
                value={form.publication_date}
                onChange={(e) => patch('publication_date', e.target.value)}
              />
            </Field>
          </div>

          <Field label={t('metadataEditor.moniteurRef')} hint={t('metadataEditor.moniteurHint')}>
            <Input
              value={form.moniteur_ref}
              onChange={(e) => patch('moniteur_ref', e.target.value)}
              placeholder="n° 47 du 4 juin 2014"
            />
          </Field>

          {/* Provenance / source citation. Rendered on the law-detail
              hero as the "Source" tile when the value starts with
              "Source :" and includes a URL. Editors fill this in for
              historical texts (e.g. the Janvier book chapters) and
              archive-scan provenance. Two textareas so both languages
              can carry their own citation (HT rarely set). */}
          <Field
            label={t('metadataEditor.source', { fallback: 'Source / provenance' })}
            hint={t('metadataEditor.sourceHint', {
              fallback:
                'Citation du document source. Format reconnu par la fiche : « Source : <référence>. Voir <url>. ». Le tuile « Source » sur la fiche extrait l\'URL automatiquement.',
            })}
          >
            <Textarea
              rows={2}
              value={form.mentions_procedurales_fr}
              onChange={(e) => patch('mentions_procedurales_fr', e.target.value)}
              placeholder="Source : gallica.bnf.fr — Les Constitutions d'Haïti par L.-J. Janvier, 1886, Chapitre VIII. Voir https://gallica.bnf.fr/ark:/…"
              className="font-mono text-xs"
            />
          </Field>
          <Field
            label={t('metadataEditor.sourceHt', { fallback: 'Source / provenance (Kreyòl)' })}
          >
            <Textarea
              rows={2}
              value={form.mentions_procedurales_ht}
              onChange={(e) => patch('mentions_procedurales_ht', e.target.value)}
              placeholder="(facultatif)"
              className="font-mono text-xs"
            />
          </Field>

          {/* Pre-article block-order toggle. Defaults to false (modern
              drafting: considérants before mentions procédurales).
              Many 19th-century Haitian laws print the order inverted —
              the editor flips this checkbox to mirror the source. */}
          <Field
            label={
              isFr
                ? "Ordre d'affichage : mentions avant considérants"
                : 'Lòd afichaj : mansyon anvan konsideran'
            }
            hint={
              isFr
                ? "À activer pour les textes historiques (XIXᵉ siècle) qui impriment « Sur le rapport du… » AVANT les « Considérant que… ». Laissé décoché, l'affichage suit l'ordre moderne (considérants en premier)."
                : 'Aktive li pou tèks istorik yo (XIXyèm syèk) ki ekri « Sur le rapport du… » AVAN « Considérant que… ». Si w pa chèke l, afichaj la swiv lòd modèn nan (konsideran an premye).'
            }
          >
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={mpBeforeConsiderants}
                onChange={(e) => setMpBeforeConsiderants(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                {isFr
                  ? 'Afficher « Mentions procédurales » avant « Considérants »'
                  : 'Montre « Mansyon pwosedi » anvan « Konsideran »'}
              </span>
            </label>
          </Field>

          {/* Official metadata block — page-1 + post-dispositif fields.
              Editable as plain text; the parser pre-fills these on
              import but the editor has the final word. */}
          <Field
            label={t('metadataEditor.officialNumber')}
            hint={t('metadataEditor.officialNumberHint')}
          >
            <Input
              value={form.official_number}
              onChange={(e) => patch('official_number', e.target.value)}
              placeholder="CL-007-09-09"
              className="font-mono"
            />
          </Field>

          <Field
            label={t('metadataEditor.issuingAuthority')}
            hint={t('metadataEditor.issuingAuthorityHint')}
          >
            <Textarea
              rows={3}
              value={form.issuing_authority}
              onChange={(e) => patch('issuing_authority', e.target.value)}
              placeholder="CORPS LÉGISLATIF"
              className="font-mono"
            />
          </Field>

          <Field
            label={t('metadataEditor.officialFormula')}
            hint={t('metadataEditor.officialFormulaHint')}
          >
            <Textarea
              rows={6}
              value={form.official_formula}
              onChange={(e) => patch('official_formula', e.target.value)}
              placeholder={'Votée au Sénat …\n\nDonné au Palais National …'}
              className="font-mono text-xs"
            />
          </Field>

          {/* Enacting formula — the short adoption line that sits
              just above the article block on the reader page
              ("Sur proposition de … le Sénat a adopté la loi
              suivante :"). Distinct from ``official_formula`` which
              is the long page-1 + post-dispositif sovereignty /
              promulgation block. Bilingual; either or both can be
              filled. */}
          <Field
            label={t('metadataEditor.enactingFormulaFr')}
            hint={t('metadataEditor.enactingFormulaHint')}
          >
            <Textarea
              rows={2}
              value={form.enacting_formula_fr}
              onChange={(e) => patch('enacting_formula_fr', e.target.value)}
              placeholder="Sur proposition de … le Sénat a adopté la loi suivante :"
              className="italic text-sm"
            />
          </Field>

          <Field label={t('metadataEditor.enactingFormulaHt')}>
            <Textarea
              rows={2}
              value={form.enacting_formula_ht}
              onChange={(e) => patch('enacting_formula_ht', e.target.value)}
              className="italic text-sm"
            />
          </Field>

          <Field label={t('metadataEditor.comment')}>
            <Textarea
              rows={2}
              value={form.comment}
              onChange={(e) => patch('comment', e.target.value)}
            />
          </Field>
        </div>

        <div className="fixed bottom-0 right-0 w-full sm:max-w-2xl lg:max-w-3xl border-t bg-white px-8 py-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t('metadataEditor.cancel')}
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {pending ? t('metadataEditor.saving') : t('metadataEditor.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          {hint}
        </span>
      )}
    </label>
  )
}

// LegalTextListItem includes more fields than ``abrogated_by`` carries
// (category, status, …). For the picker initial state, we synthesise a
// minimal LegalTextListItem from the AbrogatedByRef so the
// already-selected card shows the right title without a refetch.
function seedAbrogatingLaw(
  ref: LegalTextMetadata['abrogated_by'],
): LegalTextListItem | null {
  if (!ref) return null
  return {
    id: 0, // synthetic — we only use slug + titles; id never round-trips
    slug: ref.slug,
    title_fr: ref.title_fr,
    title_ht: ref.title_ht,
    category: 'loi',
    code_subcategory: null,
    status: 'in_force',
    editorial_status: 'published',
    publication_date: null,
    description_fr: null,
    description_ht: null,
    created_at: null,
    updated_at: null,
    published_at: null,
    theme_tags: [],
    match_snippets: null,
    moniteur_ref: null,
  } as unknown as LegalTextListItem
}

// Autocomplete picker used in MetadataEditor to record which law has
// abrogated the current one. Mirrors the LawPicker pattern from
// ``/editorial/amend`` but inline + simpler (just one picker, no
// per-section help banner). Debounced search against
// ``listEditorialTexts({ q })`` — same source the dropdown uses on the
// amend page so editors get consistent results.
function AbrogatingLawPicker({
  value,
  onChange,
  isFr,
}: {
  value: LegalTextListItem | null
  onChange: (v: LegalTextListItem | null) => void
  isFr: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<LegalTextListItem[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) return
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const handle = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await listEditorialTexts({ q, limit: 12 })
        if (!cancelled) setResults(res.items ?? [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, value])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50/40 p-3">
        <div className="flex items-start gap-2 min-w-0">
          <Ban className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {(isFr ? value.title_fr : value.title_ht || value.title_fr) ||
                value.slug}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
              {value.slug}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setQuery('')
            setResults([])
          }}
          className="text-slate-400 hover:text-red-600 flex-shrink-0"
          aria-label={isFr ? 'Effacer' : 'Efase'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <Input
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        placeholder={
          isFr ? 'Rechercher par titre ou slug…' : 'Chèche pa tit oswa slug…'
        }
        className="pl-9 pr-9"
      />
      {loading && (
        <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 animate-spin" />
      )}
      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-2.5 text-xs text-slate-400 italic">
              {isFr ? 'Aucun résultat' : 'Pa gen rezilta'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(r)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 hover:bg-red-50/60 transition-colors',
                    )}
                  >
                    <p className="text-sm text-slate-800 leading-tight line-clamp-2">
                      {(isFr ? r.title_fr : r.title_ht || r.title_fr) || r.slug}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                      {r.slug}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
