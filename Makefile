.PHONY: help install dev build start test test-watch lint lint-fix format \
        typecheck check api-types env-status use-prod use-local clean

# -----------------------------------------------------------------------
# LexHaïti — frontend (Next.js 16)
#
# This repo is the public-facing frontend. The backend (FastAPI +
# Postgres editorial pipeline) lives in a separate private repo at
# ``lexhaiti/lexhaiti-api`` and is reachable at
# ``http://localhost:8000`` in dev, ``https://api.lexhaiti.org`` in
# prod. ``pnpm api:types`` regenerates ``src/lib/api-types.ts`` from
# whichever backend is currently up on :8000.
# -----------------------------------------------------------------------

PNPM := pnpm

help:
	@echo "LexHaïti — frontend (Next.js 16)"
	@echo ""
	@echo "Setup + dev"
	@echo "  make install      pnpm install"
	@echo "  make dev          Run Next.js dev server on :3000 (hot reload)"
	@echo "  make build        Production build (Vercel runs this on deploy)"
	@echo "  make start        Serve the built app locally"
	@echo ""
	@echo "Quality gates"
	@echo "  make typecheck    tsc --noEmit"
	@echo "  make lint         eslint src"
	@echo "  make lint-fix     eslint --fix src"
	@echo "  make format       prettier --write src"
	@echo "  make test         vitest one-shot"
	@echo "  make test-watch   vitest watch mode"
	@echo "  make check        typecheck + lint + test  (pre-commit gate)"
	@echo ""
	@echo "API types"
	@echo "  make api-types    Regenerate src/lib/api-types.ts from the backend's"
	@echo "                    /openapi.json. Requires the backend running on :8000."
	@echo ""
	@echo "Env switcher (web/.env.local ↔ {local,prod})"
	@echo "  make use-prod     Activate prod backend env + restart next dev"
	@echo "  make use-local    Activate local Docker env + restart next dev"
	@echo "  make env-status   Show which DB the active .env.local points at"
	@echo ""
	@echo "Cleanup"
	@echo "  make clean        Remove .next + .turbo build caches"
	@echo ""
	@echo "First-time setup:  make install && make api-types && make dev"

# -----------------------------------------------------------------------
# Setup + dev server
# -----------------------------------------------------------------------
install:
	$(PNPM) install

dev:
	$(PNPM) dev

build:
	$(PNPM) build

start:
	$(PNPM) start

# -----------------------------------------------------------------------
# Quality gates — run individually or together via ``make check``.
# -----------------------------------------------------------------------
typecheck:
	$(PNPM) exec tsc --noEmit

lint:
	$(PNPM) exec eslint src

lint-fix:
	$(PNPM) exec eslint --fix src

format:
	$(PNPM) exec prettier --write src

test:
	$(PNPM) exec vitest run

test-watch:
	$(PNPM) exec vitest

# Composite gate — run before every commit. Matches what CI will
# enforce on the lexhaiti-web repo.
check: typecheck lint test
	@echo "✓ typecheck + lint + test all green"

# -----------------------------------------------------------------------
# API types — regenerated from the live backend's OpenAPI spec. The
# script lives in package.json scripts.api:types; this is just a
# discoverable alias. Requires the backend running locally on :8000
# OR ``NEXT_PUBLIC_API_URL`` pointing at a reachable spec.
# -----------------------------------------------------------------------
api-types:
	$(PNPM) api:types

# -----------------------------------------------------------------------
# Env switcher — flip the NextAuth pg-adapter DATABASE_URL (and
# NEXT_PUBLIC_API_URL, AUTH_URL, etc.) between local Docker and prod
# Azure. Two staged env files live in .env.local.{local,prod}; the
# active config is .env.local. After copying we kill the running
# next dev (if any) and relaunch it detached so the new env is
# picked up. pid recorded at .next-dev.pid for clean stop.
#
# This flips the FRONTEND ONLY. To flip the backend too (for
# full-stack work), use the matching targets in the lexhaiti-api
# repo's root Makefile.
# -----------------------------------------------------------------------
define _restart_next
	@echo "→ stopping any running next dev on :3000"
	@if lsof -ti :3000 >/dev/null 2>&1; then \
	  lsof -ti :3000 | xargs kill 2>/dev/null || true; \
	  sleep 1; \
	fi
	@echo "→ relaunching next dev detached (logs at /tmp/lh-frontend.log)"
	@nohup $(PNPM) dev > /tmp/lh-frontend.log 2>&1 & \
	    echo $$! > $(CURDIR)/.next-dev.pid
	@sleep 4
	@echo "→ frontend pid: $$(cat $(CURDIR)/.next-dev.pid 2>/dev/null)"
	@curl -fsS -o /dev/null -w "  health: HTTP %{http_code}\n" "http://127.0.0.1:3000/" 2>&1 || echo "  (frontend still starting — tail /tmp/lh-frontend.log)"
	@echo "→ ⚠ refresh your browser — the session cookie may need a re-signin against the new DB."
endef

use-prod:
	@if [ ! -f .env.local.prod ]; then \
	  echo "✗ .env.local.prod is missing — create it first."; exit 1; \
	fi
	@echo "════════════════════════════════════════════════════════════"
	@echo "  ⚠ Switching frontend to PROD env (Azure backend)."
	@echo "    NextAuth sessions will land in the PROD auth schema."
	@echo "════════════════════════════════════════════════════════════"
	@cp .env.local.prod .env.local
	$(_restart_next)
	@echo "→ active env: PROD"

use-local:
	@if [ ! -f .env.local.local ]; then \
	  echo "✗ .env.local.local is missing — create it first."; exit 1; \
	fi
	@echo "→ Switching frontend to LOCAL env (Docker backend)."
	@cp .env.local.local .env.local
	$(_restart_next)
	@echo "→ active env: LOCAL"

env-status:
	@if [ ! -f .env.local ]; then \
	  echo "  no .env.local file"; \
	  exit 0; \
	fi
	@URL="$$(grep -E '^DATABASE_URL' .env.local | head -1 | sed 's/^DATABASE_URL=//')"; \
	if echo "$$URL" | grep -q "azure.com"; then \
	  echo "  env: PROD  →  $$(echo "$$URL" | sed 's#//[^@]*@#//***@#')"; \
	elif echo "$$URL" | grep -q "localhost"; then \
	  echo "  env: LOCAL →  $$URL"; \
	else \
	  echo "  env: OTHER →  $$(echo "$$URL" | sed 's#//[^@]*@#//***@#')"; \
	fi
	@if [ -f .next-dev.pid ] && kill -0 $$(cat .next-dev.pid 2>/dev/null) 2>/dev/null; then \
	  echo "  pid: $$(cat .next-dev.pid) (running)"; \
	else \
	  echo "  pid: (not running via make)"; \
	fi

# -----------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------
clean:
	rm -rf .next .turbo
