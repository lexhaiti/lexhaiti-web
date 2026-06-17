'use client'

import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Mobile-only (`lg:hidden`) filter button that opens a bottom sheet —
 * the same pattern/design as the /lois (AllLaws) filter bar. The page
 * supplies its own filter controls as `children`; this owns the trigger
 * button, the sheet shell, and the Apply / Reset actions.
 */
export function MobileFilterSheet({
  activeCount,
  children,
  title,
  applyLabel,
  resetLabel,
  onReset,
}: {
  activeCount: number
  children: ReactNode
  title: string
  applyLabel: string
  resetLabel?: string
  onReset?: () => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'lg:hidden w-full justify-between rounded-xl h-11',
            activeCount > 0
              ? 'bg-primary text-white border-primary hover:bg-primary/90'
              : 'border-gray-200 dark:border-slate-700',
          )}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            {title}
          </span>
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-[2rem] p-0 overflow-hidden border-none"
      >
        <div className="flex h-full flex-col bg-white dark:bg-slate-900">
          <div className="p-6 pb-2">
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />
            <SheetHeader className="text-left">
              <SheetTitle className="text-2xl font-black text-gray-900 dark:text-slate-100">
                {title}
              </SheetTitle>
            </SheetHeader>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-4">
            {children}
          </div>

          <div className="flex gap-3 border-t p-4 dark:border-slate-800">
            {onReset && activeCount > 0 && (
              <SheetClose asChild>
                <Button
                  variant="outline"
                  onClick={onReset}
                  className="h-12 flex-1 rounded-xl font-bold"
                >
                  {resetLabel ?? 'Réinitialiser'}
                </Button>
              </SheetClose>
            )}
            <SheetClose asChild>
              <Button className="h-12 flex-[2] rounded-xl bg-primary font-bold text-white hover:bg-primary/90">
                {applyLabel}
              </Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
