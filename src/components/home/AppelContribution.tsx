// Server Component — no client state, no event handlers.

import Link from 'next/link'
import { ArrowRight, MailIcon } from 'lucide-react'
import { getT } from '@/i18n/server'

export default async function AppelContribution() {
  const t = await getT()

  return (
    <section className="relative w-full py-16 lg:py-20 border-t border-slate-100 bg-slate-50/50">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-8 lg:gap-16 items-center">
          {/* Left — text content with amber left accent */}
          <div className="relative pl-6 border-l-[3px] border-amber-400">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
              {t('home.appelContribution.eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
              {t('home.appelContribution.heading')}
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl">
              {t('home.appelContribution.body')}
            </p>
          </div>

          {/* Right — action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-primary text-white px-6 text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <MailIcon className="w-4 h-4" />
              {t('home.appelContribution.contact')}
            </Link>
            <Link
              href="/a-propos"
              className="inline-flex items-center justify-center gap-2 h-11 rounded-full border border-slate-300 bg-white text-slate-700 px-6 text-sm font-semibold hover:border-slate-400 hover:text-slate-900 transition-colors"
            >
              {t('home.appelContribution.mission')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
