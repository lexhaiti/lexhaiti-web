import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recherche',
  description:
    "Recherchez dans l'ensemble de la législation haïtienne — lois, décrets, codes et textes juridiques d'Haïti.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
