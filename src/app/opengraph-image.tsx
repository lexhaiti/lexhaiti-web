import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'LexHaiti — Legislasyon Ayisyen'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #00061f 0%, #00209F 60%, #0035d4 100%)',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: '#e0ac2b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              color: '#00061f',
            }}
          >
            LH
          </div>
          <div style={{ fontSize: '28px', color: '#e0ac2b', fontWeight: 600 }}>
            lexhaiti.org
          </div>
        </div>

        <div
          style={{
            fontSize: '56px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: '24px',
          }}
        >
          La plateforme de
          <br />
          la législation haïtienne
        </div>

        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.5,
            maxWidth: '700px',
          }}
        >
          Recherchez les lois, décrets, codes et textes juridiques d'Haïti.
          Gratuit et accessible à tous.
        </div>

        <div
          style={{
            display: 'flex',
            gap: '32px',
            marginTop: '40px',
          }}
        >
          {['25+ textes', 'Recherche IA', 'Gratuit'].map((label) => (
            <div
              key={label}
              style={{
                padding: '10px 24px',
                borderRadius: '100px',
                border: '1.5px solid rgba(224, 172, 43, 0.4)',
                color: '#e0ac2b',
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  )
}
