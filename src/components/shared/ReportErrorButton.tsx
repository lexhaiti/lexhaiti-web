'use client'

import { useState } from 'react'
import { Flag, Loader2, Check } from 'lucide-react'

import { reportMoniteurError } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

/**
 * Reader trust layer (Phase 3): "Signaler une erreur". Lets any reader
 * flag a suspected transcription/content error — the community becomes an
 * extra corrective without staffing cost. Submits to the public
 * /moniteur/error-reports endpoint; editors triage from the console.
 */
export function ReportErrorButton({
  lang,
  target,
  className,
}: {
  lang: 'fr' | 'ht'
  target: {
    target_type: string
    target_id?: number | null
    target_slug?: string | null
  }
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [location, setLocation] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFr = lang === 'fr'

  async function submit() {
    if (message.trim().length < 3) return
    setBusy(true)
    setError(null)
    try {
      await reportMoniteurError({
        ...target,
        target_url:
          typeof window !== 'undefined' ? window.location.href : null,
        location: location.trim() || null,
        message: message.trim(),
        reporter_email: email.trim() || null,
      })
      setDone(true)
    } catch (e: unknown) {
      setError(
        isFr
          ? "L'envoi a échoué. Réessayez plus tard."
          : 'Voye a echwe. Eseye pita.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 text-[13px] text-emerald-700 dark:text-emerald-400',
          className,
        )}
      >
        <Check className="w-4 h-4" aria-hidden="true" />
        {isFr
          ? 'Merci — votre signalement a été transmis.'
          : 'Mèsi — siyalman ou voye.'}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors',
          className,
        )}
      >
        <Flag className="w-3.5 h-3.5" aria-hidden="true" />
        {isFr ? 'Signaler une erreur' : 'Siyale yon erè'}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-2.5 max-w-md',
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
        {isFr ? 'Signaler une erreur' : 'Siyale yon erè'}
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={
          isFr
            ? "Décrivez l'erreur (texte, date, numéro d'article…)"
            : 'Dekri erè a (tèks, dat, nimewo atik…)'
        }
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        maxLength={200}
        placeholder={isFr ? 'Où ? (ex. Article 12)' : 'Ki kote? (egz. Atik 12)'}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        maxLength={320}
        placeholder={
          isFr ? 'Votre e-mail (facultatif)' : 'Imèl ou (opsyonèl)'
        }
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
      />
      {error && <p className="text-[12px] text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || message.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3.5 py-1.5 text-[13px] font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Flag className="w-4 h-4" />
          )}
          {isFr ? 'Envoyer' : 'Voye'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-slate-500 hover:text-slate-700"
        >
          {isFr ? 'Annuler' : 'Anile'}
        </button>
      </div>
    </div>
  )
}
