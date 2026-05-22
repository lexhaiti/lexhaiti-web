// RSC — cookie-based i18n + per-route metadata + CSS-only entrance
// animations. Refactored 2026-05-22: dropped the "Code source ouvert"
// stat (the repository went private + proprietary; that line was
// false) and reworked the page into clearer sections: mission,
// numbers, values, foundation, maxim. No framer-motion — animation
// is handled by tailwindcss-animate utilities.

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  BookOpen,
  Building2,
  Library,
  Quote,
  Scale,
  Target,
  Users,
} from 'lucide-react'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { getServerLanguage, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage()
  const t = await getT(language)
  return {
    title: t('about.title', {
      fallback: language === 'fr' ? 'À propos' : 'Konsènan',
    }),
  }
}

export default async function Page() {
  const t = await getT()
  const isFr = t.language === 'fr'

  const values = [
    {
      icon: Target,
      title: isFr ? 'Mission' : 'Misyon',
      description: isFr
        ? "Rendre le droit haïtien lisible, durable et gratuit pour chaque citoyen·ne, étudiant·e ou praticien·ne — où qu'iel se trouve."
        : "Rann dwa ayisyen lizib, dirab ak gratis pou chak sitwayen, etidyan oswa pratisyen — kèlkilanswa kote yo ye.",
    },
    {
      icon: Scale,
      title: isFr ? 'Fidélité aux sources' : 'Fidelite ak sous yo',
      description: isFr
        ? "Chaque article cite sa source d'origine — Le Moniteur, l'Assemblée constituante, le scan d'archive. La provenance est partie intégrante du texte."
        : 'Chak atik site sous orijinal li — Le Moniteur, Asanble konstitiyant, eskan achiv. Pwovenans la fè pati tèks la.',
    },
  ]

  // Honest, current numbers. No aspirational placeholders.
  const stats = [
    {
      value: '2',
      label: isFr ? 'Langues officielles' : 'Lang ofisyèl',
      hint: isFr ? 'Français · Kreyòl' : 'Fransè · Kreyòl',
    },
    {
      value: '100%',
      label: isFr ? 'Accès libre' : 'Aksè gratis',
      hint: isFr ? 'Sans inscription' : 'San enskripsyon',
    },
    {
      value: '∞',
      label: isFr ? 'Permanence des liens' : 'Pèmanans lyen yo',
      hint: isFr ? 'URL stables à vie' : 'URL ki kenbe pou tout tan',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Dark hero band — matches the rest of the site */}
      <div className="relative bg-primary text-white overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <div className="relative z-10 container py-16 lg:py-24 pt-28 lg:pt-36">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
              { label: isFr ? 'À propos' : 'Konsènan' },
            ]}
          />

          <h1 className="text-4xl lg:text-6xl font-black mb-6 leading-tight tracking-tight animate-in fade-in slide-in-from-top-2 duration-500">
            {isFr ? 'À propos' : 'Konsènan'}
          </h1>

          <p className="text-slate-300 text-lg lg:text-xl leading-relaxed max-w-3xl animate-in fade-in duration-700 [animation-delay:120ms]">
            {isFr
              ? "LexHaïti est l'infrastructure numérique du droit haïtien — un corpus structuré, citable et bilingue, ouvert à tou·te·s, conçu pour durer."
              : "LexHaïti se enfrastrikti nimerik dwa ayisyen — yon kòpis estriktire, sitabl ak bileng, ouvè pou tout moun, fèt pou li dire."}
          </p>
        </div>
      </div>

      {/* Stats — full-width band, no max-width on the row so the three
          numbers stretch comfortably on big screens too. */}
      <div className="border-b bg-gradient-to-b from-slate-50/60 to-white">
        <div className="container py-14 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="text-center sm:text-left animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <p className="text-5xl lg:text-6xl font-black text-slate-900 leading-none tabular-nums">
                  {stat.value}
                </p>
                <p className="text-sm text-slate-700 mt-3 font-bold uppercase tracking-wider">
                  {stat.label}
                </p>
                {stat.hint && (
                  <p className="text-xs text-slate-500 mt-1">{stat.hint}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Values — 4 cards, two rows on tablet, one row on lg+. The
          icon tile flips to filled-primary on hover for a tactile
          read. */}
      <div className="container py-20 lg:py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3">
            {isFr ? 'Engagements' : 'Angajman'}
          </p>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-tight">
            {isFr
              ? 'Deux principes qui guident chaque décision technique.'
              : 'De prensip ki gide chak desizyon teknik.'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {values.map((value, idx) => (
            <div
              key={idx}
              className="group animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="mb-5 inline-flex p-3.5 rounded-xl bg-primary/[0.06] border border-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:border-primary group-hover:shadow-md">
                <value.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 leading-tight">
                {value.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* What the corpus contains — concrete, scrollable list rather
          than abstract values. Helps the visitor know what they'll
          find before they go look. */}
      <div className="border-y bg-slate-50/40">
        <div className="container py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3">
                {isFr ? 'Le corpus' : 'Kòpis la'}
              </p>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-tight mb-5">
                {isFr
                  ? 'Du premier acte fondateur aux lois en vigueur.'
                  : 'Depi premye akt fondatè a jiska lwa ki an vigè yo.'}
              </h2>
              <p className="text-slate-600 leading-relaxed text-lg max-w-xl">
                {isFr
                  ? "Acte de l'Indépendance, Constitutions de 1801 à 1987, Codes, lois et décrets — chaque texte est ingéré depuis sa source officielle, structuré, cité et lié à son journal d'origine."
                  : "Akt Endepandans la, Konstitisyon 1801 jiska 1987, Kòd, lwa ak dekrè — chak tèks soti nan sous ofisyèl li, estriktire, site epi lye ak jounal orijinal li."}
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Library,
                  fr: 'Constitutions historiques',
                  ht: 'Konstitisyon istorik yo',
                  hint_fr: '1801 → 1987',
                  hint_ht: '1801 → 1987',
                },
                {
                  icon: BookOpen,
                  fr: 'Codes haïtiens',
                  ht: 'Kòd ayisyen yo',
                  hint_fr: 'Civil, pénal, du travail…',
                  hint_ht: 'Sivil, penal, travay…',
                },
                {
                  icon: Scale,
                  fr: 'Lois & décrets',
                  ht: 'Lwa ak dekrè',
                  hint_fr: 'Avec amendements tracés',
                  hint_ht: 'Ak amandman ki trase',
                },
                {
                  icon: Building2,
                  fr: 'Le Moniteur',
                  ht: 'Le Moniteur',
                  hint_fr: 'Numéros indexés',
                  hint_ht: 'Nimewo endekse',
                },
              ].map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] border border-primary/10 text-primary">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-tight">
                      {isFr ? item.fr : item.ht}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {isFr ? item.hint_fr : item.hint_ht}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Governance — who runs LexHaïti. Replaces the earlier "open
          source" framing with the truthful description: an editorial
          project backed by a non-profit association (HDDI is an e.V.
          incorporated under German law), not a community fork. */}
      <div className="container py-20 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" />
            {isFr ? 'Gouvernance' : 'Gouvènans'}
          </p>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-tight mb-5">
            {isFr
              ? "Une association au service de l'accès au droit."
              : 'Yon asosiyasyon pou ouvri aksè dwa.'}
          </h2>
          <p className="text-slate-600 leading-relaxed text-lg mb-4">
            {isFr
              ? "LexHaïti est édité par HDDI (Haïti Digital Data Infrastructure), une association sans but lucratif (e.V. de droit allemand) dont la mission est de bâtir l'infrastructure numérique publique d'Haïti — en commençant par le droit."
              : "LexHaïti edite pa HDDI (Haïti Digital Data Infrastructure), yon asosiyasyon san bi likratif (e.V. dwa alman) ki gen pou misyon bati enfrastrikti nimerik piblik Ayiti — kòmanse ak dwa."}
          </p>
          <p className="text-slate-600 leading-relaxed text-lg">
            {isFr
              ? 'La plateforme reste gratuite, ouverte à toutes les juridictions, et financée par des partenariats institutionnels — pas par la publicité ou les abonnements.'
              : 'Platfòm nan rete gratis, ouvè pou tout jiridiksyon, ak finanse pa patenarya enstitisyonèl — pa pa piblisite oswa abònman.'}
          </p>
        </div>
      </div>

      {/* Maxim — closing emotional beat. Centered poster layout with
          a vertical accent rule, a quote glyph on the side, and the
          CTA underneath rather than floating right. Gives the Latin
          sentence top-of-document weight without the cramped
          two-column squeeze the previous layout produced on
          narrower screens. */}
      <div className="container pb-24 lg:pb-32">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary text-white animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Soft colored halos in the corners — same palette as the
              landing hero so the about page closes in the same key. */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/12 blur-[120px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          {/* Faint grid overlay reused from the hero band. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="relative z-10 px-8 py-16 lg:px-20 lg:py-24 text-center">
            {/* Decorative quote glyph + eyebrow */}
            <div className="inline-flex items-center gap-2 text-slate-400 mb-6">
              <Quote className="w-4 h-4 -scale-x-100" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                {isFr ? 'Maxime juridique' : 'Maksim jiridik'}
              </span>
              <Quote className="w-4 h-4" />
            </div>

            {/* The Latin maxim — display weight, generous leading. */}
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-6xl font-black italic leading-[1.1] text-white max-w-4xl mx-auto">
              Publicitas iuris{' '}
              <span className="text-amber-300">fundamentum libertatis</span>.
            </h2>

            {/* Amber accent rule — same accent used by SectionHeading
                across the site, picked here to tie the maxim back to
                the design system. */}
            <div className="mt-8 mx-auto h-[3px] w-16 bg-amber-400 rounded-full" />

            {/* Translation — softer, smaller, second voice. */}
            <p className="mt-8 text-lg lg:text-xl italic text-slate-300 max-w-2xl mx-auto">
              {isFr
                ? '« La publicité du droit est le fondement de la liberté. »'
                : '« Piblisite dwa a se fondasyon libète a. »'}
            </p>

            {/* Closing paragraph — programme behind the maxim. */}
            <p className="mt-6 text-base lg:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
              {isFr
                ? "Chaque citoyen·ne a le droit de lire la loi qui le gouverne. LexHaïti existe pour rendre ce droit effectif, en ligne, gratuitement."
                : 'Chak sitwayen gen dwa li lwa ki gouvène l la. LexHaïti egziste pou rann dwa sa a efektif, sou entènèt, gratis.'}
            </p>

            {/* CTA — centered under the paragraph rather than floating
                on the right. Keeps the composition symmetrical. */}
            <Link
              href="/lois"
              className="mt-10 inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-primary px-6 py-3 rounded-md font-semibold transition-all active:scale-[0.99] shadow-sm hover:shadow-md"
            >
              <BookOpen className="w-4 h-4" />
              {isFr ? 'Explorer les textes' : 'Eksplore tèks yo'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
