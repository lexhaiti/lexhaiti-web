'use client'

/**
 * Three-state theme toggle: System → Dark → Light → System.
 *
 * Default on first visit is ``system`` (configured via
 * ``defaultTheme="system"`` in providers.tsx) — follows the OS
 * preference (prefers-color-scheme). Once the user clicks the toggle
 * they enter an explicit mode (light or dark) which next-themes
 * persists in localStorage; subsequent loads honour that choice and
 * IGNORE the OS setting. Cycling once more brings them back to
 * ``system`` (the explicit override is cleared).
 *
 * The icon reflects the *stored* preference (Monitor / Sun / Moon),
 * not the resolved theme, so the user can tell at a glance which
 * mode is in effect — including the case where they're on ``system``
 * and the OS happens to be dark.
 */

import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

// Cycle order — chosen so the most common flow (system → opt out
// to dark for night reading) is a single click. A second click drops
// to light; a third returns to system. The icon shows where you are.
const NEXT_THEME: Record<string, 'light' | 'dark' | 'system'> = {
  system: 'dark',
  dark: 'light',
  light: 'system',
}

const ICON: Record<string, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

const LABEL: Record<string, string> = {
  system: 'Thème : système (cliquer pour forcer sombre)',
  light: 'Thème : clair (cliquer pour revenir au système)',
  dark: 'Thème : sombre (cliquer pour clair)',
}

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Before hydration we don't know the stored value — render the
  // neutral Monitor icon as a placeholder so the SSR markup matches
  // the post-hydration "system" default for first-time visitors.
  const current = mounted ? (theme ?? 'system') : 'system'
  const Icon = ICON[current] ?? Monitor
  const label = LABEL[current] ?? LABEL.system

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT_THEME[current] ?? 'system')}
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
