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
import { useReaderChrome } from '@/components/layout/ReaderChromeContext'
import { useFooterAvoidance } from '@/lib/hooks/useFooterAvoidance'

export function ScrollToTop() {
  const [scrolledFar, setScrolledFar] = useState(false)
  // On the law-detail reader the button appears as soon as the reader
  // enters the body (in sync with the floating Sommaire toggle).
  // Elsewhere it falls back to the classic "scrolled past one viewport".
  const { stickyActive } = useReaderChrome()
  const visible = stickyActive || scrolledFar
  // Lifts the button above the footer instead of overlapping it.
  const footerRef = useFooterAvoidance<HTMLButtonElement>()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      setScrolledFar(window.scrollY > window.innerHeight)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => {
    if (typeof window === 'undefined') return
    if (window.scrollY <= 0) return

    // Respect reduced-motion: jump instantly.
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches
    if (reduce) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    // Drive the scroll ourselves rather than leaning on
    // ``behavior: 'smooth'``: the law reader puts ``content-visibility:
    // auto`` on hundreds of article cards whose real heights replace
    // their estimates as they scroll into view, shifting the layout
    // above the viewport. A browser smooth-scroll animates toward a
    // *fixed* target Y and stalls when that target moves. Easing from
    // the **current** position toward 0 each frame stays smooth no
    // matter how the height shifts — and y=0 is always reachable.
    //
    // ``behavior: 'instant'`` is essential here: plain ``'auto'``
    // resolves to the CSS ``scroll-behavior`` (which is ``smooth`` on
    // <html>), so each per-frame set would itself animate and the loop
    // would crawl ~1px/frame. ``'instant'`` forces a true jump.
    // The deadline is a safety net so a misbehaving page can't loop
    // forever.
    const deadline = performance.now() + 1200
    const step = () => {
      const cur = window.scrollY
      if (cur <= 2 || performance.now() > deadline) {
        window.scrollTo({ top: 0, behavior: 'instant' })
        return
      }
      window.scrollTo({ top: Math.floor(cur * 0.78), behavior: 'instant' })
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  return (
    <button
      ref={footerRef}
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
        // Only opacity transitions — the footer-avoidance transform is
        // applied imperatively and must track scroll instantly.
        'transition-opacity duration-200',
        visible
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none',
      )}
    >
      <ArrowUp className="w-5 h-5" aria-hidden />
    </button>
  )
}
