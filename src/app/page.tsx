export const revalidate = 3600

import HeroSection from '@/components/home/HeroSection'
import ExplorerSection from '@/components/home/ExplorerSection'
import MoniteurRecentSection from '@/components/home/MoniteurRecentSection'
import FeaturesSection from '@/components/home/FeaturesSection'
import ActualitesSection from '@/components/home/ActualitesSection'
import AppelContribution from '@/components/home/AppelContribution'
import PartenairesSection from '@/components/home/PartenairesSection'
import { HomePrefetch } from '@/components/home/HomePrefetch'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  // The homepage is the one route whose canonical IS the site root. Every
  // other route sets its own self-referential canonical (see layout note).
  alternates: { canonical: 'https://www.lexhaiti.org' },
}

export default function Page() {
  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen">
      <HeroSection />
      <ExplorerSection />
      <MoniteurRecentSection />
      <FeaturesSection />
      <ActualitesSection />
      <AppelContribution />
      <PartenairesSection />
      {/* Invisible — warms the API cache with high-traffic content
          ~600ms after landing-page paint. */}
      <HomePrefetch />
    </div>
  )
}
