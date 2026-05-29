// Server Component — no client state.

import Link from 'next/link'
import { ArrowRight, BookOpen, Landmark, Scale, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { getT } from '@/i18n/server'

const CARDS = [
  {
    key: 'constitutions' as const,
    href: '/lois?category=constitution',
    Icon: Landmark,
    accent: 'from-primary to-blue-900',
    number: '01',
  },
  {
    key: 'codes' as const,
    href: '/lois?category=code',
    Icon: BookOpen,
    accent: 'from-primary to-slate-800',
    number: '02',
  },
  {
    key: 'lois' as const,
    href: '/lois?category=loi',
    Icon: Scale,
    accent: 'from-slate-800 to-primary',
    number: '03',
  },
  {
    key: 'aide' as const,
    href: '/a-propos',
    Icon: HelpCircle,
    accent: 'from-slate-700 to-slate-900',
    number: '04',
  },
]

export default async function ExplorerSection() {
  const t = await getT()

  return (
    <section className="relative w-full bg-white dark:bg-slate-950 py-16 lg:py-24 border-t border-slate-100 dark:border-slate-800">
      <div className="container">
        <SectionHeading title={t('home.explorer.eyebrow')} />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {CARDS.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className={cn(
                'group relative flex flex-col rounded-2xl overflow-hidden',
                'border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900',
                'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg',
                'hover:-translate-y-1 transition-all duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
              )}
            >
              {/* Icon header — gradient background with centered icon */}
              <div
                className={cn(
                  'relative flex items-center justify-center h-40 sm:h-44',
                  'bg-gradient-to-br',
                  card.accent,
                )}
              >
                {/* Subtle grid texture */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:20px_20px]" />
                <card.Icon className="relative w-10 h-10 text-white/90 group-hover:scale-110 transition-transform duration-300" />
                {/* Number badge */}
                <span className="absolute top-4 right-4 text-[10px] font-bold tracking-widest text-white/40 uppercase">
                  {card.number}
                </span>
              </div>

              {/* Amber accent line */}
              <div className="h-[2px] w-full bg-amber-400" />

              {/* Text content */}
              <div className="flex flex-col flex-1 p-6">
                <h3 className="text-base lg:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {t(`home.explorer.cards.${card.key}.title`)}
                </h3>
                <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed flex-1">
                  {t(`home.explorer.cards.${card.key}.description`)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Explorer
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
