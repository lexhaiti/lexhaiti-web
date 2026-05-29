// Donate / support landing page — first-pass static content. Payment
// integration (Stripe etc.) is deliberately out of scope; this page
// exists to (a) make giving discoverable, (b) state who receives the
// money and what it funds, (c) list the channels that already work
// (bank transfer to Ayiti Dijital's e.V. account).
//
// RSC + cookie i18n + tailwindcss-animate, same shape as a-propos.

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Globe2,
  Heart,
  Landmark,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { getServerLanguage, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage()
  const t = await getT(language)
  return {
    title: t('donate.title', {
      fallback: language === 'fr' ? 'Soutenir LexHaïti' : 'Sipòte LexHaïti',
    }),
    description:
      language === 'fr'
        ? "Soutenir l'infrastructure publique du droit haïtien — bilingue, gratuite, citable."
        : 'Sipòte enfrastrikti piblik dwa ayisyen an — bileng, gratis, sitabl.',
  }
}

export default async function Page() {
  const t = await getT()
  const isFr = t.language === 'fr'

  // Three concrete cost lines — money goes from "donate" → these.
  // No invented numbers; the figures are honest current-state
  // estimates the visitor can fact-check by reading the LICENSE
  // (Ayiti Dijital is an e.V., so accounts are public on request).
  const fundedBy = [
    {
      icon: Globe2,
      title: isFr ? 'Hébergement + bande passante' : 'Ebèjman + bann pasan',
      body: isFr
        ? 'Postgres, stockage des scans, CDN — l’accès gratuit à la base juridique ne tient que parce qu’une facture mensuelle est réglée quelque part.'
        : "Postgres, depo eskan yo, CDN — aksè gratis ak baz jiridik la kenbe sèlman paske gen yon fakti chak mwa ki peye yon kote.",
    },
    {
      icon: BookOpen,
      title: isFr ? 'Numérisation + structuration' : 'Nimerizasyon + estriktirasyon',
      body: isFr
        ? "OCR, transcription, vérification éditoriale, mise en forme bilingue. Chaque texte ajouté demande des heures de travail humain avant d’être publiable."
        : "OCR, transkripsyon, verifikasyon editoryal, fòma bileng. Chak tèks ki ajoute mande èdtan travay imen anvan yo ka pibliye l.",
    },
    {
      icon: ShieldCheck,
      title: isFr ? 'Indépendance' : 'Endepandans',
      body: isFr
        ? "Pas de publicité, pas de paywall, pas de revente de données. Les dons institutionnels et individuels gardent la plateforme alignée sur sa mission, pas sur un client commercial."
        : "Pa gen piblisite, pa gen paywall, pa gen revann done. Don enstitisyonèl ak endividyèl kenbe platfòm nan aliyen ak misyon li, pa ak yon kliyan komèsyal.",
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Dark hero — same navy treatment used across the site so the
          donate page reads as part of the institutional surface. */}
      <div className="relative bg-primary dark:bg-slate-900 text-white overflow-hidden border-b border-white/5 dark:border-slate-800">
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
              { label: isFr ? 'Soutenir' : 'Sipòte' },
            ]}
          />

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-widest text-amber-300 mb-6 animate-in fade-in duration-500">
            <Heart className="w-3.5 h-3.5" />
            {isFr ? 'Soutenir' : 'Sipòte'}
          </div>

          <h1 className="text-4xl lg:text-6xl font-black mb-6 leading-tight tracking-tight animate-in fade-in slide-in-from-top-2 duration-500">
            {isFr
              ? 'Le droit haïtien, libre — par votre soutien.'
              : 'Dwa ayisyen an, lib — gras ak sipò ou.'}
          </h1>

          <p className="text-slate-300 text-lg lg:text-xl leading-relaxed max-w-3xl animate-in fade-in duration-700 [animation-delay:120ms]">
            {isFr
              ? "LexHaïti reste gratuit, sans publicité et sans paywall, parce qu'une association à but non lucratif paie chaque mois la note. Votre don finance directement l'hébergement, la numérisation, et l'indépendance éditoriale."
              : "LexHaïti rete gratis, san piblisite ak san paywall, paske yon asosiyasyon san bi likratif peye chak mwa fakti a. Don ou finanse dirèkteman ebèjman, nimerizasyon, ak endepandans editoryal."}
          </p>
        </div>
      </div>

      {/* What your money funds — three concrete buckets, not abstract
          virtue-signalling. */}
      <div className="container py-20 lg:py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3">
            {isFr ? 'Où va l’argent' : 'Kote lajan an ale'}
          </p>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 leading-tight">
            {isFr
              ? 'Trois lignes de coût, rien d’autre.'
              : 'Twa liy depans, pa gen lòt.'}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {fundedBy.map((item, idx) => (
            <div
              key={idx}
              className="group animate-in fade-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className="mb-5 inline-flex p-3.5 rounded-xl bg-primary/[0.06] border border-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:border-primary group-hover:shadow-md">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-slate-100 leading-tight">
                {item.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Channels — what to do RIGHT NOW. Bank transfer to Ayiti Dijital is the
          one channel that works today; the Stripe / card row is a
          deliberate placeholder so the visitor can see the roadmap. */}
      <div className="border-y dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
        <div className="container py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3">
                {isFr ? 'Comment donner' : 'Kijan pou bay'}
              </p>
              <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 leading-tight mb-5">
                {isFr
                  ? 'Deux canaux, l’un opérationnel, l’autre bientôt.'
                  : 'De kanal — youn ki mache, lòt la byento.'}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg">
                {isFr
                  ? "Les dons sont reçus par Ayiti Dijital e.V., l’association allemande sans but lucratif qui édite LexHaïti. Ayiti Dijital publie son rapport annuel sur demande — chaque euro alloué à la plateforme est traçable."
                  : "Don yo resevwa pa Ayiti Dijital e.V., asosiyasyon alman san bi likratif ki edite LexHaïti. Ayiti Dijital pibliye rapò chak ane sou demand — chak ewo ki alwe nan platfòm nan ka swiv."}
              </p>
            </div>

            <div className="space-y-4">
              {/* Bank transfer — the channel that actually works today. */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {isFr ? 'Virement bancaire' : 'Vìreman bankè'}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                        {isFr ? 'Disponible' : 'Disponib'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      {isFr
                        ? "Le canal historique : virement SEPA vers le compte de Ayiti Dijital e.V. Contactez-nous pour recevoir l’IBAN et le reçu fiscal."
                        : "Kanal istorik la : vìreman SEPA nan kont Ayiti Dijital e.V. Kontakte nou pou resevwa IBAN ak resi taks la."}
                    </p>
                    <a
                      href="mailto:donate@lexhaiti.org?subject=Soutien%20LexHa%C3%AFti"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4"
                    >
                      <Mail className="w-4 h-4" />
                      donate@lexhaiti.org
                    </a>
                  </div>
                </div>
              </div>

              {/* Card / Stripe — placeholder. Honest "coming soon". */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-7">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3 flex-wrap mb-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {isFr ? 'Carte bancaire' : 'Kat bankè'}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {isFr ? 'Bientôt' : 'Byento'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {isFr
                        ? "L’intégration Stripe est en cours. En attendant, le virement bancaire ci-dessus est le moyen le plus rapide."
                        : "Entegrasyon Stripe ap fèt kounye a. Antretan, vìreman bankè anlè a se mwayen ki pi rapid."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional partnerships — for foundations / ministries
          who might want to fund a track of work rather than make a
          one-off donation. */}
      <div className="container py-20 lg:py-24">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/65 mb-3">
            {isFr ? 'Partenariats institutionnels' : 'Patenarya enstitisyonèl'}
          </p>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 leading-tight mb-5">
            {isFr
              ? 'Financer une vague de numérisation ?'
              : 'Finanse yon vag nimerizasyon?'}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg mb-4">
            {isFr
              ? "Universités, fondations, ministères, ONG : Ayiti Dijital accepte des financements ciblés sur un axe spécifique — un Code en entier, un demi-siècle du Moniteur, la traduction kreyòl d’un corpus existant. Le livrable est défini en amont, l’avancement publié sur la plateforme."
              : "Inivèsite, fondasyon, ministè, ONG : Ayiti Dijital aksepte finansman ki vize yon liy espesifik — yon Kòd antye, mwatye yon syèk Moniteur, tradiksyon kreyòl yon kòpis ki egziste. Liv ki gen pou bay defini davans, avansman an pibliye sou platfòm nan."}
          </p>
          <a
            href="mailto:partnerships@lexhaiti.org?subject=Partenariat%20institutionnel"
            className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            <Mail className="w-4 h-4" />
            partnerships@lexhaiti.org
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Closing CTA — back to the corpus, the thing they're funding. */}
      <div className="container pb-24 lg:pb-32">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary dark:bg-slate-900 text-white animate-in fade-in slide-in-from-bottom-4 duration-700 dark:ring-1 dark:ring-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/15 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-600/12 blur-[120px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          <div className="relative z-10 px-8 py-16 lg:px-20 lg:py-20 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight max-w-3xl mx-auto">
              {isFr
                ? 'Voir ce que votre don rend possible.'
                : 'Wè sa don ou rann posib.'}
            </h2>
            <div className="mt-10 flex justify-center">
              <Link
                href="/lois"
                className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-primary dark:text-white px-6 py-3 rounded-md font-semibold transition-all active:scale-[0.99] shadow-sm hover:shadow-md"
              >
                <BookOpen className="w-4 h-4" />
                {isFr ? 'Explorer le corpus' : 'Eksplore kòpis la'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
