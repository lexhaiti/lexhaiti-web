/**
 * Runtime environment validation.
 *
 * Import this module early (e.g. in `instrumentation.ts` or the root layout)
 * so missing variables surface at startup, not mid-request.
 */

/* ---------- helpers ---------- */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        'Check your .env / .env.local file.',
    )
  }
  return v
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

/* ---------- server-only vars (never leaked to the browser) ---------- */

export const env = {
  /** Postgres connection string for Auth.js adapter */
  DATABASE_URL: required('DATABASE_URL'),

  /** Canonical URL used by Auth.js for cookie domain */
  NEXTAUTH_URL: required('NEXTAUTH_URL'),

  /** Internal backend URL (server → API, bypasses public DNS) */
  API_INTERNAL_URL: optional(
    'LEXHAITI_API_INTERNAL_URL',
    'http://localhost:8000',
  ),

  /** SMTP config (optional in dev — Mailpit catches all mail) */
  SMTP_HOST: optional('SMTP_HOST', 'localhost'),
  SMTP_PORT: Number(optional('SMTP_PORT', '1025')),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: optional('EMAIL_FROM', 'no-reply@lexhaiti.local'),

  /** Runtime environment */
  NODE_ENV: optional('NODE_ENV', 'development'),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
} as const

/* ---------- public vars (NEXT_PUBLIC_* — safe to ship to browser) ---------- */

export const publicEnv = {
  /** Browser-facing API base (used by client-side fetches) */
  API_URL: optional('NEXT_PUBLIC_API_URL', 'http://localhost:8000'),
  API_BASE: optional('NEXT_PUBLIC_API_BASE', '/api/v1'),

  /** Vercel detection */
  IS_VERCEL: process.env.VERCEL === '1',
} as const
