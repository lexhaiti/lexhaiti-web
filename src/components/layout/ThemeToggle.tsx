'use client'

/**
 * Sun ↔ Moon toggle for the editorial dark theme.
 *
 * Gated to editorial roles (admin / reviewer / editor) for now —
 * the public site is light-only until the per-component dark
 * variants are fleshed out. Keeping the toggle out of the public
 * navbar avoids shipping a half-finished theme to readers while
 * still letting the editorial team dogfood it.
 */

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useEditorMode } from '@/lib/hooks/useEditorMode'

interface Props {
  className?: string
}

export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const { isEditor } = useEditorMode()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Hide entirely for visitors — only editorial roles see the
  // affordance for now. ``useSession`` returns 'loading' on first
  // render; rendering nothing in that window is fine since the
  // navbar already lays out responsively without the chip.
  if (!isEditor) return null

  const isDark = mounted && resolvedTheme === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = isDark ? 'Mode clair' : 'Mode sombre'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'w-9 h-9 border border-slate-200 bg-white text-slate-700',
        'hover:border-primary hover:text-primary transition-colors',
        'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
        'dark:hover:border-primary dark:hover:text-primary',
        className,
      )}
    >
      <Icon className="w-4 h-4" aria-hidden />
    </button>
  )
}
