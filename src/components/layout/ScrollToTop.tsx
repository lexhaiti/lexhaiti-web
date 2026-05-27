'use client'

/**
 * Floating "back to top" button — appears in the bottom-right
 * corner once the user has scrolled past one viewport height,
 * smooth-scrolls back to y=0 on click.
 *
 * Mounted globally via SiteShell so every page gets it without
 * per-page wiring. Uses ``passive: true`` on the scroll listener
 * so it doesn't fight against page scroll on iOS.
 */

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Retour en haut"
      title="Retour en haut"
      tabIndex={visible ? 0 : -1}
      className={cn(
        'fixed z-40 bottom-6 right-6 sm:bottom-8 sm:right-8',
        'inline-flex items-center justify-center',
        'h-11 w-11 rounded-full',
        'bg-primary text-white shadow-lg shadow-primary/30',
        'hover:bg-primary/90 hover:shadow-primary/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2',
        'transition-all duration-200',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none',
      )}
    >
      <ArrowUp className="w-5 h-5" aria-hidden />
    </button>
  )
}
