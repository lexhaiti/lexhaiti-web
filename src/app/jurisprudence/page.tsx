// RSC route file. Emits per-route metadata then mounts the
// interactive list client. ISR is enabled — the corpus is editor-
// curated so a stale-but-coherent read is fine for the first hit
// after a new decision lands.

import type { Metadata } from 'next'
import { getServerLanguage, getT } from '@/i18n/server'
import JurisprudenceListClient from './_components/JurisprudenceListClient'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage()
  const t = await getT(language)
  return {
    alternates: { canonical: 'https://www.lexhaiti.org/jurisprudence' },
    title: t('jurisprudence.title'),
    description: t('jurisprudence.intro'),
  }
}

export default function Page() {
  return <JurisprudenceListClient />
}
