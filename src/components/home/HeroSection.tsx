'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Search,
  SlidersHorizontal,
  Unlock,
} from 'lucide-react'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

// Popular quick-access pills under the search bar. Icon is paired
// by type — Constitution gets the book, codes the gavel, themes the
// briefcase, Moniteur the newspaper. (The narrow chip row that used
// to live inside the search card was removed per UX brief — pulling
// double duty with the POPULAIRES row below was visual noise.)
type PopularCard = {
  label: string
  href?: string
  q?: string
}

const POPULAR: Record<'fr' | 'ht', PopularCard[]> = {
  fr: [
    { label: 'Constitution 1987', q: 'Constitution 1987' },
    { label: 'Code Civil', q: 'Code Civil' },
    { label: 'Code Pénal', q: 'Code Pénal' },
    { label: 'Droit du Travail', href: '/lois?theme=droit_travail' },
  ],
  ht: [
    { label: 'Konstitisyon 1987', q: 'Constitution 1987' },
    { label: 'Kòd Sivil', q: 'Code Civil' },
    { label: 'Kòd Penal', q: 'Code Pénal' },
    { label: 'Dwa travay', href: '/lois?theme=droit_travail' },
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
    // Cross-entity results page — surfaces matching laws AND Moniteur
    // issues for queries like "CL-007-09-09" or "Spécial N° 5".
    router.push(`/recherche?q=${encodeURIComponent(q)}`)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    goSearch(query)
  }

  return (
    <section
      className={cn(
        // Light tool-style hero. ``min-h-screen`` makes the surface
        // claim the full viewport so the Lady-Justice backdrop has
        // room to breathe; ``pt-20`` clears the fixed 80px header.
        // ``overflow-hidden`` keeps the bg image from leaking out
        // when the page is narrower than the image's natural width.
        'relative w-full bg-slate-50 text-slate-900 pt-20 min-h-screen overflow-hidden',
      )}
    >
      {/* Hero backdrop — rearranged ``lady-justice.png`` composite.
          The Haitian coat-of-arms (palm + flags + cannons + drum +
          anchor) anchors the LEFT, the centre is intentionally
          empty dark navy so the H1 / description / search card can
          float over it, and the Lady-Justice statue + Constitution
          d'Haïti volume + leather books anchor the RIGHT. Symbolic
          pairing: Haitian sovereignty (left) ↔ universal justice
          (right). Hidden on mobile — the image would sit under the
          centred text column. */}
      <div
        className="hidden md:block absolute inset-0 pointer-events-none select-none overflow-hidden z-0"
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-bg.webp"
          alt=""
          loading="eager"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.13]"
        />
        {/* Centre wash — fully opaque PURE WHITE across the middle
            band of the width, matching the search card's
            ``bg-white`` so the H1 / description / trust line and
            the search input live on visually continuous bright
            paper. The wash STARTS its ramp at the middle of the
            coat-of-arms (≈14 %) so the LEFT half of the emblem
            (palm trunk + fronds + outer flags) sits in the
            transparent zone and stays clearly visible, while the
            RIGHT half of the emblem dissolves into the wash.
            Mirrored on the right for Lady Justice. AA-safe (navy
            text on white ≥ 7:1). */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,transparent_8%,white_24%,white_70%,transparent_86%,transparent_100%)]" />
        {/* Bottom fade — protects the popular pills + footer trust
            line so they don't sit on a busy image area. */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-50 to-transparent" />
      </div>

      <div className="relative z-10 container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 min-h-[calc(100vh-5rem)] flex flex-col justify-center">
        {/* 1) H1 + short intro paragraph. The previous monumental
            ``LexHaïti`` wordmark is gone — the brand already lives in
            the global header, and the surface now leads with the
            actual value proposition. */}
        <div className="text-center max-w-3xl mx-auto">
          {/* H1 with a Haitian-flag dot in place of the trailing period
              — top half navy, bottom half red, mirroring the flag's
              two horizontal bands. Strip the punctuation off the
              i18n string so the dot reads as the actual punctuation
              instead of stacking next to one. */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05] text-primary">
            {t('home.hero.tagline').replace(/\.$/, '')}
            <span
              aria-hidden
              className="inline-block ml-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 rounded-full align-baseline"
              style={{
                background:
                  'linear-gradient(to bottom, #0D1B4C 0 50%, #D21034 50% 100%)',
              }}
            />
          </h1>
          <p className="mt-5 text-base sm:text-lg md:text-xl leading-relaxed text-slate-700">
            {t('home.hero.description')}
          </p>
        </div>

        {/* 2) Trust line — sits right under the intro paragraph and
            ABOVE the search card. Two halves separated by a soft
            divider; small SVG icons (BadgeCheck for provenance,
            Unlock for posture) give each half a glyph. Reads as the
            project's quality cue before the user even types. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <BadgeCheck
              className="w-4 h-4 text-emerald-600 flex-shrink-0"
              aria-hidden
            />
            {t('home.hero.trustSources')}
          </span>
          <span className="hidden sm:inline text-slate-400" aria-hidden>
            |
          </span>
          <span className="inline-flex items-center gap-2">
            <Unlock
              className="w-4 h-4 text-primary flex-shrink-0"
              aria-hidden
            />
            {t('home.hero.trustAccess')}
          </span>
        </div>

        {/* 3) Search bar — the primary action.
            Softer + wider shadow (``shadow-[0_24px_60px_-20px_…]``)
            so the card lifts off the slate-50 surface but doesn't
            shout. No chip row inside any more; the POPULAIRES row
            below takes that role. */}
        <div className="mt-6 sm:mt-8 rounded-2xl bg-white ring-1 ring-slate-100 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.18)] px-4 sm:px-6 py-4 sm:py-5">
          <label htmlFor="hero-search" className="sr-only">
            {t('home.hero.findLabel')}
          </label>
          <form
            onSubmit={onSubmit}
            className="flex flex-col sm:flex-row items-stretch gap-3"
          >
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
                  'w-full h-14 pl-14 pr-4 rounded-full',
                  'bg-slate-50 ring-1 ring-slate-200',
                  'placeholder:text-slate-500 placeholder:italic placeholder:text-sm',
                  'text-base text-slate-900 outline-none',
                  'focus:ring-2 focus:ring-primary/40 focus:bg-white transition',
                )}
                // 16px keeps iOS Safari from zooming the viewport on
                // input focus — anything below triggers the auto-zoom.
                style={{ fontSize: '16px' }}
              />
            </div>
            <button
              type="submit"
              className={cn(
                'inline-flex items-center justify-center gap-2',
                'h-14 px-7 rounded-full',
                'bg-primary text-white font-semibold',
                'hover:bg-primary/90 active:scale-[0.99] transition-all',
              )}
            >
              {t('home.hero.searchButton')}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </form>
        </div>

        {/* 4) Secondary search affordances — two separate links
            (advanced search + browse-all) separated by a vertical
            divider, immediately below the search card where the
            user's eye already is. The previous "advancedFull" combo
            string read as one link; users wanted them split so each
            destination is clickable on its own. */}
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <Link
            href="/recherche/avancee"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-primary transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden />
            {t('home.hero.advanced')}
          </Link>
          <span className="text-slate-400" aria-hidden>
            |
          </span>
          <Link
            href="/lois"
            className="font-medium text-slate-600 hover:text-primary transition-colors"
          >
            {t('home.hero.browse')}
          </Link>
        </div>

        {/* 5) POPULAIRES — interactive pills for the canonical entry
            points (Constitution, the three core codes, Le Moniteur).
            Pill style: white, soft ring, hover lifts the shadow +
            tints the icon, gives a polished interactive feel without
            shouting. The bare label row above (was an ``h2`` eyebrow)
            is gone — pills are self-explanatory at this scale. */}
        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          {POPULAR[lang].map((p) => {
            const inner = (
              <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-950 transition-colors">
                {p.label}
              </span>
            )
            const cls = cn(
              'group inline-flex items-center',
              'rounded-full bg-white ring-1 ring-slate-200 px-4 py-2.5',
              'shadow-[0_1px_3px_-1px_rgba(15,23,42,0.08)]',
              'hover:ring-slate-300 hover:shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)] hover:-translate-y-0.5',
              'transition-all duration-200',
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
        </div>

        {/* 6) Latin maxim — decorative stroke + quote anchors the
            bottom of the hero. The thin rule gives it a typographic
            "drawn" feel; italic serif keeps it classical. */}
        <div className="mt-8 sm:mt-10 flex items-center justify-center">
          <p
            className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold italic tracking-wide text-transparent select-none text-center"
            lang="la"
            style={{
              WebkitTextStroke: '1px rgb(148 163 184)',
            }}
          >
            Publicitas iuris fundamentum libertatis.
          </p>
        </div>
      </div>
    </section>
  )
}
