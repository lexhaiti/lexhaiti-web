// CSV serialization for the editor usage dashboard. `buildUsageCsv` is pure
// and i18n-agnostic (stable identifier column keys, not display strings) so it
// can be unit-tested; `downloadCsv` is the DOM side-effect that triggers the
// browser download.

import type { AnalyticsUsageResponse } from '@/lib/api/endpoints'

const HEADERS = ['categorie', 'rang', 'element', 'type', 'nombre'] as const

/** Quote every field and double up embedded quotes — the always-quote rule
 *  is the simplest way to stay safe against commas, quotes, and newlines in
 *  free-text search queries. */
function field(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

function row(fields: (string | number)[]): string {
  return fields.map(field).join(',')
}

/** Flatten the usage aggregates into a single CSV — one row per metric,
 *  tagged with a `categorie` column (total / telechargement / recherche /
 *  recherche_zero). CRLF line endings for spreadsheet compatibility. */
export function buildUsageCsv(data: AnalyticsUsageResponse): string {
  const lines: string[] = [HEADERS.join(',')]

  for (const [eventType, count] of Object.entries(data.totals)) {
    lines.push(row(['total', '', eventType, '', count]))
  }
  data.top_downloads.forEach((d, i) => {
    lines.push(
      row([
        'telechargement',
        i + 1,
        d.label ?? `${d.target_type ?? '?'} #${d.target_id ?? '?'}`,
        d.event_type,
        d.count,
      ]),
    )
  })
  data.top_searches.forEach((s, i) => {
    lines.push(row(['recherche', i + 1, s.query, '', s.count]))
  })
  data.zero_result_searches.forEach((s, i) => {
    lines.push(row(['recherche_zero', i + 1, s.query, '', s.count]))
  })

  return lines.join('\r\n')
}

/** Trigger a client-side download of `csv` as `filename`. Prepends a UTF-8
 *  BOM so Excel renders accented FR/HT characters correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const bom = String.fromCharCode(0xfeff)
  const blob = new Blob([bom + csv], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
