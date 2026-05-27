'use client'

/**
 * Home hero — editorial asymmetric layout.
 *
 * Design rules locked in 2026-05-27 critique:
 *  - Cream paper base (#FDFBF6), not slate; legal documents print on
 *    cream, gives the surface real material quality.
 *  - 60/40 split on lg+ (text left, Lady Justice imagery right). On
 *    mobile/tablet it stacks; the image becomes a constrained framed
 *    figure under the search bar instead of disappearing.
 *  - Brand triad: navy (dominant), Haitian-flag red (one accent — the
 *    period after the H1), gold (one accent — a hairline divider).
 *    No slate-grey drift, no random emerald, no glassmorphism, no
 *    blurred radial gradients.
 *  - Source Serif 4 (already self-hosted) for the H1; DM Sans for the
 *    body. Closer to typeset law-firm collateral than to a startup
 *    landing.
 *  - One small "Ex." inline label in the search hint, one ⏎ enter-key
 *    affordance on the right — quiet utility cues that say "this is a
 *    real product".
 *  - Restrained motion: fade + small slide on H1/paragraph/search.
 *    No bounce, no parallax, no scroll-linked anything.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, CornerDownLeft, Search } from 'lucide-react'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

type PopularCard = {
  label: string
  href?: string
  q?: string
}

// Three quick-access pills only — Constitution + the two most-used
// codes. Fewer pills makes each one feel chosen, not auto-filled.
// "Voir tout" link on the right replaces the rest of the list.
const POPULAR: Record<'fr' | 'ht', PopularCard[]> = {
  fr: [
    { label: 'Constitution 1987', q: 'Constitution 1987' },
    { label: 'Code Civil', q: 'Code Civil' },
    { label: 'Code Pénal', q: 'Code Pénal' },
  ],
  ht: [
    { label: 'Konstitisyon 1987', q: 'Constitution 1987' },
    { label: 'Kòd Sivil', q: 'Code Civil' },
    { label: 'Kòd Penal', q: 'Code Pénal' },
  ],
}

export default function HeroSection() {
  const { t, language } = useT()
  const lang = (language === 'ht' ? 'ht' : 'fr') as 'fr' | 'ht'
  const router = useRouter()
  const [query, setQuery] = useState('')

  const goSearch = (raw: string) => {
    const q = raw.trim()
    if (!q) return
    router.push(`/recherche?q=${encodeURIComponent(q)}`)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    goSearch(query)
  }

  return (
    <section
      // Cream paper base — warmer than slate-50, closer to printed
      // legal stock. ``pt-20`` clears the fixed 80px header.
      className="relative w-full overflow-hidden pt-20"
      style={{ backgroundColor: '#FDFBF6' }}
    >
      {/* Top eyebrow band — a single thin gold hairline at the top of
          the section that nods to the flag's gold without resorting to
          decorative blocks or gradients. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-20 h-px"
        style={{ backgroundColor: '#F2C744', opacity: 0.55 }}
      />

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-12 lg:py-20">
        {/* Asymmetric grid: text-heavy left column, imagery right.
            Stacks on mobile (single column). The 1.15fr/1fr split
            gives the text just enough dominance without crowding the
            image. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-16 items-center">
          {/* LEFT — value prop + search */}
          <div className="min-w-0">
            {/* Typeset eyebrow — small caps, two halves separated by a
                middle dot. The kind of label you see on a Cour de
                cassation page header. */}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary/70 animate-in fade-in slide-in-from-top-1 duration-500">
              <span>{lang === 'fr' ? 'État du droit' : 'Eta dwa a'}</span>
              <span aria-hidden className="text-primary/30">·</span>
              <span>
                {lang === 'fr' ? "République d'Haïti" : 'Repiblik Ayiti'}
              </span>
            </p>

            {/* H1 — serif, navy, with a single Haitian-flag-red period
                as the institutional accent. Tightened leading + drop
                shadow off. ``balance`` so the title wraps cleanly at
                every width without orphan words. */}
            <h1
              className="mt-5 font-serif text-[2.5rem] sm:text-5xl lg:text-[3.75rem] xl:text-[4.25rem] font-bold leading-[1.05] tracking-tight text-primary text-balance animate-in fade-in slide-in-from-top-2 duration-500 [animation-delay:80ms] fill-mode-both"
              style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
            >
              {t('home.hero.tagline')}
              <span
                aria-hidden
                className="ml-0.5"
                style={{ color: '#D21034' }}
              >
                .
              </span>
            </h1>

            {/* Lede paragraph — body color slightly warmer than slate
                (#3F3A33) to sit naturally on the cream base. Caps line
                length for legibility. */}
            <p
              className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed animate-in fade-in slide-in-from-top-2 duration-500 [animation-delay:160ms] fill-mode-both"
              style={{ color: '#3F3A33' }}
            >
              {t('home.hero.description')}
            </p>

            {/* Search card — flat white surface on cream, single navy
                ring on focus. No competing shadow. The ⏎ icon on the
                right of the input hints at keyboard submit. */}
            <form
              onSubmit={onSubmit}
              className="mt-8 flex flex-col sm:flex-row items-stretch gap-3 max-w-xl animate-in fade-in slide-in-from-top-2 duration-500 [animation-delay:240ms] fill-mode-both"
            >
              <label htmlFor="hero-search" className="sr-only">
                {t('home.hero.findLabel')}
              </label>
              <div className="relative flex-1 min-w-0">
                <Search
                  className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none"
                  aria-hidden
                />
                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('home.hero.placeholder')}
                  aria-label={t('home.hero.findLabel')}
                  className={cn(
                    'w-full h-14 pl-14 pr-12 rounded-xl',
                    'bg-white ring-1 ring-slate-200/80',
                    'placeholder:text-slate-400 placeholder:italic placeholder:text-[15px]',
                    'text-base text-slate-900 outline-none',
                    'focus:ring-2 focus:ring-primary/45 transition-shadow',
                  )}
                  style={{ fontSize: '16px' }}
                />
                <span
                  aria-hidden
                  className="hidden sm:inline-flex absolute right-4 top-1/2 -translate-y-1/2 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  <CornerDownLeft className="w-3 h-3" />
                </span>
              </div>
              <button
                type="submit"
                className={cn(
                  'inline-flex items-center justify-center gap-2',
                  'h-14 px-7 rounded-xl',
                  'bg-primary text-white font-semibold',
                  'hover:bg-primary/90 active:scale-[0.99] transition-all',
                )}
              >
                {t('home.hero.searchButton')}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
            </form>

            {/* Quick-access row + secondary links. Pills on the left,
                "Voir tout" link on the right — replaces the long pill
                row with a tighter selection that doesn't strain. */}
            <div className="mt-6 flex flex-wrap items-center gap-2 max-w-xl animate-in fade-in duration-500 [animation-delay:320ms] fill-mode-both">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mr-1">
                {lang === 'fr' ? 'Populaire' : 'Popilè'}
              </span>
              {POPULAR[lang].map((p) => {
                const inner = (
                  <span className="text-[13px] font-medium text-slate-700 group-hover:text-primary transition-colors">
                    {p.label}
                  </span>
                )
                const cls = cn(
                  'group inline-flex items-center',
                  'rounded-full bg-white/70 ring-1 ring-slate-200/70 px-3.5 py-1.5',
                  'hover:bg-white hover:ring-primary/30 transition-all',
                )
                if (p.href) {
                  return (
                    <Link key={p.label} href={p.href} className={cls}>
                      {inner}
                    </Link>
                  )
                }
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => goSearch(p.q!)}
                    className={cls}
                  >
                    {inner}
                  </button>
                )
              })}
              <Link
                href="/lois"
                className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline underline-offset-4"
              >
                {t('home.hero.browse')}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Trust line — two halves separated by a hairline. Lives
                BELOW the action area so it doesn't compete with the
                search; reads as a quiet provenance note. */}
            <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 max-w-xl">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#F2C744' }}
                />
                {t('home.hero.trustSources')}
              </span>
              <span aria-hidden className="text-slate-300">
                |
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: '#F2C744' }}
                />
                {t('home.hero.trustAccess')}
              </span>
            </div>
          </div>

          {/* RIGHT — Lady Justice imagery, framed. Hidden on small
              screens (the page is already busy enough on mobile), shows
              from ``md`` upward. We use object-position: right so the
              statue stays in frame as the column shrinks. */}
          <div className="hidden md:block relative animate-in fade-in slide-in-from-right-4 duration-700 [animation-delay:200ms] fill-mode-both">
            <figure
              className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden ring-1 ring-slate-200/80"
              style={{
                background:
                  'linear-gradient(180deg, #FDFBF6 0%, #F4ECDD 100%)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-bg.webp"
                alt={
                  lang === 'fr'
                    ? "Allégorie de la justice — statue, Constitution d'Haïti et codes en cuir"
                    : "Alegori jistis — estati, Konstitisyon Ayiti ak kòd nan kwi"
                }
                loading="eager"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: 'right center' }}
              />
              {/* Warm cream wash at the bottom — anchors the figure to
                  the page background without a hard edge. */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3"
                style={{
                  background:
                    'linear-gradient(to top, #FDFBF6 0%, rgba(253,251,246,0) 100%)',
                }}
              />
              {/* Single gold hairline along the bottom — the only
                  ornament. Echoes the eyebrow hairline at the top of
                  the section, frames the figure like a print mat. */}
              <div
                aria-hidden
                className="absolute inset-x-6 bottom-4 h-px"
                style={{ backgroundColor: '#F2C744', opacity: 0.6 }}
              />
            </figure>

            {/* Caption — small typeset attribution under the image. Not
                a quote, not decorative — a real caption like you'd see
                under a print of a courthouse drawing. */}
            <figcaption className="mt-3 text-center text-[11px] uppercase tracking-[0.22em] text-slate-500 font-semibold">
              {lang === 'fr'
                ? 'Allégorie de la justice'
                : 'Alegori jistis'}
            </figcaption>
          </div>
        </div>
      </div>

      {/* Bottom eyebrow band — mirrors the top hairline. Closes the
          hero as a print plate. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px"
        style={{ backgroundColor: '#F2C744', opacity: 0.4 }}
      />
    </section>
  )
}
