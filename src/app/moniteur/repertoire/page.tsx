import type { Metadata } from 'next'
import RepertoireClient from './_components/RepertoireClient'

export const metadata: Metadata = {
  title: 'Répertoire du Moniteur (1900–1944) | LexHaïti',
  description:
    "Index alphabétique et chronologique du journal officiel de la République d'Haïti « Le Moniteur », 1900–1944.",
}

export default function MoniteurRepertoirePage() {
  return <RepertoireClient />
}
