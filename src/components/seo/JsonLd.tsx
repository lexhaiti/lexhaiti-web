import { headers } from 'next/headers'
import { jsonLdToString } from '@/lib/harvest/jsonld'

/**
 * Render a JSON-LD `<script>` with the per-request CSP nonce (set by
 * `middleware.ts`) so it survives a strict `script-src` policy, and with the
 * XSS-safe serializer (`jsonLdToString` escapes `<` so editor-controlled fields
 * can't break out of the script element).
 *
 * Server component — reads `headers()`, so it renders on the dynamic path
 * (every JSON-LD-bearing page is already dynamic/ISR).
 */
export async function JsonLd({ graph }: { graph: unknown }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <script
      nonce={nonce}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdToString(graph) }}
    />
  )
}
