'use client'

/**
 * Tree-aware collapse / expand state for a flat list of headings.
 *
 * Two views in the law-detail page need to act on the same set of
 * collapsed heading ids:
 *   - ArticleListView renders the heading rows + filters article
 *     cards based on whether any ancestor is collapsed.
 *   - DocumentToolbar renders the "Tout fermer / Tout ouvrir" pair
 *     above the list, plus eventually any other bulk affordance.
 *
 * Lifting the state into a custom hook lets both surfaces share it
 * without prop-drilling four callbacks. The hook also handles the
 * cascading-collapse semantics (collapsing a parent adds every
 * descendant id to the Set) so callers don't have to reimplement
 * that logic.
 */

import { useCallback, useMemo, useState } from 'react'
import type { components } from '@/lib/api-types'

type HeadingRead = components['schemas']['LegalHeadingRead']

export interface HeadingCollapseApi {
  collapsed: Set<number>
  toggle: (id: number) => void
  collapseAll: () => void
  expandAll: () => void
  isCollapsed: (id: number) => boolean
  hasCollapsed: boolean
}

export function useHeadingCollapse(
  headings: HeadingRead[],
): HeadingCollapseApi {
  const descendantsByHeadingId = useMemo(() => {
    const childrenByParent = new Map<number | null, HeadingRead[]>()
    for (const h of headings) {
      const key = h.parent_id ?? null
      const list = childrenByParent.get(key)
      if (list) list.push(h)
      else childrenByParent.set(key, [h])
    }
    const m = new Map<number, number[]>()
    for (const h of headings) {
      const out: number[] = []
      const stack = [h.id]
      while (stack.length) {
        const id = stack.pop()!
        out.push(id)
        const kids = childrenByParent.get(id)
        if (kids) for (const k of kids) stack.push(k.id)
      }
      m.set(h.id, out)
    }
    return m
  }, [headings])

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const toggle = useCallback(
    (id: number) => {
      setCollapsed((s) => {
        const next = new Set(s)
        if (next.has(id)) {
          next.delete(id)
        } else {
          const descendants = descendantsByHeadingId.get(id) ?? [id]
          for (const d of descendants) next.add(d)
        }
        return next
      })
    },
    [descendantsByHeadingId],
  )

  const collapseAll = useCallback(() => {
    setCollapsed(new Set(headings.map((h) => h.id)))
  }, [headings])

  const expandAll = useCallback(() => {
    setCollapsed(new Set())
  }, [])

  const isCollapsed = useCallback(
    (id: number) => collapsed.has(id),
    [collapsed],
  )

  return {
    collapsed,
    toggle,
    collapseAll,
    expandAll,
    isCollapsed,
    hasCollapsed: collapsed.size > 0,
  }
}
