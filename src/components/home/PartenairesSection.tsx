// Server Component — no client state. Entrance animation handled by
// tailwindcss-animate utilities instead of framer-motion.

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Building2, GraduationCap, Scale } from 'lucide-react'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { getT } from '@/i18n/server'

// Copy lives at `home.partenaires.*` in i18n/{fr,ht}.ts.
// Partner-type icons stay here — they're component references, not
// translatable strings.
const TYPES = [
  { key: 'universities' as const, icon: GraduationCap },
  { key: 'bars' as const, icon: Scale },
  { key: 'ngos' as const, icon: Building2 },
]

// Active partner logos. The grid auto-balances 1/2/3 across mobile/
// tablet/desktop so a single partner reads as intentional, and adding
// more later doesn't require markup changes — just push a new entry.
// ``logoMaxH`` lets each logo pick its own ceiling (logos with lots
// of bottom whitespace can claim more vertical space without dwarfing
// the tile).
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

        {/* Partner-types grid — full-width stretch, the tiles share
            the same gutter as the heading so the band reads as one
            unified surface. Dashed border still signals "open to
            partners, not yet filled with logos". */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {TYPES.map((type, i) => {
            const Icon = type.icon
            return (
              <div
                key={i}
                className="group flex items-center gap-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 px-6 py-6 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.06] border border-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white group-hover:border-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                  {t(`home.partenaires.types.${type.key}`)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex justify-center sm:justify-start">
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
