'use client'

/**
 * Two-pane JSON editor for a Decision: left is a textarea with the
 * payload, right is a parsed preview that shows what each field will
 * become. Used by both `/editorial/jurisprudence/new` (create flow,
 * starts with an empty template) and
 * `/editorial/jurisprudence/[slug]/json` (edit flow, seeded from the
 * fetched decision).
 *
 * Validates client-side via JSON.parse + a minimal shape check
 * (slug + court + decision_date). The backend re-validates and is
 * authoritative — we just want to catch the obvious typos before the
 * round-trip.
 */

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast-simple'
import { useT } from '@/i18n/useT'
import { ApiError } from '@/lib/api/client'
import {
  createDecision,
  updateDecision,
  type DecisionCreatePayload,
} from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

interface Props {
  /** Pre-populates the editor; `null` means "create new draft". */
  initialJson?: string | null
  /** When set, the editor saves with PATCH /editorial/decisions/{slug}.
   *  Otherwise POST /editorial/decisions. */
  existingSlug?: string | null
}

const TEMPLATE: DecisionCreatePayload = {
  slug: 'cour-cassation-XXX-YYYY-MM-DD',
  court: 'cassation',
  chamber: null,
  formation: null,
  case_number: null,
  decision_date: 'YYYY-MM-DD',
  hearing_date: null,
  outcome: null,
  parties_anonymized: true,
  subject_matter: [],
  parties: [],
  judges: [],
  procedural_history: [],
  moyens: [],
  dispositif_fr: null,
  dispositif_ht: null,
  full_text_fr: null,
  full_text_ht: null,
  summary_fr: null,
  summary_ht: null,
  headnotes_fr: null,
  headnotes_ht: null,
}

