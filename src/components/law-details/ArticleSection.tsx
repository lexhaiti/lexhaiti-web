'use client'

import React from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ArticleViewer from './ArticleViewer'
import PreambleViewer from './PreambleViewer'
import { DocumentBody } from './DocumentBody'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import { mapTextStatusToArticleStatus } from './_helpers/textStatus'
import type { SelectedArticle } from './_helpers/lawDetailTypes'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

interface ArticleSectionProps {
  law: LegalTextRead
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  isDocumentMode: boolean
  hasArticles: boolean
  selectedArticle: SelectedArticle | null
  currentArticleIndex: number
  title: string
  articleBreadcrumb: any[]
  blocHints: { prev: string | null; next: string | null }
  onPrevious: () => void
  onNext: () => void
  onShare: () => Promise<void>
  onCopyLink: () => void
  onEmptyAddArticle: () => void
  refetch: () => void
}

/**
 * The main article/document body area. Switches between:
 * - Document mode (foundational texts)
 * - Article viewer (structured texts)
 * - Empty editor state (no articles, editor signed in)
 * - Preamble-only fallback (no articles, public view)
 */
export function ArticleSection({
  law,
  currentLang,
  isEditor,
  isDocumentMode,
  hasArticles,
  selectedArticle,
  currentArticleIndex,
  title,
  articleBreadcrumb,
  blocHints,
  onPrevious,
  onNext,
  onShare,
  onCopyLink,
  onEmptyAddArticle,
  refetch,
}: ArticleSectionProps) {
  if (isDocumentMode) {
    return (
      <DocumentBody
        isEditor={isEditor}
        lang={currentLang}
        value={
          currentLang === 'ht'
            ? ((law as any).document_body_ht || (law as any).document_body_fr || null)
            : ((law as any).document_body_fr || null)
        }
        fallbackToFr={
          currentLang === 'ht' &&
          !(law as any).document_body_ht &&
          !!(law as any).document_body_fr
        }
        onSave={async (v) => {
          const field =
            currentLang === 'ht'
              ? 'document_body_ht'
              : 'document_body_fr'
          await updateLegalTextMetadata(law.slug, {
            [field]: v,
          } as any)
          refetch()
        }}
      />
    )
  }

  if (hasArticles) {
    return (
      <ArticleViewer
        article={selectedArticle}
        lawTitle={title}
        currentLang={currentLang}
        onPrevious={onPrevious}
        onNext={onNext}
        onShare={onShare}
        onCopyLink={onCopyLink}
        hasPrevious={currentArticleIndex > 0}
        hasNext={currentArticleIndex < law.articles.length - 1}
        breadcrumb={articleBreadcrumb}
        prevHint={blocHints.prev}
        nextHint={blocHints.next}
        defaultStatus={mapTextStatusToArticleStatus(law.status)}
        isEditor={isEditor}
        onArticleSaved={refetch}
        siblingArticles={law.articles as any}
        lawSlug={law.slug}
        lawId={law.id}
        lawPublicationDate={
          law.publication_date ??
          law.moniteur_issue_publication_date ??
          null
        }
        codeSubcategory={law.code_subcategory ?? null}
      />
    )
  }

  if (isEditor) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-10 text-center">
        <FileText className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {currentLang === 'fr'
            ? 'Aucun article détecté'
            : 'Pa gen atik detekte'}
        </h3>
        <p className="text-sm text-slate-600 mb-5 max-w-md mx-auto leading-relaxed">
          {currentLang === 'fr'
            ? "Le parser n'a pas extrait d'articles pour ce texte. Vous pouvez les saisir manuellement."
            : "Pasè a pa ekstrè atik pou tèks sa. Ou ka antre yo manyèlman."}
        </p>
        <Button
          onClick={onEmptyAddArticle}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          {currentLang === 'fr'
            ? 'Ajouter le premier article'
            : 'Ajoute premye atik la'}
        </Button>
      </div>
    )
  }

  return (
    <PreambleViewer
      title={title}
      text={law.preamble_fr}
      currentLang={currentLang}
    />
  )
}
