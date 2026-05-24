'use client'

import React from 'react'
import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EditableHeroField } from '@/components/law-details/_helpers/EditableHeroField'
import { DeviseBanner } from './_panels/DeviseBanner'
import { IssuingAuthorityHeader } from './_panels/IssuingAuthorityHeader'
import { categoryLabels } from './_helpers/categoryLabels'
import { updateLegalTextMetadata } from '@/lib/api/endpoints'
import { useToast } from '@/components/ui/toast-simple'

interface IdentityMastheadProps {
  law: any
  currentLang: 'fr' | 'ht'
  isEditor: boolean
  category: { fr: string; ht: string; color: string }
  officialTitleStored: string | null
  refetch: () => void
  onDeviseEditorOpen: () => void
}

/**
 * Identity preamble rendered in the document body (not the hero).
 * Mirrors how a printed legal act lays out: devise nationale,
 * doc-type heading, official title, and issuing authority.
 */
export function IdentityMasthead({
  law,
  currentLang,
  isEditor,
  category,
  officialTitleStored,
  refetch,
  onDeviseEditorOpen,
}: IdentityMastheadProps) {
  const { toast } = useToast()

  return (
    <div className="my-6 lg:my-8 flex justify-center">
      <div className="flex flex-col items-center gap-3 lg:gap-4 text-slate-700 max-w-2xl">
        {/* Universal Haitian devise banner. Editor can hide
            when the source printing didn't carry it. */}
        {(law as any).show_devise_banner !== false && (
          <div className="relative group/devise w-full flex justify-center">
            <DeviseBanner
              lang={currentLang}
              customText={
                currentLang === 'ht'
                  ? ((law as any).devise_ht || (law as any).devise_fr || null)
                  : ((law as any).devise_fr || null)
              }
            />
            {isEditor && (
              <div
                className={cn(
                  'absolute top-0 right-0 flex items-center gap-1',
                  'opacity-0 group-hover/devise:opacity-100 transition-opacity',
                )}
              >
                <button
                  type="button"
                  onClick={() => onDeviseEditorOpen()}
                  title={
                    currentLang === 'fr'
                      ? "Modifier l'emblème (devise)"
                      : 'Modifye devis la'
                  }
                  aria-label={
                    currentLang === 'fr'
                      ? "Modifier l'emblème"
                      : 'Modifye emblèm nan'
                  }
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full',
                    'bg-white border border-slate-200 shadow-sm',
                    'hover:bg-slate-50 hover:border-slate-300',
                    'text-slate-500 hover:text-blue-600',
                  )}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateLegalTextMetadata(law.slug, {
                        show_devise_banner: false,
                      } as any)
                      refetch()
                    } catch (e) {
                      toast(
                        currentLang === 'fr'
                          ? 'Impossible de masquer la devise'
                          : 'Pa kapab kache devis la',
                      )
                    }
                  }}
                  title={
                    currentLang === 'fr'
                      ? 'Masquer la devise pour ce texte'
                      : 'Kache devis la pou tèks sa a'
                  }
                  aria-label={
                    currentLang === 'fr'
                      ? 'Masquer la devise'
                      : 'Kache devis la'
                  }
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full',
                    'bg-white border border-slate-200 shadow-sm',
                    'hover:bg-slate-50 hover:border-slate-300',
                    'text-slate-500 hover:text-rose-600',
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
        {/* Editor-only "Afficher la devise" affordance */}
        {isEditor && (law as any).show_devise_banner === false && (
          <button
            type="button"
            onClick={async () => {
              try {
                await updateLegalTextMetadata(law.slug, {
                  show_devise_banner: true,
                } as any)
                refetch()
              } catch (e) {
                toast(
                  currentLang === 'fr'
                    ? 'Impossible d\'afficher la devise'
                    : 'Pa kapab afiche devis la',
                )
              }
            }}
            className={cn(
              'inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest',
              'px-2.5 py-1 rounded-full',
              'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700',
              'transition-colors',
            )}
          >
            <Eye className="w-3 h-3" />
            {currentLang === 'fr'
              ? '+ Afficher la devise'
              : '+ Afiche devis la'}
          </button>
        )}

        {/* Doc-type heading -- editor can hide on a per-text basis */}
        {(law as any).show_doc_type !== false && (
        <div className="mt-1 flex flex-col items-center text-center group/cat relative">
          {isEditor ? (
            <Select
              value={law.category}
              onValueChange={async (next) => {
                if (next === law.category) return
                try {
                  await updateLegalTextMetadata(law.slug, {
                    category: next,
                  } as any)
                  refetch()
                } catch (e) {
                  toast(
                    currentLang === 'fr'
                      ? 'Impossible de modifier le type'
                      : 'Pa kapab chanje kalite a',
                  )
                }
              }}
            >
              <SelectTrigger
                aria-label={
                  currentLang === 'fr'
                    ? "Type du document"
                    : 'Kalite dokiman an'
                }
                className="!h-auto !p-0 !bg-transparent !border-0 !shadow-none focus:!ring-0 focus:!ring-offset-0 group/trigger hover:!bg-transparent gap-2"
              >
                <span className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-[0.18em] text-slate-900 leading-tight">
                  {category[currentLang]}
                </span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta[currentLang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-[0.18em] text-slate-900 leading-tight">
              {category[currentLang]}
            </p>
          )}
          {isEditor && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await updateLegalTextMetadata(law.slug, {
                    show_doc_type: false,
                  } as any)
                  refetch()
                } catch (e) {
                  toast(
                    currentLang === 'fr'
                      ? 'Impossible de masquer le type'
                      : 'Pa kapab kache kalite a',
                  )
                }
              }}
              title={
                currentLang === 'fr'
                  ? 'Masquer le type de document pour ce texte'
                  : 'Kache kalite dokiman an pou tèks sa a'
              }
              aria-label={
                currentLang === 'fr'
                  ? 'Masquer le type'
                  : 'Kache kalite a'
              }
              className={cn(
                'absolute top-0 right-0 opacity-0 group-hover/cat:opacity-100 transition-opacity',
                'inline-flex items-center justify-center w-7 h-7 rounded-full',
                'bg-white border border-slate-200 shadow-sm',
                'hover:bg-slate-50 hover:border-slate-300',
                'text-slate-500 hover:text-rose-600',
              )}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        )}
        {isEditor && (law as any).show_doc_type === false && (
          <button
            type="button"
            onClick={async () => {
              try {
                await updateLegalTextMetadata(law.slug, {
                  show_doc_type: true,
                } as any)
                refetch()
              } catch (e) {
                toast(
                  currentLang === 'fr'
                    ? "Impossible d'afficher le type"
                    : 'Pa kapab afiche kalite a',
                )
              }
            }}
            className={cn(
              'mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700',
              'transition-colors',
            )}
          >
            <Eye className="w-3 h-3" />
            {currentLang === 'fr'
              ? '+ Afficher le type'
              : '+ Afiche kalite a'}
          </button>
        )}

        {/* Title in Le Moniteur masthead form */}
        {(officialTitleStored || isEditor) && (
          <EditableHeroField
            value={officialTitleStored ?? ''}
            isEditor={isEditor}
            kind="textarea"
            theme="light"
            layout="block"
            editAriaLabel={
              currentLang === 'fr'
                ? 'Modifier le titre officiel (Moniteur)'
                : 'Modifye tit ofisyèl (Moniteur)'
            }
            emptyPlaceholder={
              currentLang === 'fr'
                ? '+ Ajouter le titre officiel (Moniteur)'
                : '+ Ajoute tit ofisyèl (Moniteur)'
            }
            inputClassName="text-sm sm:text-base font-bold uppercase text-center tracking-wide leading-relaxed w-full max-w-xl mx-auto"
            onSave={async (next) => {
              const field =
                currentLang === 'ht'
                  ? 'official_title_ht'
                  : 'official_title_fr'
              await updateLegalTextMetadata(law.slug, {
                [field]: next || null,
              } as any)
              refetch()
            }}
          >
            {officialTitleStored ? (
              <p className="text-sm sm:text-base lg:text-lg font-bold uppercase text-center tracking-wide leading-relaxed text-slate-900 max-w-xl whitespace-pre-line">
                {officialTitleStored}
              </p>
            ) : (
              <span className="text-xs sm:text-sm italic text-slate-400">
                {currentLang === 'fr'
                  ? '+ Ajouter le titre officiel (Moniteur)'
                  : '+ Ajoute tit ofisyèl (Moniteur)'}
              </span>
            )}
          </EditableHeroField>
        )}

        {(law.issuing_authority || isEditor) && (
          <EditableHeroField
            value={law.issuing_authority ?? ''}
            isEditor={isEditor}
            kind="textarea"
            theme="light"
            layout="block"
            editAriaLabel={
              currentLang === 'fr'
                ? "Modifier l’autorité émettrice"
                : 'Modifye otorite ki bay la'
            }
            emptyPlaceholder={
              currentLang === 'fr'
                ? "+ Ajouter l’autorité émettrice"
                : '+ Ajoute otorite ki bay la'
            }
            inputClassName="text-base sm:text-lg font-black uppercase tracking-[0.18em] text-center leading-snug w-full max-w-xl mx-auto"
            onSave={async (next) => {
              await updateLegalTextMetadata(law.slug, {
                issuing_authority: next || null,
              } as any)
              refetch()
            }}
          >
            {law.issuing_authority ? (
              <IssuingAuthorityHeader value={law.issuing_authority} />
            ) : (
              <span className="text-xs sm:text-sm italic text-slate-400">
                {currentLang === 'fr'
                  ? "+ Ajouter l'autorité émettrice"
                  : '+ Ajoute otorite ki bay la'}
              </span>
            )}
          </EditableHeroField>
        )}
      </div>
    </div>
  )
}
