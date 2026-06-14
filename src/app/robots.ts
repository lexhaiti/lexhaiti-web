import type { MetadataRoute } from 'next'

const SITE = 'https://www.lexhaiti.org'

// Editorial / private surfaces no crawler should index.
const PRIVATE = ['/editorial/', '/api/', '/profile/', '/sign-in/']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Search engines + anyone not named below. Googlebot / Bingbot fall
      // here and power most AI web search (Google AI Overviews, Copilot,
      // and the search backends ChatGPT / Perplexity query).
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE,
      },

      // AI answer engines that CITE their sources with a link back — we want
      // these. A named user-agent group fully overrides the `*` group, so we
      // repeat the private disallow here.
      {
        userAgent: [
          'OAI-SearchBot', // ChatGPT search results
          'ChatGPT-User', // ChatGPT opening a user-supplied link
          'PerplexityBot', // Perplexity answer engine
          'Perplexity-User', // Perplexity user-initiated fetch
          'Claude-SearchBot', // Claude web search
          'Claude-User', // Claude opening a user-supplied link
        ],
        allow: '/',
        disallow: PRIVATE,
      },

      // AI *training* crawlers + content scrapers — they ingest the corpus
      // and give nothing back (no citation). Blocked: we want to be cited,
      // not trained on. NOTE: Google-Extended is Gemini training/grounding;
      // blocking it keeps us out of training but also out of Gemini-app
      // grounding. Google Search + AI Overviews use Googlebot (allowed above)
      // and are unaffected.
      {
        userAgent: [
          'GPTBot',
          'CCBot',
          'Google-Extended',
          'ClaudeBot',
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
