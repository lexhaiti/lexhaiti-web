import { ImageResponse } from 'next/og'
import { getTextBySlug } from '@/lib/api/endpoints'

export const runtime = 'edge'
export const alt = 'LexHaiti — Texte juridique'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let title = slug.replace(/-/g, ' ')
  let type = 'Texte juridique'

  try {
    const text = await getTextBySlug(slug)
    title = text.title_fr ?? title
    type = text.category?.replace(/_/g, ' ') ?? type
  } catch {
    // Fallback to slug-derived title
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #00061f 0%, #00209F 60%, #0035d4 100%)',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '100px',
                background: 'rgba(224, 172, 43, 0.15)',
                border: '1px solid rgba(224, 172, 43, 0.3)',
                color: '#e0ac2b',
                fontSize: '16px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {type}
            </div>
          </div>

          <div
            style={{
              fontSize: title.length > 80 ? '36px' : '48px',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              maxWidth: '900px',
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#e0ac2b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: '#00061f',
              }}
            >
              LH
            </div>
            <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)' }}>
              lexhaiti.org
            </div>
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>
            Législation Haïtienne
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
