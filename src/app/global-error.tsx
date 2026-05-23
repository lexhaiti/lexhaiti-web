'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-white px-4">
          <div className="text-center max-w-md">
            <h1 className="text-4xl font-black text-slate-900 mb-3">
              Erreur inattendue
            </h1>
            <p className="text-slate-600 mb-6">
              Une erreur est survenue. Veuillez réessayer ou revenir à
              l&apos;accueil.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={reset}
                className="px-5 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
              >
                Réessayer
              </button>
              <a
                href="/"
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
              >
                Accueil
              </a>
            </div>
            {error.digest && (
              <p className="mt-6 text-xs text-slate-400 font-mono">
                {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
