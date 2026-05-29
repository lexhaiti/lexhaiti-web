'use client'

import React from 'react'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { categoryLabels } from './_helpers/categoryLabels'

interface RelatedLawsProps {
  relatedLaws: any[]
  currentLang: 'fr' | 'ht'
}

/**
 * Related laws grid. Shown below the main content when related
 * laws data is available from the backend.
 */
export function RelatedLaws({ relatedLaws, currentLang }: RelatedLawsProps) {
  if (relatedLaws.length === 0) return null

  return (
    <div className="mt-12">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">
        {currentLang === 'fr'
          ? 'Textes connexes'
          : 'Tèks ki gen rapò'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {relatedLaws.map((relatedLaw) => (
          <Link
            key={relatedLaw.id}
            href={`/lois/${relatedLaw.slug}`}
            className="group block"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-lg transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <Badge className={`${relatedLaw.color} text-white`}>
                  {(categoryLabels[relatedLaw.category] ?? categoryLabels.loi)[currentLang]}
                </Badge>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-primary transition-colors">
                {relatedLaw.title}
              </h4>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                {relatedLaw.description}
              </p>
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-400 dark:text-slate-500">
                <span>{relatedLaw.year}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {currentLang === 'fr' ? 'En vigueur' : 'An vigè'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
