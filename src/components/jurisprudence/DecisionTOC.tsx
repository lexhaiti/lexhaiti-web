'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ListOrdered } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'

export type TocEntry = {
  id: string
  labelKey: string
  /** Optional override count rendered as a small badge — e.g. moyens=7. */
  count?: number
  /** Whether the section is actually present in the data. Inactive
   *  sections render greyed out and aren't clickable. */
  active: boolean
}

interface Props {
  entries: TocEntry[]
}

/**
 * Sticky left sidebar TOC for the decision detail page. On desktop
 * (lg+) renders a stacked vertical list with scroll-spy highlighting
 * the currently-in-view section. On mobile it collapses into a
 * compact accordion that opens above the content.
 *
 * Scroll-spy: uses IntersectionObserver to flag the topmost visible
 * `<section id={…}>` and highlights the matching entry.
 */
export function DecisionTOC({ entries }: Props) {
  const { t } = useT()
  const activeEntries = entries.filter((e) => e.active)
  const [active, setActive] = useState<string | null>(
    activeEntries[0]?.id ?? null,
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sections = activeEntries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (sections.length === 0) return

    // Highlight whichever section currently has the most viewport
    // overlap inside the upper half of the screen — the user is
    // reading the section that sits just under the fixed header.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (b.intersectionRatio || 0) - (a.intersectionRatio || 0),
          )
        if (visible[0]) {
          setActive(visible[0].target.id)
        }
      },
      {
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [activeEntries])

  const handleClick = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (!target) return
    // Account for the 80px fixed header so anchors don't slip under
    // it. `scrollIntoView({ block: 'start' })` would otherwise hide
    // the section's heading under the navbar.
    const top = target.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top, behavior: 'smooth' })
    setActive(id)
    setMobileOpen(false)
  }

  const list = (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const isActive = active === entry.id
        const enabled = entry.active
        return (
          <li key={entry.id}>
            {enabled ? (
              <a
                href={`#${entry.id}`}
                onClick={handleClick(entry.id)}
                className={cn(
                  'group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/[0.07] dark:bg-primary/15 text-primary font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors',
                      isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500',
                    )}
                  />
                  <span className="truncate">{t(entry.labelKey)}</span>
                </span>
                {typeof entry.count === 'number' && entry.count > 0 && (
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {entry.count}
                  </span>
                )}
              </a>
            ) : (
              <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 dark:text-slate-600 cursor-not-allowed">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
                <span className="truncate">{t(entry.labelKey)}</span>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside
        className="hidden lg:block"
        aria-label={t('jurisprudence.toc.summary')}
      >
        <nav className="sticky top-28">
          <p className="mb-3 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            <ListOrdered className="h-3.5 w-3.5" />
            {t('jurisprudence.toc.summary')}
          </p>
          {list}
        </nav>
      </aside>

      {/* Mobile collapsible accordion */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className={cn(
            'flex w-full items-center justify-between rounded-xl border bg-white dark:bg-slate-900 px-4 py-3 text-left transition-colors',
            mobileOpen
              ? 'border-primary/30 bg-primary/[0.03] dark:bg-primary/10'
              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            <ListOrdered className="h-4 w-4 text-primary" />
            {t('jurisprudence.toc.summary')}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform',
              mobileOpen && 'rotate-180',
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.2 },
              }}
              style={{ overflow: 'hidden' }}
            >
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2">
                {list}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
