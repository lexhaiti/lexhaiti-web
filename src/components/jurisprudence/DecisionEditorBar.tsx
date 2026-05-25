'use client'

/**
 * Sticky bottom bar for the jurisprudence detail page when the viewer
 * is an editor. Mirrors the LegalText EditorBar pattern (same fixed
 * inset-x-0 bottom layout, same status pill + action buttons, same
 * comment-box reveal for request-changes / unpublish) but talks to the
 * editorial Decision endpoints.
 *
 * The bar is rendered by the editorial detail page at
 * `/editorial/jurisprudence/[slug]` so the public route stays
 * editor-free.
 */

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  Braces,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquareWarning,
  Pencil,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast-simple'
import { useT } from '@/i18n/useT'
import { ApiError } from '@/lib/api/client'
import {
  deleteDecision,
  publishDecision,
  requestDecisionChanges,
  submitDecisionForReview,
  unpublishDecision,
  type DecisionDetail,
  type EditorialStatus,
} from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

import { DecisionEditor } from './DecisionEditor'

const STATUS_TONE: Record<EditorialStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 border-amber-200',
  pending_review: 'bg-blue-100 text-blue-900 border-blue-200',
  published: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  rejected: 'bg-red-100 text-red-900 border-red-200',
}

interface Props {
  decision: DecisionDetail
  editorEmail: string | null
  /** Called after any mutation succeeds — parent should refetch its
   *  DecisionDetail. The freshly-saved Decision is passed back from
   *  the edit-sheet save path so the parent can swap state without
   *  another round-trip. */
  onChanged?: (updated?: DecisionDetail) => void
}

