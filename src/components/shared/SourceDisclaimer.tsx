import { Info } from 'lucide-react'

/**
 * Reader trust layer (Phase 3): a standing notice that the digitised text
 * is informational and not the official gazette. Standard for legal
 * platforms — it lowers the pressure for perfection and tells readers to
 * verify against the original when it matters.
 */
export function SourceDisclaimer({
  lang,
  className,
}: {
  lang: 'fr' | 'ht'
  className?: string
}) {
  const text =
    lang === 'fr'
      ? "Version numérisée à titre informatif — ce n'est pas la version officielle. En cas de doute, consultez le texte original du Moniteur."
      : 'Vèsyon dijitalize pou enfòmasyon — se pa vèsyon ofisyèl la. Si gen dout, gade tèks orijinal Moniteur la.'
  return (
    <div
      className={
        'flex items-start gap-2 rounded-lg border border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-950/20 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-900 dark:text-amber-200 ' +
        (className ?? '')
      }
      role="note"
    >
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
