/**
 * Per-article OpenGraph share image.
 *
 * Renders an image like:
 *
 *   ┌───────────────────────────────────────────────────────┐
 *   │  ART. 1382                                            │
 *   │  Code Civil · Haïti                                   │
 *   │                                                       │
 *   │  Tout fait quelconque de l'homme, qui cause à         │
 *   │  autrui un dommage, oblige celui par la faute duquel… │
 *   │                                                       │
 *   │  LH  lexhaiti.org              Législation Haïtienne  │
 *   └───────────────────────────────────────────────────────┘
 *
 * Called by ``generateMetadata`` on the law-detail page when the
 * incoming request carries ``?article=N``. The page's static
 * ``opengraph-image.tsx`` still handles the law-level preview when no
 * article is specified.
 *
 * Stays on the edge runtime so the response is fast even from
 * WhatsApp/Telegram crawlers scraping share cards.
 */

import { ImageResponse } from 'next/og'
import { getTextBySlug } from '@/lib/api/endpoints'

export const runtime = 'edge'

const SIZE = { width: 1200, height: 630 }

interface RouteCtx {
  params: Promise<{ slug: string; number: string }>
}

export async function GET(_req: Request, { params }: RouteCtx) {
  const { slug, number } = await params
  const rawNumber = decodeURIComponent(number)

  let lawTitle = slug.replace(/-/g, ' ')
  let articleBody = ''
  let articleTitle: string | null = null

  try {
    const text = await getTextBySlug(slug)
    lawTitle = text.title_fr ?? lawTitle
    const match = (text.articles ?? []).find(
      (a) => String(a.number) === rawNumber,
    )
    if (match) {
      articleTitle = (match as any).title_fr ?? null
      // Strip HTML for the preview; OG image is text-only.
      const raw = match.content_fr ?? ''
      articleBody = raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  } catch {
    // Network/404 — fall back to the slug-derived title and an empty
    // body. The image will still render usefully.
  }

  const numLabel = /^article|^atik/i.test(rawNumber)
    ? rawNumber.toUpperCase()
    : `ART. ${rawNumber === 'premier' ? '1ᵉʳ' : rawNumber.toUpperCase()}`

  // Body excerpt — trim to ~280 chars so it fits without overflowing,
  // and add an ellipsis if we cut anything off.
  const MAX = 280
  const excerpt =
    articleBody.length > MAX
      ? articleBody.slice(0, MAX).replace(/\s+\S*$/, '') + '…'
      : articleBody

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'linear-gradient(135deg, #fdfbf6 0%, #f4ecdd 100%)',
          padding: '64px 80px',
          fontFamily: 'serif',
        }}
      >
        {/* Top: article number badge + law name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                background: '#0D1B4C',
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'sans-serif',
              }}
            >
              {numLabel}
            </div>
            <div
              style={{
                fontSize: '20px',
                color: '#0D1B4C',
                fontWeight: 600,
                fontFamily: 'sans-serif',
              }}
            >
              {lawTitle} · Haïti
            </div>
          </div>

          {articleTitle && (
            <div
              style={{
                fontSize: '32px',
                color: '#3F3A33',
                marginBottom: '20px',
                fontStyle: 'italic',
              }}
            >
              {articleTitle}
            </div>
          )}

          <div
            style={{
              fontSize: excerpt.length > 200 ? '34px' : '40px',
              color: '#1f2937',
              lineHeight: 1.35,
              maxWidth: '1040px',
            }}
          >
            {excerpt || `Article ${rawNumber}`}
          </div>
        </div>

        {/* Bottom: brand row with gold hairline above */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              height: '1px',
              background: '#F2C744',
              opacity: 0.7,
              width: '100%',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'sans-serif',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: '#0D1B4C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#F2C744',
                }}
              >
                LH
              </div>
              <div style={{ fontSize: '18px', color: '#3F3A33' }}>
                lexhaiti.org
              </div>
            </div>
            <div style={{ fontSize: '16px', color: '#6b7280' }}>
              Législation Haïtienne
            </div>
          </div>
        </div>
      </div>
    ),
    { ...SIZE },
  )
}
