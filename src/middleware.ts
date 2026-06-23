import { NextRequest, NextResponse } from 'next/server'

/**
 * Per-request nonce + Content-Security-Policy.
 *
 * A meaningful `script-src` CSP cannot use `'unsafe-inline'` (that would re-allow
 * the inline-script XSS it is meant to stop), so every inline script needs a
 * per-request nonce. Next.js reads the nonce from the CSP header we set on the
 * *request* and stamps it onto its own bootstrap/hydration scripts; our
 * server-rendered JSON-LD scripts read the same nonce via `headers()`.
 *
 * Rollout is **Report-Only** first: the browser reports violations but never
 * blocks, so a missed source can't take the site down. Once the live reports
 * are clean, flip `CSP_RESPONSE_HEADER` to the enforcing header.
 */

// Flip to 'content-security-policy' to ENFORCE once live reports are clean.
const CSP_RESPONSE_HEADER = 'content-security-policy-report-only'

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    // Inline scripts (Next bootstrap + our JSON-LD) run only with this nonce.
    // 'unsafe-eval' is needed by Next's dev HMR only — never in prod.
    `script-src 'self' 'nonce-${nonce}' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ''}`,
    // Styles can't execute JS; Next/Tailwind emit inline styles, so allow them.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://vitals.vercel-insights.com",
    // Same-origin only — anti-clickjacking (replaces the old static header).
    "frame-ancestors 'self'",
    // The editor facsimile iframes the scan via the same-origin /api proxy.
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  // Set the (enforcing-shaped) CSP on the REQUEST so Next applies the nonce to
  // its scripts, and expose the nonce for server components.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(CSP_RESPONSE_HEADER, csp)
  return response
}

export const config = {
  // Run on document requests only; skip static assets, the image optimizer,
  // and the API proxy (its responses set their own headers).
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
