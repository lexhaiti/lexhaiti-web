'use client'

/**
 * Shared "reader chrome" state for the document-reading experience.
 *
 * When the law-detail page is scrolled into its body it flips
 * ``stickyActive`` on — the signal that the reader has left the hero +
 * tools row behind and is now reading. The floating reading controls
 * fade in on it: the "Sommaire" toggle and the "back to top" button (so
 * they're absent at the very top, where the in-flow tools row already
 * offers the same controls).
 *
 * Default ``stickyActive = false`` and only the law page ever sets it.
 */

import { createContext, useContext, useMemo, useState } from 'react'

interface ReaderChromeValue {
  stickyActive: boolean
  setStickyActive: (active: boolean) => void
}

const ReaderChromeContext = createContext<ReaderChromeValue>({
  stickyActive: false,
  setStickyActive: () => {},
})

export function ReaderChromeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [stickyActive, setStickyActive] = useState(false)
  const value = useMemo(
    () => ({ stickyActive, setStickyActive }),
    [stickyActive],
  )
  return (
    <ReaderChromeContext.Provider value={value}>
      {children}
    </ReaderChromeContext.Provider>
  )
}

export function useReaderChrome(): ReaderChromeValue {
  return useContext(ReaderChromeContext)
}
