import type { MetadataRoute } from 'next'
import {
  listDecisions,
  listMoniteurIssues,
  listTexts,
} from '@/lib/api/endpoints'

const SITE = 'https://lexhaiti.org'
const PAGE = 100

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE}/lois`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/jurisprudence`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/recherche`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/thematiques`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/a-propos`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/soutenir`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/moniteur`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  // Legal texts — lastmod from the editorial timestamps so harvesters and
  // crawlers can do incremental recrawls (ADR-004 Stage 0).
  const lawRoutes: MetadataRoute.Sitemap = []
  try {
    for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
      const page = await listTexts({ limit: PAGE, offset })
      total = page.total
      for (const item of page.items) {
        lawRoutes.push({
          url: `${SITE}/loi/${item.slug}`,
          lastModified: item.updated_at ?? item.published_at ?? undefined,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch legal texts:', err)
  }

  // Court decisions (jurisprudence).
  const decisionRoutes: MetadataRoute.Sitemap = []
  try {
    for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
      const page = await listDecisions({ limit: PAGE, offset })
      total = page.total
      for (const item of page.items) {
        decisionRoutes.push({
          url: `${SITE}/jurisprudence/${item.slug}`,
          lastModified: item.decision_date ?? undefined,
          changeFrequency: 'yearly',
          priority: 0.6,
        })
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch decisions:', err)
  }

  // Le Moniteur — published issues.
  const moniteurRoutes: MetadataRoute.Sitemap = []
  try {
    for (let offset = 0, total = Infinity; offset < total; offset += PAGE) {
      const page = await listMoniteurIssues({
        limit: PAGE,
        offset,
        only_published: true,
      })
      total = page.total
      for (const item of page.items) {
        moniteurRoutes.push({
          url: `${SITE}/moniteur/${item.id}`,
          lastModified: item.publication_date ?? undefined,
          changeFrequency: 'yearly',
          priority: 0.5,
        })
      }
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch Moniteur issues:', err)
  }

  return [...staticRoutes, ...lawRoutes, ...decisionRoutes, ...moniteurRoutes]
}
