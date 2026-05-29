'use client'

import React from 'react'
import {
  Ban,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Newspaper,
  PenLine,
  Tags,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { EditableHeroField } from '@/components/law-details/_helpers/EditableHeroField'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { DownloadDropdown } from './_panels/DownloadDropdown'
import { OfficialNumberTab } from './_panels/OfficialNumberTab'
import {
  moniteurIssueSlug,
  updateLegalTextMetadata,
} from '@/lib/api/endpoints'
import { useT } from '@/i18n/useT'
import { themeLabel } from '@/lib/themes'
import { formatLongDate } from '@/lib/format/date'
import {
  TEXT_STATUS_PILL,
  type TextStatus,
} from './_helpers/textStatus'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

interface ArticleCounts {
  total: number
  topLevel: number
  highestNumber: number
  abrogated: number
  rawCount: number
  wholeTextAbrogated: boolean
}

interface LawHeroProps {
  law: LegalTextRead
  slug: string
  title: string
  description: string | null | undefined
  category: { fr: string; ht: string; color: string }
  currentLang: 'fr' | 'ht'
  language: string
  isEditor: boolean
  isDocumentMode: boolean
  articleCounts: ArticleCounts
  refetch: () => void
}

/**
 * The dark hero header band at the top of the law detail page.
 * Contains: status pill, official number, title, description,
 * metadata row (year, articles, Moniteur ref, amended-by,
 * abrogated-by, source, amendments link), download, theme chips.
 */
export function LawHero({
  law,
  slug,
  title,
  description,
  category,
  currentLang,
  language,
  isEditor,
  isDocumentMode,
  articleCounts,
  refetch,
}: LawHeroProps) {
  const { t } = useT()

  return (
    <div className="relative bg-primary dark:bg-slate-900 text-white overflow-hidden border-b border-white/5 dark:border-slate-800">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div aria-hidden className="h-20" />
      <div className="relative z-10 container py-12 lg:py-20">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[300px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

        <Breadcrumb
          className="mb-8"
          items={[
            { label: t('lawDetail.breadcrumb.home'), href: '/' },
            { label: t('lawDetail.breadcrumb.laws'), href: '/lois' },
            { label: category[currentLang] },
          ]}
        />

        <div className="flex flex-col gap-8 lg:gap-10">
          {/* 1. Status + N officiel */}
          <div className="animate-in fade-in slide-in-from-top-3 duration-500 flex flex-wrap items-center gap-3">
            {(() => {
              const status = (law.status as TextStatus) ?? 'in_force'
              const meta = TEXT_STATUS_PILL[status] ?? TEXT_STATUS_PILL.in_force
              const StatusIcon = meta.icon
              return (
                <Badge
                  className={`border ${meta.cls} px-4 py-1.5 font-bold uppercase tracking-wider text-[10px] rounded-full`}
                >
                  <StatusIcon className="w-3 h-3 mr-1.5" />
                  {meta.label[currentLang]}
                </Badge>
              )
            })()}
            {(law.official_number || isEditor) && (
              <EditableHeroField
                value={law.official_number ?? ''}
                isEditor={isEditor}
                editAriaLabel={
                  currentLang === 'fr'
                    ? 'Modifier le numéro officiel'
                    : 'Modifye nimewo ofisyèl'
                }
                emptyPlaceholder={
                  currentLang === 'fr'
                    ? '+ Ajouter un numéro'
                    : '+ Ajoute yon nimewo'
                }
                onSave={async (next) => {
                  await updateLegalTextMetadata(law.slug, {
                    official_number: next || null,
                  } as any)
                  refetch()
                }}
              >
                {law.official_number ? (
                  <OfficialNumberTab
                    value={law.official_number}
                    category={law.category}
                    lang={currentLang}
                  />
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 italic">
                    {currentLang === 'fr'
                      ? '+ Ajouter un numéro'
                      : '+ Ajoute yon nimewo'}
                  </span>
                )}
              </EditableHeroField>
            )}
          </div>

          {/* 2. Title + description */}
          <div className="flex flex-col gap-6 lg:gap-8">
            <h1 className="animate-in fade-in slide-in-from-top-3 duration-500 delay-100 fill-mode-both text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black leading-[1.15] sm:leading-[1.1] tracking-tight text-white drop-shadow-sm break-words">
              <EditableHeroField
                value={title}
                isEditor={isEditor}
                editAriaLabel={
                  currentLang === 'fr' ? 'Modifier le titre' : 'Modifye tit la'
                }
                inputClassName="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black leading-[1.15] sm:leading-[1.1] tracking-tight w-full"
                onSave={async (next) => {
                  if (!next) throw new Error('Le titre ne peut pas être vide')
                  const field = currentLang === 'ht' ? 'title_ht' : 'title_fr'
                  await updateLegalTextMetadata(law.slug, {
                    [field]: next,
                  } as any)
                  refetch()
                }}
              >
                {title}
              </EditableHeroField>
            </h1>

            <p className="animate-in fade-in duration-500 delay-200 fill-mode-both text-slate-300 text-lg lg:text-xl leading-relaxed">
              {description}
            </p>
          </div>

          {/* 3. Metadata row */}
          <div className="animate-in fade-in duration-500 delay-300 fill-mode-both flex flex-wrap items-center gap-x-8 gap-y-5">
            <div className="contents">
              {/* Year */}
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-full border border-white/10">
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                    {t('lawDetail.meta.year')}
                  </p>
                  <p className="text-white font-bold">
                    {(() => {
                      const ownDate = law.publication_date ?? ''
                      const shownYear =
                        law.publication_date?.slice(0, 4) ||
                        law.moniteur_issue_publication_date?.slice(0, 4) ||
                        ''
                      return (
                        <EditableHeroField
                          value={ownDate}
                          isEditor={isEditor}
                          kind="date"
                          emptyPlaceholder="—"
                          editAriaLabel={
                            currentLang === 'fr'
                              ? 'Modifier la date'
                              : 'Modifye dat la'
                          }
                          inputClassName="w-44 font-bold"
                          onSave={async (next) => {
                            await updateLegalTextMetadata(law.slug, {
                              publication_date: next || null,
                            } as any)
                            refetch()
                          }}
                        >
                          {shownYear || '—'}
                        </EditableHeroField>
                      )
                    })()}
                  </p>
                </div>
              </div>

              {/* Article count chip */}
              {!isDocumentMode && (
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-full border border-white/10">
                  <FileText className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                    {t('lawDetail.meta.content')}
                  </p>
                  <p className="text-white font-bold inline-flex items-center gap-1.5">
                    <span>
                      {articleCounts.total}{' '}
                      {t('lawDetail.meta.articles')}
                    </span>
                    <ArticleCountBreakdown
                      articleCounts={articleCounts}
                      currentLang={currentLang}
                    />
                  </p>
                </div>
              </div>
              )}

              {/* Moniteur reference */}
              <MoniteurReference law={law} currentLang={currentLang} />

              {/* Amended by */}
              {law.amended_by && law.amended_by.length > 0 && (
                <AmendedByChip law={law} currentLang={currentLang} />
              )}

              {/* Abrogated by */}
              {law.abrogated_by && (
                <div className="flex items-center gap-4 min-w-0 max-w-full">
                  <div className="p-3 bg-red-500/10 rounded-full border border-red-400/20">
                    <Ban className="w-5 h-5 text-red-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-300/80 mb-0.5">
                      {currentLang === 'fr' ? 'Abrogée par' : 'Abwoje pa'}
                    </p>
                    <Link
                      href={`/loi/${law.abrogated_by.slug}`}
                      className="text-white font-bold hover:underline underline-offset-4 decoration-white/30 hover:decoration-white/60 line-clamp-2 text-sm sm:text-base"
                    >
                      {(currentLang === 'ht' &&
                        law.abrogated_by.title_ht) ||
                        law.abrogated_by.title_fr ||
                        law.abrogated_by.slug}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Amendments link */}
            {law.amended_by && law.amended_by.length > 0 && (
              <Link
                href={`/loi/${slug}/amendements`}
                className="group flex items-center gap-4 text-left rounded-xl -m-2 p-2 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={
                  currentLang === 'fr'
                    ? 'Voir les amendements'
                    : 'Wè amandman yo'
                }
              >
                <div className="p-3 bg-amber-500/10 rounded-full border border-amber-400/20 group-hover:bg-amber-500/15 group-hover:border-amber-400/30 transition-colors">
                  <PenLine className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/80 mb-0.5">
                    {currentLang === 'fr' ? 'Amendements' : 'Amandman yo'}
                  </p>
                  <p className="text-white font-bold inline-flex items-center gap-1.5 group-hover:underline">
                    <span>
                      {law.amended_by.length}{' '}
                      {currentLang === 'fr'
                        ? law.amended_by.length > 1
                          ? 'loi(s) modifiante(s)'
                          : 'loi modifiante'
                        : law.amended_by.length > 1
                          ? 'lwa modifikatè'
                          : 'lwa modifikatè'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            )}

            <DownloadDropdown slug={slug} language={language} />
          </div>

          {/* 4. Theme chips */}
          {law.theme_tags && law.theme_tags.length > 0 && (
            <div
              className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both flex flex-wrap items-center gap-2"
              style={{ animationDelay: '350ms' }}
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 mr-1">
                <Tags className="w-3.5 h-3.5" />
                {currentLang === 'fr' ? 'Thématiques' : 'Tèm'}
              </span>
              {law.theme_tags.map((tag: components['schemas']['LegalThemeTagRead']) => {
                const label = themeLabel(tag.theme, currentLang) ?? tag.theme
                const isEditorTag = tag.source === 'editor'
                return (
                  <Link
                    key={tag.theme}
                    href={`/lois?theme=${tag.theme}`}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all',
                      isEditorTag
                        ? 'bg-white text-slate-900 hover:bg-amber-100 ring-1 ring-amber-300/50'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15 ring-1 ring-white/10',
                    )}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Internal sub-components ──────────────────────────────────────

/** Article count info dropdown */
function ArticleCountBreakdown({
  articleCounts,
  currentLang,
}: {
  articleCounts: ArticleCounts
  currentLang: 'fr' | 'ht'
}) {
  const rawCount = articleCounts.rawCount
  const numberingMismatch =
    articleCounts.highestNumber > 0 &&
    rawCount !== articleCounts.highestNumber
  const hasAbrogated = articleCounts.abrogated > 0
  const wholeAbrogated = articleCounts.wholeTextAbrogated
  const showSplit = hasAbrogated && !wholeAbrogated
  if (!numberingMismatch && !showSplit) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            currentLang === 'fr'
              ? 'Détails du décompte'
              : 'Detay konte a'
          }
          className="ml-0.5 text-slate-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-full"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="max-w-sm p-4 space-y-3"
      >
        <div className="flex flex-wrap gap-3 pb-3 border-b border-slate-100">
          {showSplit ? (
            <>
              <span className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                  {currentLang === 'fr' ? 'En vigueur' : 'An vigè'}
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums">
                  {articleCounts.total}
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
                  {currentLang === 'fr' ? 'Abrogés' : 'Abwoje'}
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums">
                  {articleCounts.abrogated}
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {currentLang === 'fr' ? 'Total' : 'Total'}
                </span>
                <span className="text-lg font-black text-slate-900 tabular-nums">
                  {rawCount}
                </span>
              </span>
            </>
          ) : (
            <span className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {currentLang === 'fr' ? 'Articles' : 'Atik'}
              </span>
              <span className="text-lg font-black text-slate-900 tabular-nums">
                {rawCount}
              </span>
            </span>
          )}
        </div>
        <div className="text-xs leading-relaxed space-y-2 text-slate-600">
          {numberingMismatch && rawCount < articleCounts.highestNumber &&
            (currentLang === 'fr' ? (
              <p>
                Le dernier article est numéroté{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.highestNumber}
                </span>
                , mais le corpus n'en contient que{' '}
                <span className="font-bold text-slate-900">
                  {rawCount}
                </span>
                {' '}: certains articles manquent encore
                à la transcription et seront ajoutés à
                mesure de la curation éditoriale.
              </p>
            ) : (
              <p>
                Dènye atik la nimewote{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.highestNumber}
                </span>
                , men korpis la genyen sèlman{' '}
                <span className="font-bold text-slate-900">
                  {rawCount}
                </span>
                {' '}: kèk atik manke nan transkripsyon
                an e yo pral ajoute apre kirasyon
                editoryal.
              </p>
            ))}
          {numberingMismatch && rawCount > articleCounts.highestNumber &&
            (currentLang === 'fr' ? (
              <p>
                Le dernier article est numéroté{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.highestNumber}
                </span>
                , mais le texte contient{' '}
                <span className="font-bold text-slate-900">
                  {rawCount}
                </span>{' '}
                articles : un article 10 et un article
                10&nbsp;bis comptent comme deux articles
                distincts, même si le numéro reste le
                même.
              </p>
            ) : (
              <p>
                Dènye atik la nimewote{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.highestNumber}
                </span>
                , men tèks la gen{' '}
                <span className="font-bold text-slate-900">
                  {rawCount}
                </span>{' '}
                atik : yon atik 10 ak yon atik
                10&nbsp;bis konte kòm de atik diferan,
                menm si nimewo a rete menm jan an.
              </p>
            ))}
          {showSplit &&
            (currentLang === 'fr' ? (
              <p>
                Les{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.abrogated}
                </span>{' '}
                article{articleCounts.abrogated > 1 ? 's' : ''}{' '}
                abrogé{articleCounts.abrogated > 1 ? 's' : ''}{' '}
                ne sont pas comptés dans le total en
                vigueur, mais restent consultables
                dans le texte avec leur statut.
              </p>
            ) : (
              <p>
                Yo pa konte{' '}
                <span className="font-bold text-slate-900">
                  {articleCounts.abrogated}
                </span>{' '}
                atik abwoje nan total ki an vigè a,
                men yo rete disponib pou konsiltasyon
                nan tèks la ak estati yo.
              </p>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Moniteur reference tile */
function MoniteurReference({
  law,
  currentLang,
}: {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
}) {
  if (law.moniteur_issue_id) {
    const pubDate = law.moniteur_issue_publication_date
    const formatted = formatLongDate(pubDate, 'fr')
    const dateStr = formatted ? `du ${formatted}` : ''
    const prettyNum = (n: string | null | undefined) =>
      /^[0-9]/.test(n ?? '') ? `N° ${n}` : (n ?? '')
    const slugFr = moniteurIssueSlug({
      id: law.moniteur_issue_id,
      publication_date: law.moniteur_issue_publication_date ?? null,
      number: law.moniteur_issue_number ?? null,
    })
    const slugHt = law.moniteur_issue_id_ht
      ? moniteurIssueSlug({
          id: law.moniteur_issue_id_ht,
          publication_date:
            law.moniteur_issue_publication_date_ht ?? null,
          number: law.moniteur_issue_number_ht ?? null,
        })
      : null
    return (
      <div className="flex items-center gap-4 min-w-0 max-w-full">
        <div className="p-3 bg-white/5 rounded-full border border-white/10">
          <Newspaper className="w-5 h-5 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
            {currentLang === 'fr' ? 'Publié dans' : 'Pibliye nan'}
          </p>
          <p className="text-white font-medium truncate max-w-[24rem]">
            <Link
              href={`/moniteur/${slugFr}`}
              className="hover:underline"
            >
              <em className="italic font-semibold">Le Moniteur</em>{' '}
              <span className="font-normal text-slate-200">
                {prettyNum(law.moniteur_issue_number)} {dateStr}
              </span>
            </Link>
          </p>
          {slugHt && (
            <Link
              href={`/moniteur/${slugHt}`}
              className="block mt-0.5 text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
            >
              {prettyNum(law.moniteur_issue_number_ht)}{' '}
              <span className="text-slate-500">
                ·{' '}
                {currentLang === 'fr'
                  ? 'version créole'
                  : 'vèsyon kreyòl'}
              </span>
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Fallback: legacy free-text moniteur_ref field
  const raw = (law.moniteur_ref ?? '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return null
  if (/^source\s*:/i.test(raw)) return null
  const alreadyPrefixed = /^(?:le\s+)?moniteur\b/i.test(raw)
  const body = alreadyPrefixed
    ? raw.replace(/^(?:le\s+)?moniteur\b\s*/i, '')
    : raw
  return (
    <div className="flex items-center gap-4 min-w-0 max-w-full">
      <div className="p-3 bg-white/5 rounded-full border border-white/10">
        <Newspaper className="w-5 h-5 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
          {currentLang === 'fr' ? 'Référence' : 'Referans'}
        </p>
        <p className="text-white font-medium truncate max-w-[24rem]">
          <em className="italic font-semibold">Le Moniteur</em>{' '}
          <span className="font-normal text-slate-200">
            {body}
          </span>
        </p>
      </div>
    </div>
  )
}

/** Amended-by chip with dropdown */
function AmendedByChip({
  law,
  currentLang,
}: {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
}) {
  return (
    <div className="flex items-center gap-4 min-w-0 max-w-full">
      <div className="p-3 bg-white/5 rounded-full border border-white/10">
        <PenLine className="w-5 h-5 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
          {currentLang === 'fr' ? 'Amendée par' : 'Modifye pa'}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="text-white font-bold inline-flex items-center gap-1.5 hover:underline focus:outline-none"
            >
              <span>
                {law.amended_by.length}{' '}
                {currentLang === 'fr'
                  ? law.amended_by.length > 1
                    ? 'lois'
                    : 'loi'
                  : law.amended_by.length > 1
                    ? 'lwa'
                    : 'lwa'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="max-w-md"
          >
            {law.amended_by.map((a: components['schemas']['AmendedByRef']) => {
              const aTitle =
                currentLang === 'ht' && a.title_ht
                  ? a.title_ht
                  : a.title_fr
              return (
                <DropdownMenuItem key={a.id} asChild>
                  <Link
                    href={`/loi/${a.slug}`}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-sm font-medium text-slate-900 line-clamp-2">
                      {aTitle}
                    </span>
                    {a.publication_date && (
                      <span className="text-[11px] text-slate-500">
                        {formatLongDate(
                          a.publication_date,
                          currentLang,
                        )}
                      </span>
                    )}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

