'use client'

/**
 * Bulk amendment apply — editor wires an amending law to N articles of
 * an amended law in one JSON payload.
 *
 * Flow: pick the amending law + amended law from the autocomplete (both
 * must already exist in the corpus), paste a minimal amendments JSON,
 * submit. The page reshapes the per-row payload by injecting the
 * picked target law's slug — so the editor only types
 * ``target_article_number`` + ``target_status`` per row instead of
 * repeating the law slug every time.
 *
 * Idempotent on the backend: re-submitting the same payload after
 * fixing one row in the JSON skips the previously-applied rows and
 * reports them as ``already_applied=true``.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  GitMerge,
  Loader2,
  Search,
  Upload,
  X,
} from 'lucide-react'

import { Breadcrumb } from '@/components/shared/Breadcrumb'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { useEditorMode } from '@/lib/hooks/useEditorMode'
import { useT } from '@/i18n/useT'
import {
  applyAmendmentsBulk,
  listEditorialTexts,
  type AmendmentBulkResult,
} from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'
import { cn } from '@/lib/utils'

type LegalTextListItem = components['schemas']['LegalTextListItem']
type ArticleStatus = components['schemas']['ArticleStatus']

// Per-row shape the editor pastes — the page reshapes it into the
// backend's AmendmentItem (which requires `target: {law_slug, article_number}`)
// by injecting the picked amended law's slug.
type EditorRow = {
  target_article_number: string
  target_status: ArticleStatus
  source_article_number?: string
  effective_from?: string
  new_version?: {
    title_fr?: string
    title_ht?: string
    text_fr: string
    text_ht?: string
  }
}

type EditorPayload = {
  amendments: EditorRow[]
  comment?: string
}

const PLACEHOLDER = `{
  "amendments": [
    {
      "target_article_number": "1444",
      "source_article_number": "1",
      "target_status": "in_force",
      "effective_from": "2024-05-01",
      "new_version": {
        "title_fr": "Délais de prescription",
        "text_fr": "<p>L'action en justice se prescrit par dix ans...</p>"
      }
    },
    {
      "target_article_number": "1500",
      "source_article_number": "2",
      "target_status": "abrogated",
      "effective_from": "2024-05-01"
    },
    {
      "target_article_number": "1501",
      "source_article_number": "3",
      "target_status": "suspended",
      "effective_from": "2024-05-01"
    }
  ],
  "comment": "Promulguée le 25 avril 2024"
}`

export default function EditorialAmendPage() {
  const { isEditor, status } = useEditorMode()
  const { language } = useT()
  const isFr = language !== 'ht'

  const [amendingLaw, setAmendingLaw] = useState<LegalTextListItem | null>(null)
  const [amendedLaw, setAmendedLaw] = useState<LegalTextListItem | null>(null)
  const [json, setJson] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AmendmentBulkResult | null>(null)

  // Live-parse the JSON so we can surface the count + a validation hint
  // before the editor clicks submit.
  const parsed = useMemo<
    { ok: true; data: EditorPayload } | { ok: false; message: string } | null
  >(() => {
    const t = json.trim()
    if (!t) return null
    try {
      const obj = JSON.parse(t)
      if (!obj || typeof obj !== 'object') {
        return { ok: false, message: isFr ? 'JSON invalide' : 'JSON pa valid' }
      }
      if (!Array.isArray(obj.amendments) || obj.amendments.length === 0) {
        return {
          ok: false,
          message: isFr
            ? 'Le champ "amendments" doit être un tableau non vide.'
            : 'Chan "amendments" dwe yon tablo ki pa vid.',
        }
      }
      return { ok: true, data: obj as EditorPayload }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `JSON: ${msg}` }
    }
  }, [json, isFr])

  const canSubmit =
    !!amendingLaw && !!amendedLaw && parsed?.ok === true && !submitting

  async function handleSubmit() {
    if (!amendingLaw || !amendedLaw || !parsed || parsed.ok !== true) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      // Reshape EditorRow → AmendmentItem by injecting the picked
      // amended law's slug into every target. Editors only type the
      // article number; the law slug stays at the top of the page.
      const body = {
        amendments: parsed.data.amendments.map((r) => ({
          target: {
            law_slug: amendedLaw.slug,
            article_number: r.target_article_number,
          },
          source: r.source_article_number
            ? { article_number: r.source_article_number }
            : undefined,
          effective_from: r.effective_from,
          target_status: r.target_status,
          new_version: r.new_version,
        })),
        comment: parsed.data.comment,
      }
      const res = await applyAmendmentsBulk(amendingLaw.slug, body)
      setResult(res)
    } catch (e) {
      // Backend Pydantic 422 errors come back as an array of
      // ``{loc, msg, type}`` — flatten to readable lines.
      const errObj = e as { body?: { detail?: unknown }; message?: string }
      const detail = errObj?.body?.detail
      if (Array.isArray(detail)) {
        setError(
          detail
            .map((d: { loc?: unknown[]; msg?: string }) =>
              `${(d.loc ?? []).join('.')}: ${d.msg ?? 'invalid'}`,
            )
            .join('\n'),
        )
      } else if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError(errObj?.message ?? String(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isEditor) {
    return (
      <div className="container py-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 max-w-3xl">
          <p className="text-sm text-slate-700">
            {isFr
              ? 'Cette page est réservée aux éditeurs connectés.'
              : 'Paj sa a pou editè ki konekte sèlman.'}
          </p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {isFr ? 'Se connecter' : 'Konekte'} →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero — matches the editorial console */}
      <div className="relative bg-primary text-white overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-12 lg:py-20 pt-28 lg:pt-36">
          <Breadcrumb
            className="mb-6"
            items={[
              { label: isFr ? 'Accueil' : 'Akèy', href: '/' },
              {
                label: isFr ? 'Éditorial' : 'Editoryal',
                href: '/editorial',
              },
              { label: isFr ? 'Ajouter un amendement' : 'Ajoute yon amandman' },
            ]}
          />
          <h1 className="animate-in fade-in slide-in-from-top-2 duration-500 text-4xl lg:text-6xl font-black mb-4 leading-tight tracking-tight text-white">
            {isFr ? 'Ajouter un amendement' : 'Ajoute yon amandman'}
          </h1>
          <p className="animate-in fade-in duration-500 delay-100 fill-mode-both text-slate-300 text-lg lg:text-xl leading-relaxed max-w-3xl">
            {isFr
              ? 'Lier une loi modificative à N articles d’une loi cible — création de versions, abrogation, suspension, en un seul JSON.'
              : 'Lyen yon lwa modifikasyon ak N atik nan yon lwa sib — kreyasyon vèsyon, abrogasyon, sispansyon, nan yon sèl JSON.'}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10 lg:py-12 space-y-8">
        {/* Two law pickers — both required */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LawPicker
            label={isFr ? 'Loi qui modifie' : 'Lwa ki modifye'}
            help={
              isFr
                ? 'Le texte porteur des amendements. Doit déjà exister au corpus.'
                : 'Tèks ki pote amandman yo. Dwe deja egziste nan kòpis la.'
            }
            value={amendingLaw}
            onChange={setAmendingLaw}
            isFr={isFr}
          />
          <LawPicker
            label={isFr ? 'Loi modifiée' : 'Lwa ki modifye'}
            help={
              isFr
                ? "Le texte cible — chaque amendement ci-dessous touche l'un de ses articles."
                : "Tèks sib la — chak amandman anba a manyen youn nan atik li yo."
            }
            value={amendedLaw}
            onChange={setAmendedLaw}
            isFr={isFr}
          />
        </section>

        {/* Amendments JSON */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-primary" />
                {isFr ? 'Amendements (JSON)' : 'Amandman yo (JSON)'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {isFr
                  ? 'Un objet par amendement. La loi modifiée sélectionnée ci-dessus s’applique à chaque ligne (pas besoin de répéter le slug).'
                  : 'Yon objè pa amandman. Lwa ki modifye chwazi anwo a aplike pou chak liy (pa bezwen repete slug la).'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setJson(PLACEHOLDER)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {isFr ? 'Charger un exemple' : 'Chaje yon egzanp'}
            </button>
          </div>

          {/* Live-parse badge */}
          {parsed && (
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest',
                parsed.ok
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-800',
              )}
            >
              {parsed.ok ? (
                <>
                  <Check className="w-3 h-3" />
                  {isFr
                    ? `${parsed.data.amendments.length} amendement(s) détecté(s)`
                    : `${parsed.data.amendments.length} amandman detekte`}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  {parsed.message}
                </>
              )}
            </div>
          )}

          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="w-full min-h-[360px] rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />

          {/* Status legend — small reminder of what target_status maps to */}
          <details className="text-xs text-slate-500 group">
            <summary className="cursor-pointer font-semibold text-slate-600 hover:text-primary">
              {isFr
                ? 'Statuts disponibles + comportement'
                : 'Estati ki disponib + konpòtman'}
            </summary>
            <ul className="mt-2 space-y-1 pl-4 border-l-2 border-slate-200">
              <li>
                <code className="text-primary">in_force</code> + new_version →{' '}
                {isFr
                  ? 'amendement (nouvelle version remplace l’ancienne)'
                  : 'amandman (nouvo vèsyon ranplase pi vye a)'}
              </li>
              <li>
                <code className="text-primary">abrogated</code> →{' '}
                {isFr ? 'abrogation' : 'abrogasyon'}
                {isFr ? ' (avec ou sans nouveau texte)' : ' (ak oswa san nouvo tèks)'}
              </li>
              <li>
                <code className="text-primary">suspended</code> →{' '}
                {isFr ? 'suspension (pas de nouvelle version)' : 'sispansyon (pa gen nouvo vèsyon)'}
              </li>
              <li>
                <code className="text-primary">transferred</code> →{' '}
                {isFr ? 'renumérotation' : 'renimewotasyon'}
              </li>
              <li>
                <code className="text-primary">obsolete</code> →{' '}
                {isFr ? 'tombé en désuétude' : 'tonbe nan dezuetid'}
              </li>
            </ul>
          </details>
        </section>

        {/* Submit + result */}
        <section className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            {amendingLaw && amendedLaw && parsed?.ok
              ? isFr
                ? `Prêt à appliquer ${parsed.data.amendments.length} amendement(s) sur ${amendedLaw.title_fr || amendedLaw.slug}.`
                : `Pare pou aplike ${parsed.data.amendments.length} amandman sou ${amendedLaw.title_ht || amendedLaw.title_fr || amendedLaw.slug}.`
              : isFr
                ? 'Sélectionnez les deux lois et collez le JSON.'
                : 'Chwazi de lwa yo epi kole JSON la.'}
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors',
              canSubmit
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed',
            )}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {isFr ? 'Appliquer les amendements' : 'Aplike amandman yo'}
          </button>
        </section>

        {error && (
          <ErrorBanner>
            <pre className="whitespace-pre-line text-xs">{error}</pre>
          </ErrorBanner>
        )}

        {result && (
          <ResultPanel result={result} amendedLaw={amendedLaw} isFr={isFr} />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Law picker — debounced autocomplete against listEditorialTexts.
// ──────────────────────────────────────────────────────────────────────

function LawPicker({
  label,
  help,
  value,
  onChange,
  isFr,
}: {
  label: string
  help: string
  value: LegalTextListItem | null
  onChange: (v: LegalTextListItem | null) => void
  isFr: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<LegalTextListItem[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced fetch. Skips < 2 chars so we don't flood the editor
  // with a result list on the first keystroke. We don't bother
  // clearing ``results`` when the query drops below the threshold —
  // the dropdown's render gate (``query.length >= 2``) hides them
  // anyway, and avoiding the sync setState here keeps the effect
  // pattern lint-clean.
  useEffect(() => {
    if (value) return
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const handle = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await listEditorialTexts({ q, limit: 12 })
        if (!cancelled) setResults(res.items ?? [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, value])

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
      <label className="block text-xs font-bold uppercase tracking-widest text-primary/65">
        {label}
      </label>
      <p className="text-xs text-slate-500 leading-relaxed">{help}</p>

      {value ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight">
              {(isFr ? value.title_fr : value.title_ht || value.title_fr) ||
                value.slug}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
              {value.slug}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setQuery('')
              setResults([])
            }}
            className="text-slate-400 hover:text-red-600 flex-shrink-0"
            aria-label={isFr ? 'Changer' : 'Chanje'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            placeholder={
              isFr ? 'Rechercher par titre ou slug…' : 'Chèche pa tit oswa slug…'
            }
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {loading && (
            <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 animate-spin" />
          )}
          {open && query.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 left-0 right-0 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {results.length === 0 && !loading ? (
                <p className="px-3 py-2.5 text-xs text-slate-400 italic">
                  {isFr ? 'Aucun résultat' : 'Pa gen rezilta'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(r)
                          setOpen(false)
                          setQuery('')
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-primary/[0.04] transition-colors"
                      >
                        <p className="text-sm text-slate-800 leading-tight line-clamp-2">
                          {(isFr ? r.title_fr : r.title_ht || r.title_fr) ||
                            r.slug}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                          {r.slug}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Result panel — per-row outcome breakdown
// ──────────────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  amendedLaw,
  isFr,
}: {
  result: AmendmentBulkResult
  amendedLaw: LegalTextListItem | null
  isFr: boolean
}) {
  const appliedFresh = result.applied.filter((a) => !a.already_applied)
  const appliedDup = result.applied.filter((a) => a.already_applied)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Check className="w-4 h-4 text-emerald-700" />
        <h3 className="text-sm font-bold text-emerald-900">
          {isFr
            ? `${appliedFresh.length} amendement(s) appliqué(s)`
            : `${appliedFresh.length} amandman aplike`}
          {appliedDup.length > 0 && (
            <span className="ml-2 text-xs font-semibold text-amber-700">
              {isFr
                ? `+ ${appliedDup.length} déjà appliqué(s)`
                : `+ ${appliedDup.length} deja aplike`}
            </span>
          )}
        </h3>
      </div>
      <ul className="space-y-1.5 text-xs">
        {result.applied.map((row, i) => (
          <li
            key={`${row.target_article_id}-${i}`}
            className="flex items-center gap-2 font-mono"
          >
            <span
              className={cn(
                'inline-flex items-center justify-center text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
                row.already_applied
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800',
              )}
            >
              {row.change_kind}
            </span>
            <span className="text-slate-700">
              art. {row.target_article_number}
            </span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-700">{row.target_status}</span>
            {row.new_version_id && (
              <span className="text-[10px] text-slate-400">
                (v#{row.new_version_id})
              </span>
            )}
          </li>
        ))}
      </ul>
      {amendedLaw && (
        <Link
          href={`/loi/${amendedLaw.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          {isFr ? 'Ouvrir la loi modifiée' : 'Ouvri lwa ki modifye'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}
