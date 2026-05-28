'use client'

/**
 * Shared "reader chrome" state for the document-reading experience.
 *
 * When the law-detail page is scrolled into its body, it flips
 * ``stickyActive`` on. Three surfaces react to that single flag:
 *   - the global Header slides up out of the way (more reading room),
 *   - the law page pins its own compact tools bar to the top,
 *   - the floating "back to top" button appears.
 *
 * Default ``stickyActive = false`` and only the law page ever sets it,
 * so every other route keeps the header pinned exactly as before.
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
