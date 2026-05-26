'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/* ---------- types ---------- */

interface DialogFormProps {
  /** Controlled open state. */
  open: boolean
  onOpenChange: (open: boolean) => void

  /** Dialog header. */
  title: string
  description?: string

  /** Form body — rendered inside the dialog content area. */
  children: ReactNode

  /** Submit handler — called when the primary button is clicked. */
  onSubmit: () => void | Promise<void>

  /** Label for the primary action button. */
  submitLabel?: string
  /** Label for the cancel button. */
  cancelLabel?: string

  /** Disables the submit button (e.g. form incomplete). */
  submitDisabled?: boolean
  /** Shows a spinner on the submit button. */
  loading?: boolean

  /** Max width class for the dialog. Default: 'sm:max-w-lg'. */
  maxWidth?: string
}

/**
 * Reusable dialog shell for editorial forms.
 *
 * Handles the chrome — header, footer with cancel/submit, loading
 * spinner — so individual dialogs only need to supply the form body.
 *
 * @example
 * ```tsx
 * <DialogForm
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Ajouter un article"
 *   onSubmit={handleSave}
 *   loading={saving}
 *   submitDisabled={!isValid}
 * >
 *   <Input value={number} onChange={...} />
 * </DialogForm>
 * ```
 */
export function DialogForm({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  submitDisabled = false,
  loading = false,
  maxWidth = 'sm:max-w-lg',
}: DialogFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={maxWidth}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">{children}</div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
