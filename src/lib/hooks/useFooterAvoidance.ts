'use client'

import { useEffect, useRef } from 'react'

/**
 * Keeps a bottom-fixed floating control from overlapping the site
 * footer. Attach the returned ref to the control; while the footer is
 * below the fold the control stays pinned to the bottom, and once the
 * footer scrolls into view the hook translates the control up by the
 * footer's overlap so it "lands" just above it — the control's own
 * ``bottom-N`` spacing becomes the gap to the footer, and a stack of
 * controls lifted by the same amount keeps its relative spacing.
 *
 * Updates imperatively on scroll/resize so it tracks the footer every
 * frame without re-rendering the component (important when the control
 * lives next to a large table of contents).
 */
export function useFooterAvoidance<
  T extends HTMLElement,
>(): React.RefObject<T | null> {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let footerEl = document.querySelector('footer')

    const measure = () => {
      const el = ref.current
      if (!el) return
      if (!footerEl) footerEl = document.querySelector('footer')
      const footerTop = footerEl
        ? footerEl.getBoundingClientRect().top
        : Number.POSITIVE_INFINITY
      const overlap = window.innerHeight - footerTop
      el.style.transform =
        overlap > 0 ? `translateY(-${Math.round(overlap)}px)` : ''
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])

  return ref
}
