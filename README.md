# LexHaïti — Frontend

> Open frontend for [lexhaiti.org](https://lexhaiti.org) — the public digital corpus of Haitian law.

This repository contains the public Next.js frontend for the LexHaïti project.

LexHaïti is an open-access bilingual legal information platform dedicated to improving public access to Haitian law.

This repository is licensed under Apache 2.0 so that anyone can:

* Audit the public-facing legal information platform
* Review the bilingual French / Haitian Creole interface logic
* Reuse and adapt the frontend architecture for other legal-information initiatives
* Contribute improvements through pull requests

The project aims to support transparency, legal accessibility, and open digital public infrastructure.

## Stack

- **Next.js 16** (App Router, React Server Components)
- **TypeScript** (strict)
- **Tailwind CSS 4** + shadcn/ui primitives
- **NextAuth.js v5** (Auth.js) for editor sign-in
- **openapi-typescript** for typed API access against the backend

## Local development

```bash
# 1. Install
pnpm install

# 2. Configure env
cp .env.local.example .env.local
# Edit DATABASE_URL, AUTH_SECRET, etc. — see comments in the file.

# 3. Run
pnpm dev
```

The frontend expects a backend at `NEXT_PUBLIC_API_URL` (default `/api/v1`,
proxied via `next.config.ts` rewrites to `http://localhost:8000` in dev).
Without the backend, the home page + static pages render; everything that
fetches corpus data shows empty states.

## Structure

- `src/app/` — App Router routes (`/lois`, `/loi/{slug}`, `/recherche`, `/editorial/*`, etc.)
- `src/components/` — UI components, grouped by domain (`home/`, `law-details/`, `shared/`, …)
- `src/i18n/` — French + Kreyòl translation tables
- `src/lib/api/` — typed API client + endpoint helpers
- `src/lib/api-types.ts` — generated from the backend's OpenAPI spec via `pnpm api:types`
- `public/` — static assets (logos, hero composites, favicon)

## Licensing

- **Code** — [Apache License 2.0](LICENSE). Free for any use, commercial or
  otherwise, with attribution. Fork, modify, redeploy — go.
- **The "LexHaïti" name + brand** — trademark of the project. Apache 2.0
  does not grant rights to use the project name or logo. Ask before using
  either to describe a fork.
- **The Haitian legal corpus data** served at lexhaiti.org is governed by
  separate terms — see the data agreement on lexhaiti.org. Primary legal
  sources are in the public domain under Haitian law; editorial
  enrichments (structural metadata, citations, summaries) are HDDI's work
  product.

## Contributing

Issues + pull requests welcome. The backend repo is private, so PRs that
require API changes need to be coordinated with the maintainers first
(open an issue describing what you need).

## Backend

Public OpenAPI: `https://api.lexhaiti.org/openapi.json` (auto-generated
from the backend's FastAPI routes). Regenerate the local TypeScript types
against the live API with:

```bash
pnpm api:types
```
