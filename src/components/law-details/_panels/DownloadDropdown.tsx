/**
 * Direct PDF download anchor in the law-detail hero metadata row.
 *
 * We only support PDF for the public export — Word was advertised
 * but never produced a reliable file, so the dropdown is gone and
 * the metadata tile is now a single ``<a download>`` pointing at
 * the backend ``/legal-texts/{slug}/export`` endpoint, which
 * streams the PDF with a Content-Disposition filename.
 *
 * Kept the same visual treatment as the other hero metadata tiles
 * (icon circle, small uppercase label, value below) so the row
 * still reads consistently.
 */
'use client'

import React from 'react'
import { Download } from 'lucide-react'
import { useT } from '@/i18n/useT'
import { apiUrl } from '@/lib/api/client'
import { cn } from '@/lib/utils'

interface DownloadDropdownProps {
  slug: string
  language: string
}

export function DownloadDropdown({ slug, language }: DownloadDropdownProps) {
  const { t } = useT()
  const lang = (language as 'fr' | 'ht') ?? 'fr'

  const pdfHref = apiUrl(
    `/legal-texts/${encodeURIComponent(slug)}/export`,
    { format: 'pdf', lang },
  )

  return (
    <a
      href={pdfHref}
      download
      aria-label={`${t('lawDetail.download.label')} — PDF`}
      className={cn(
        'group/dl flex items-center gap-4 text-left',
        'rounded-xl -m-2 p-2 hover:bg-white/5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
      )}
    >
      <div
        aria-hidden
        className="p-3 bg-white/5 rounded-full border border-white/10 group-hover/dl:bg-white/10 group-hover/dl:border-white/20 transition-colors"
      >
        <Download className="w-5 h-5 text-slate-400 group-hover/dl:text-white transition-colors" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
          {t('lawDetail.download.label')}
        </p>
        <p className="text-white font-bold">PDF</p>
      </div>
    </a>
  )
}
