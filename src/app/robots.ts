import type { MetadataRoute } from 'next'

const SITE = 'https://lexhaiti.org'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/editorial/', '/api/', '/profile/', '/sign-in/'],
      },
      // AI training crawlers — scrape content for model training,
      // give nothing back. Block them.
      {
        userAgent: [
          'GPTBot',
          'CCBot',
          'Google-Extended',
          'anthropic-ai',
          'Bytespider',
          'Diffbot',
          'FacebookBot',
          'Omgilibot',
          'Amazonbot',
        ],
        disallow: '/',
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
