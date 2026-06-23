import { describe, expect, it } from 'vitest'
import { decisionJsonLd, jsonLdToString } from './jsonld'

// Regression test for the JSON-LD stored-XSS finding: editor-controlled fields
// (decision summary, court, law title…) are embedded into a
// `<script type="application/ld+json">` block. `JSON.stringify` does not escape
// `<`, so `</script>` in a field would break out of the script element and
// inject markup. `jsonLdToString` must make that impossible while staying valid
// JSON.
describe('jsonLdToString — XSS-safe JSON-LD serialization', () => {
  it('makes </script> impossible to emit (no script breakout)', () => {
    const out = jsonLdToString({ name: 'x</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).not.toContain('<script>')
  })

  it('escapes <, > and & to \\uXXXX forms', () => {
    const out = jsonLdToString({ v: '<>&' })
    expect(out).toContain('\\u003c')
    expect(out).toContain('\\u003e')
    expect(out).toContain('\\u0026')
    // no raw HTML-significant characters remain
    expect(out).not.toMatch(/[<>&]/)
  })

  it('round-trips: the escaped output is still valid JSON for the same value', () => {
    const graph = { a: 'hello </script> & <b>', n: 1, arr: ['x<y'] }
    expect(JSON.parse(jsonLdToString(graph))).toEqual(graph)
  })

  it('neutralizes a malicious editor field inside a real decision graph', () => {
    const ld = decisionJsonLd({
      slug: 'evil',
      court: 'cour-de-cassation',
      decision_date: '2024-01-01',
      summary_fr: 'oops</script><img src=x onerror=alert(document.cookie)>',
    })
    const out = jsonLdToString(ld)
    expect(out).not.toContain('</script>')
    expect(out).not.toMatch(/<img/i)
  })
})