export function DecisionJsonEditor({ initialJson, existingSlug }: Props) {
  const { t } = useT()
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [raw, setRaw] = useState<string>(
    initialJson ?? JSON.stringify(TEMPLATE, null, 2),
  )

  // Re-seed when the parent swaps the initialJson (slug change, etc.).
  useEffect(() => {
    if (initialJson != null) setRaw(initialJson)
  }, [initialJson])

  const parsed = useMemo<
    { ok: true; value: DecisionCreatePayload } | { ok: false; error: string }
  >(() => {
    try {
      const v = JSON.parse(raw) as unknown
      if (!v || typeof v !== 'object') {
        return { ok: false, error: t('decisionEditor.json.invalid') }
      }
      const obj = v as Record<string, unknown>
      if (!('slug' in obj) || typeof obj.slug !== 'string') {
        return { ok: false, error: t('decisionEditor.json.slugMissing') }
      }
      if (!('court' in obj) || typeof obj.court !== 'string') {
        return { ok: false, error: t('decisionEditor.json.courtMissing') }
      }
      if (
        !('decision_date' in obj) ||
        typeof obj.decision_date !== 'string'
      ) {
        return {
          ok: false,
          error: t('decisionEditor.json.decisionDateMissing'),
        }
      }
      return { ok: true, value: v as DecisionCreatePayload }
    } catch (e) {
      return {
        ok: false,
        error: `${t('decisionEditor.json.invalid')}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      }
    }
  }, [raw, t])

  function submit() {
    if (!parsed.ok) {
      toast(parsed.error)
      return
    }
    startTransition(async () => {
      try {
        if (existingSlug) {
          const updated = await updateDecision(existingSlug, parsed.value)
          toast(t('decisionEditor.json.saved'))
          router.push(
            `/editorial/jurisprudence/${encodeURIComponent(
              updated.slug ?? existingSlug,
            )}`,
          )
        } else {
          const created = await createDecision(parsed.value)
          toast(t('decisionEditor.json.saved'))
          router.push(
            `/editorial/jurisprudence/${encodeURIComponent(
              created.slug,
            )}`,
          )
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          toast(t('decisionEditor.bar.apiUnavailable'))
          return
        }
        const code = err instanceof ApiError ? ` (${err.status})` : ''
        const detail =
          err instanceof ApiError
            ? typeof err.body === 'object' && err.body
              ? JSON.stringify(err.body).slice(0, 200)
              : err.message
            : err instanceof Error
              ? err.message
              : String(err)
        toast(`${t('decisionEditor.json.failed')}${code} — ${detail}`)
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            JSON
          </label>
          <Button
            size="sm"
            onClick={submit}
            disabled={pending || !parsed.ok}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {existingSlug
              ? pending
                ? t('decisionEditor.json.updating')
                : t('decisionEditor.json.update')
              : pending
                ? t('decisionEditor.json.creating')
                : t('decisionEditor.json.create')}
          </Button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className={cn(
            'w-full min-h-[60vh] rounded-lg border border-slate-200 bg-white p-4',
            'font-mono text-xs leading-relaxed text-slate-800',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            !parsed.ok && 'border-red-300 focus:ring-red-300/20 focus:border-red-400',
          )}
          spellCheck={false}
          placeholder={t('decisionEditor.json.placeholder')}
        />
        {!parsed.ok && (
          <p className="text-xs text-red-600">{parsed.error}</p>
        )}
      </div>

      {/* Right: preview */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {t('decisionEditor.json.preview')}
        </label>
        <div className="min-h-[60vh] rounded-lg border border-slate-200 bg-slate-50/40 p-4 overflow-auto">
          {parsed.ok ? (
            <PreviewView payload={parsed.value} />
          ) : (
            <p className="text-xs text-slate-400 italic">
              {t('decisionEditor.json.previewEmpty')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PreviewView({ payload }: { payload: DecisionCreatePayload }) {
  return (
    <dl className="space-y-2 text-xs">
      <Row label="slug" value={payload.slug} mono />
      <Row label="court" value={payload.court} />
      <Row
        label="decision_date"
        value={payload.decision_date}
        mono
      />
      {payload.case_number && (
        <Row label="case_number" value={payload.case_number} mono />
      )}
      {payload.chamber && <Row label="chamber" value={payload.chamber} />}
      {payload.outcome && <Row label="outcome" value={payload.outcome} />}
      {payload.subject_matter && payload.subject_matter.length > 0 && (
        <Row
          label="subject_matter"
          value={
            <div className="flex flex-wrap gap-1">
              {payload.subject_matter.map((s) => (
                <span
                  key={s}
                  className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-mono"
                >
                  {s}
                </span>
              ))}
            </div>
          }
        />
      )}
      {payload.parties && payload.parties.length > 0 && (
        <Row
          label={`parties (${payload.parties.length})`}
          value={
            <ul className="space-y-0.5">
              {payload.parties.map((p, i) => (
                <li key={i}>
                  <span className="font-mono text-slate-500">{p.role}:</span>{' '}
                  {p.name}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {payload.judges && payload.judges.length > 0 && (
        <Row
          label={`judges (${payload.judges.length})`}
          value={
            <ul className="space-y-0.5">
              {payload.judges.map((j, i) => (
                <li key={i}>
                  <span className="font-mono text-slate-500">{j.role}:</span>{' '}
                  {j.name}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {payload.procedural_history && payload.procedural_history.length > 0 && (
        <Row
          label={`procedural_history (${payload.procedural_history.length})`}
          value={
            <ul className="space-y-0.5">
              {payload.procedural_history.map((s, i) => (
                <li key={i}>
                  <span className="font-mono text-slate-500">
                    {s.decision_date}
                  </span>{' '}
                  · {s.court}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {payload.moyens && payload.moyens.length > 0 && (
        <Row
          label={`moyens (${payload.moyens.length})`}
          value={
            <ul className="space-y-0.5">
              {payload.moyens.map((m, i) => (
                <li key={i}>
                  <span className="font-mono text-slate-500">
                    #{m.number}
                  </span>{' '}
                  {m.title ?? <span className="italic">(no title)</span>}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {payload.dispositif_fr && (
        <Row
          label="dispositif_fr"
          value={
            <span className="line-clamp-3">{payload.dispositif_fr}</span>
          }
        />
      )}
      {payload.full_text_fr && (
        <Row
          label={`full_text_fr (${payload.full_text_fr.length} chars)`}
          value={
            <span className="line-clamp-3 italic text-slate-500">
              {payload.full_text_fr.slice(0, 200)}…
            </span>
          }
        />
      )}
      {payload.summary_fr && (
        <Row
          label="summary_fr"
          value={<span className="line-clamp-3">{payload.summary_fr}</span>}
        />
      )}
    </dl>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 border-b border-slate-200 pb-1.5">
      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500 pt-0.5">
        {label}
      </dt>
      <dd className={cn('text-slate-800', mono && 'font-mono text-[11px]')}>
        {value}
      </dd>
    </div>
  )
}

export function BackToListLink() {
  const { t } = useT()
  return (
    <Link
      href="/editorial/jurisprudence"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary"
    >
      <ArrowLeft className="w-4 h-4" />
      {t('decisionEditor.json.backToList')}
    </Link>
  )
}
