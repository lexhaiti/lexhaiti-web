'use client'

/**
 * Theme picker — a single ``SunMoon`` button in the header that
 * opens a modal with three radio cards (Light / Dark / System).
 * Pattern modeled on the Légifrance / French gov design system:
 * the trigger icon is theme-agnostic (always SunMoon) so it reads
 * as "open display settings", not as a binary toggle.
 *
 * Defaults & persistence
 * ----------------------
 * First visit → ``system`` (configured via ``defaultTheme="system"``
 * in providers.tsx) — follows the OS prefers-color-scheme. Once the
 * user picks Light or Dark from this dialog, next-themes persists
 * the choice to localStorage and subsequent loads honour it,
 * IGNORING the OS setting. Picking ``Système`` again clears the
 * explicit override and re-enables OS-following.
 *
 * Selecting an option applies the theme immediately — the change
 * IS the confirmation — and the dialog stays open as a control
 * panel. The user dismisses it by clicking the "Fermer" button or
 * pressing Escape. This mirrors the macOS / Légifrance pattern
 * where appearance is a setting you tweak and observe, not a
 * one-shot menu.
 *
 * Accessibility
 * -------------
 * The three options are a WAI-ARIA radio group: container has
 * ``role="radiogroup"``, each option ``role="radio"`` +
 * ``aria-checked``. Arrow keys (Up/Down + Left/Right) move focus
 * *and* select, matching the strict WAI-ARIA radio convention.
 * Home/End jump to first/last. Space and Enter commit the focused
 * option (redundant with arrow-key auto-select, but expected by
 * keyboard users). Tab moves focus into and out of the group as a
 * single stop (roving tabindex anchors Tab to the selected option).
 * Each option has a visible focus-visible ring.
 *
 * Responsive
 * ----------
 * Dialog width is ``calc(100% - 2rem)`` below sm (16px margin per
 * side on phones) and ``max-w-md`` above, so the cards never butt
 * against the viewport edge.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Cog, Moon, Sun, SunMoon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { useT } from '@/i18n/useT'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

type ThemeValue = 'light' | 'dark' | 'system'

const OPTIONS: ReadonlyArray<{
  value: ThemeValue
  labelKey: string
  descKey: string | null
  Icon: typeof Sun
}> = [
  { value: 'light', labelKey: 'theme.options.light.label', descKey: null, Icon: Sun },
  { value: 'dark', labelKey: 'theme.options.dark.label', descKey: null, Icon: Moon },
  {
    value: 'system',
    labelKey: 'theme.options.system.label',
    descKey: 'theme.options.system.description',
    Icon: Cog,
  },
]

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => setMounted(true), [])

  // Pre-hydration we don't know the stored value — assume the
  // configured ``system`` default. Avoids hydration mismatch.
  const current: ThemeValue = mounted ? ((theme as ThemeValue) ?? 'system') : 'system'

  // Selection applies the theme but doesn't dismiss the dialog —
  // the user closes via the Fermer button or Escape.
  const handleSelect = (value: ThemeValue) => {
    setTheme(value)
  }

  // Keyboard navigation matches the strict WAI-ARIA radio convention:
  // arrow keys move focus AND select (since the dialog stays open,
  // arrow-browsing now safely previews each theme live). Space and
  // Enter commit the currently-focused option (no-op if it was
  // already selected by the arrow key, but expected behaviour).
  const onRadioKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const n = OPTIONS.length
    let nextIdx: number | null = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      nextIdx = (idx + 1) % n
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      nextIdx = (idx - 1 + n) % n
    } else if (e.key === 'Home') {
      nextIdx = 0
    } else if (e.key === 'End') {
      nextIdx = n - 1
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      handleSelect(OPTIONS[idx].value)
      return
    }
    if (nextIdx != null) {
      e.preventDefault()
      radioRefs.current[nextIdx]?.focus()
      handleSelect(OPTIONS[nextIdx].value)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('theme.openSettings')}
        title={t('theme.openSettings')}
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          'w-9 h-9 border border-slate-200 bg-white text-slate-700',
          'hover:border-primary hover:text-primary transition-colors',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
          'dark:hover:border-primary dark:hover:text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950',
          className,
        )}
      >
        <SunMoon className="w-4 h-4" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[calc(100%-2rem)] sm:max-w-md"
          closeLabel={t('theme.closeButton')}
        >
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl">
              {t('theme.dialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('theme.dialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div
            role="radiogroup"
            aria-label={t('theme.dialogTitle')}
            className="mt-2 flex flex-col gap-3"
          >
            {OPTIONS.map((opt, idx) => {
              const isSelected = current === opt.value
              const Icon = opt.Icon
              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    radioRefs.current[idx] = el
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  // Roving tabindex: only the selected option is in
                  // the Tab order; arrow keys move within the group.
                  // Matches the WAI-ARIA radio-group pattern.
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => handleSelect(opt.value)}
                  onKeyDown={(e) => onRadioKeyDown(e, idx)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                    isSelected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  )}
                >
                  {/* Radio circle — filled with a check when selected,
                      hollow otherwise. The Check icon visually
                      reinforces the selection over a bare dot. */}
                  <span
                    className={cn(
                      'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-300 dark:border-slate-600',
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        isSelected
                          ? 'text-primary dark:text-white'
                          : 'text-slate-800 dark:text-slate-100',
                      )}
                    >
                      {t(opt.labelKey)}
                    </p>
                    {opt.descKey && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t(opt.descKey)}
                      </p>
                    )}
                  </div>

                  <Icon
                    className={cn(
                      'w-5 h-5 flex-shrink-0 transition-colors',
                      isSelected
                        ? 'text-primary'
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300',
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