export function DecisionEditorBar({
  decision,
  editorEmail,
  onChanged,
}: Props) {
  const { t } = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showCommentBox, setShowCommentBox] = useState<
    null | 'request_changes' | 'unpublish'
  >(null)
  const [comment, setComment] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const status: EditorialStatus =
    (decision.editorial_status as EditorialStatus | undefined) ?? 'draft'

  const statusLabel =
    status === 'draft'
      ? t('decisionEditor.bar.statusDraft')
      : status === 'pending_review'
        ? t('decisionEditor.bar.statusPending')
        : status === 'published'
          ? t('decisionEditor.bar.statusPublished')
          : t('decisionEditor.bar.statusRejected')

  function run(toastLabel: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn()
        toast(`${toastLabel}`)
        setShowCommentBox(null)
        setComment('')
        onChanged?.()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          toast(t('decisionEditor.bar.apiUnavailable'))
          return
        }
        const code = err instanceof ApiError ? ` (${err.status})` : ''
        toast(`${t('decisionEditor.bar.failed')}${code}`)
      }
    })
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteDecision(decision.slug)
      toast(t('decisionEditor.bar.deleteSuccess'))
      setDeleteOpen(false)
      router.push('/editorial/jurisprudence')
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast(t('decisionEditor.bar.apiUnavailable'))
        setDeleting(false)
        return
      }
      const detail =
        e instanceof ApiError
          ? String(
              (e.body as { detail?: unknown } | undefined)?.detail ??
                e.message,
            )
          : e instanceof Error
            ? e.message
            : String(e)
      toast(detail)
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-24 duration-500 fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md">
        <div className="container max-w-7xl px-3 sm:px-4 py-2.5">
          <div className="flex items-center gap-3 overflow-x-auto">
            {/* Status pill */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0',
                STATUS_TONE[status],
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{statusLabel}</span>
            </div>

            {editorEmail && (
              <span className="hidden lg:inline text-xs text-slate-500 truncate min-w-0 flex-shrink">
                {editorEmail}
              </span>
            )}

            <div className="flex-1 min-w-0" />

            {/* Status-driven workflow buttons — same three-slot pattern
                as the LegalText EditorBar. */}
            {status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    t('decisionEditor.bar.submittedToast'),
                    () => submitDecisionForReview(decision.slug),
                  )
                }
                className="h-8 px-3 sm:px-4 flex-shrink-0 border-blue-300 text-blue-800 hover:bg-blue-50"
                title={t('decisionEditor.bar.submitForReview')}
              >
                <Eye className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">
                  {t('decisionEditor.bar.submitForReview')}
                </span>
              </Button>
            )}

            {status !== 'published' ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    t('decisionEditor.bar.publishedToast'),
                    () => publishDecision(decision.slug),
                  )
                }
                className="bg-emerald-600 text-white hover:bg-emerald-700 h-8 px-3 sm:px-4 flex-shrink-0"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1.5" />
                )}
                <span className="hidden sm:inline">
                  {status === 'pending_review'
                    ? t('decisionEditor.bar.approveAndPublish')
                    : t('decisionEditor.bar.publish')}
                </span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setShowCommentBox('unpublish')}
                className="h-8 px-3 sm:px-4 flex-shrink-0"
              >
                <Undo2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">
                  {t('decisionEditor.bar.unpublish')}
                </span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setEditorOpen(true)}
              className="h-8 px-3 sm:px-4 flex-shrink-0"
              title={t('decisionEditor.bar.edit')}
            >
              <Pencil className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden md:inline">
                {t('decisionEditor.bar.edit')}
              </span>
            </Button>

            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={pending}
              className="h-8 px-3 sm:px-4 flex-shrink-0"
              title={t('decisionEditor.bar.editJson')}
            >
              <Link
                href={`/editorial/jurisprudence/${encodeURIComponent(decision.slug)}/json`}
              >
                <Braces className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden lg:inline">
                  {t('decisionEditor.bar.editJson')}
                </span>
              </Link>
            </Button>

            {status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
                className="h-8 px-3 sm:px-4 flex-shrink-0 text-red-600 hover:text-red-700 hover:border-red-300 hover:bg-red-50"
                title={t('decisionEditor.bar.deleteDraft')}
              >
                <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden md:inline">
                  {t('decisionEditor.bar.deleteDraft')}
                </span>
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setShowCommentBox('request_changes')}
              className="h-8 px-3 sm:px-4 flex-shrink-0"
            >
              <MessageSquareWarning className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden md:inline">
                {t('decisionEditor.bar.requestChanges')}
              </span>
            </Button>
          </div>

          {showCommentBox && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  showCommentBox === 'request_changes'
                    ? t('decisionEditor.bar.requestPlaceholder')
                    : t('decisionEditor.bar.unpublishPlaceholder')
                }
                rows={3}
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCommentBox(null)
                    setComment('')
                  }}
                  disabled={pending}
                >
                  {t('decisionEditor.bar.cancel')}
                </Button>
                <Button
                  size="sm"
                  disabled={pending || comment.trim().length === 0}
                  onClick={() => {
                    if (showCommentBox === 'request_changes') {
                      run(t('decisionEditor.bar.requestedToast'), () =>
                        requestDecisionChanges(decision.slug, comment.trim()),
                      )
                    } else {
                      run(t('decisionEditor.bar.unpublishedToast'), () =>
                        unpublishDecision(decision.slug, comment.trim()),
                      )
                    }
                  }}
                >
                  {pending && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  {t('decisionEditor.bar.confirm')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DecisionEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        decision={decision}
        onSaved={(updated) => onChanged?.(updated)}
        onSlugChanged={(newSlug) => {
          router.replace(`/editorial/jurisprudence/${newSlug}`)
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteOpen(false)
        }}
        onConfirm={confirmDelete}
        title={t('decisionEditor.bar.deleteTitle')}
        description={t('decisionEditor.bar.deleteBody')}
        confirmLabel={t('decisionEditor.bar.deleteDraft')}
        cancelLabel={t('decisionEditor.bar.cancel')}
        destructive
        loading={deleting}
      />
    </>
  )
}
