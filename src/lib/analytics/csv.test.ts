import { describe, it, expect } from 'vitest'

import { buildUsageCsv } from './csv'
import type { AnalyticsUsageResponse } from '@/lib/api/endpoints'

const sample: AnalyticsUsageResponse = {
  window_days: 30,
  totals: { download_scan: 5, search: 9 },
  top_downloads: [
    {
      event_type: 'download_scan',
      target_type: 'moniteur_issue',
      target_id: 1,
      count: 5,
      label: 'Le Moniteur n° 1',
    },
    // null label → must fall back to the target reference
    {
      event_type: 'download_law',
      target_type: 'legal_text',
      target_id: 9,
      count: 2,
      label: null,
    },
  ],
  // query with a comma AND a quote → must be CSV-escaped
  top_searches: [{ query: 'a,b "c"', count: 3 }],
  zero_result_searches: [{ query: 'rien', count: 1 }],
}

describe('buildUsageCsv', () => {
  it('emits a header row plus one row per metric', () => {
    const lines = buildUsageCsv(sample).split('\r\n')
    expect(lines[0]).toBe('categorie,rang,element,type,nombre')
    // 2 totals + 2 downloads + 1 search + 1 zero-result = 6 data rows
    expect(lines).toHaveLength(1 + 6)
  })

  it('falls back to the target reference when label is null', () => {
    expect(buildUsageCsv(sample)).toContain('legal_text #9')
  })

  it('escapes commas and quotes in free-text queries', () => {
    //  a,b "c"  →  "a,b ""c"""
    expect(buildUsageCsv(sample)).toContain('"a,b ""c"""')
  })

  it('tags each section with its categorie', () => {
    const csv = buildUsageCsv(sample)
    expect(csv).toContain('"total","","download_scan"')
    expect(csv).toContain('"telechargement","1"')
    expect(csv).toContain('"recherche_zero","1","rien"')
  })
})
