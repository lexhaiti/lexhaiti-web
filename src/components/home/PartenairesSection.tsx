// Server Component — no client state. Entrance animation handled by
// tailwindcss-animate utilities instead of framer-motion.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { getT } from '@/i18n/server'

// Copy lives at `home.partenaires.*` in i18n/{fr,ht}.ts.
// Active partner logos. The grid flex-wraps and centers, so 1 / 2 /
// 3+ partners all read as intentional layouts without touching
// markup. ``logoMaxH`` lets each logo pick its own ceiling — wide
// horizontal lockups (APRANN) want a short max so they don't overrun
// the tile; squarer marks (Relève) get more vertical headroom.
const PARTNERS = [
  {
    id: 'aprann',
    name: 'APRANN — Online Education Academy',
    href: 'https://aprannakademi.com/',
    logo: '/partners/aprann-logo.png',
    width: 1292,
    height: 413,
    logoMaxH: 'max-h-12 sm:max-h-14',
  },
  {
    id: 'releve-leadership',
    name: 'Relève Leadership',
    href: 'https://releveleadership.org/',
    logo: '/partners/releve-leadership-logo.png',
    width: 522,
    height: 401,
    logoMaxH: 'max-h-16 sm:max-h-20',
  },
]

export default async function PartenairesSection() {
  const t = await getT()

  return (
    // The band's BACKGROUND is full-bleed (gradient + blobs span the
    // viewport so the section reads as a distinct ribbon), but the
    // CONTENT sits inside ``container`` so its width matches the
    // header + footer + every other section on the landing page.
    // Mixing full-bleed visuals with container-bound content is the
    // pattern used across the site.
    <section className="relative w-full bg-gradient-to-b from-slate-50/60 via-white to-slate-50/40 dark:from-slate-900/60 dark:via-slate-950 dark:to-slate-900/40 py-20 lg:py-28 border-t border-slate-100 dark:border-slate-800 overflow-hidden">
      {/* Soft brand-tinted blobs for depth — match the hero's visual
          rhythm without competing for attention. */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/[0.025] blur-[140px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/[0.02] blur-[120px] rounded-full" />
      </div>

      <div className="container relative z-10">
        <SectionHeading
          eyebrow={t('home.partenaires.eyebrow')}
          title={t('home.partenaires.title')}
          subtitle={t('home.partenaires.subtitle')}
          // Let the headline stretch the full band width — the
          // SectionHeading default (``max-w-3xl``) was capping the
          // ``Construit avec les institutions du droit haïtien``
          // title around 768px even though the wrapping section is
          // full-bleed. ``max-w-none`` removes the constraint.
          titleMaxWidth="max-w-none"
        />

        {/* Active-partner logo grid — first thing the visitor sees
            after the heading, because logos > placeholders. Each logo
            sits on a white tile (solid white even in dark mode so
            client brand-colors hit their intended surface). Grid
            balances 1 / 2 / 3 across breakpoints so a lone partner
            still reads as a deliberate spotlight. */}
        {PARTNERS.length > 0 && (
          <div className="mb-10 flex flex-wrap justify-center gap-4 lg:gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {PARTNERS.map((p) => (
              <a
                key={p.id}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.name}
                className="group flex h-24 sm:h-28 w-full max-w-xs items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white px-6 py-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <Image
                  src={p.logo}
                  alt={p.name}
                  width={p.width}
                  height={p.height}
                  className={`h-auto w-auto ${p.logoMaxH} object-contain transition-transform group-hover:scale-[1.02]`}
                />
              </a>
            ))}
          </div>
        )}

        <div className="mt-12 flex justify-center sm:justify-start">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-primary dark:bg-slate-800 text-white px-7 py-3 text-sm font-semibold hover:bg-primary/90 dark:hover:bg-slate-700 transition-colors group shadow-sm"
          >
            {t('home.partenaires.cta')}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
