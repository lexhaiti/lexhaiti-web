'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

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
