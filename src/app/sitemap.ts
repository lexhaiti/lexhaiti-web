import type { MetadataRoute } from 'next'
import { listTexts } from '@/lib/api/endpoints'

const SITE = 'https://lexhaiti.org'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE}/lois`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE}/recherche`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/thematiques`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/a-propos`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/contact`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/soutenir`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE}/moniteur`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const lawRoutes: MetadataRoute.Sitemap = []
  try {
    let offset = 0
    const size = 100
    let hasMore = true
    while (hasMore) {
      const page = await listTexts({ limit: size, offset })
      for (const item of page.items) {
        lawRoutes.push({
          url: `${SITE}/loi/${item.slug}`,
          changeFrequency: 'monthly',
          priority: 0.8,
        })
      }
      offset += size
      hasMore = offset < page.total
    }
  } catch (err) {
    console.error('[sitemap] Failed to fetch legal texts:', err)
  }

  return [...staticRoutes, ...lawRoutes]
}
