'use client'

import { ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Importé',
  ocr_pending: 'OCR en cours',
  parsed: 'Analysé',
  reviewed: 'Révisé',
  published: 'Publié',
  failed: 'Échec',
}

const STATUS_TONE: Record<string, string> = {
  published:
    'border-green-300 text-green-800 bg-green-50 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800',
  reviewed:
    'border-blue-300 text-blue-800 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800',
  parsed:
    'border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  failed:
    'border-red-300 text-red-800 bg-red-50 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
}

const DEFAULT_TONE =
  'border-slate-300 text-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'

interface Props {
  /** ``processing_status`` of the issue. */
  status: string
  editorEmail?: string | null
  onOpenMetadata: () => void
}

/** Pinned editor toolbar for a Moniteur issue — mirrors the law-detail
 *  ``EditorBar``: a fixed bottom band, shown only to signed-in editors,
 *  carrying the issue status + a ``Métadonnées`` action. */
export function MoniteurEditorBar({
  status,
  editorEmail,
  onOpenMetadata,
}: Props) {
  const label = STATUS_LABEL[status] ?? status
  const tone = STATUS_TONE[status] ?? DEFAULT_TONE
  return (
    <div className="animate-in fade-in slide-in-from-bottom-24 duration-500 fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md">
      <div className="container max-w-7xl px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-3 overflow-x-auto">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0',
              tone,
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{label}</span>
          </div>
          {editorEmail && (
            <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400 truncate min-w-0 flex-shrink">
              {editorEmail}
            </span>
          )}
          <div className="flex-1 min-w-0" />
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenMetadata}
            className="h-8 px-3 sm:px-4 flex-shrink-0"
            title="Modifier les métadonnées de l’édition"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Métadonnées</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
