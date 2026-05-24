// RSC route file with localized per-route metadata. The list grid + its
// filters live inside the AllLaws client component below.

import type { Metadata } from 'next'
import { Suspense } from 'react'
import AllLaws from '@/components/all-laws/AllLaws'
import { getServerLanguage, getT } from '@/i18n/server'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage()
  const t = await getT(language)
  return {
    title: t('allLaws.title', {
      fallback:
        language === 'fr' ? 'Tous les textes juridiques' : 'Tout tèks jiridik yo',
    }),
    description:
      language === 'fr'
        ? "Parcourez l'ensemble des lois, décrets, codes et textes juridiques d'Haïti indexés sur LexHaiti."
        : 'Navige nan tout lwa, dekrè, kòd ak tèks jiridik Ayiti ki endekse sou LexHaiti.',
  }
}

export default function Page() {
  // Menu clearance is handled inside the dark page header (h-20 spacer in
  // AllLawsUI), so the wrapper doesn't need its own pt-20 — that would
  // double-count the menu height.
  return (
    <Suspense>
      <AllLaws />
    </Suspense>
  )
}
