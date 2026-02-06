# AGENTS.md

Epstein Search — Next.js 16 app that searches, summarizes, and deep-analyzes 2,000+ DOJ Epstein case documents via chat UI.

## Stack

| Layer            | Tech                                                |
| ---------------- | --------------------------------------------------- |
| Framework        | Next.js 16.1 (App Router), React 19, TypeScript 5   |
| Styling          | Tailwind CSS 4, shadcn/ui (new-york style)          |
| State            | Zustand (persisted to localStorage)                 |
| i18n             | next-intl — 6 locales: en, nl, fr, de, es, pt       |
| Validation       | Zod 4                                               |
| AI               | Groq SDK → Llama 3.3 70B (streaming SSE)            |
| Cache/Rate-limit | Upstash Redis                                       |
| Worker           | Express + Playwright + pdf-parse (Docker on Render) |
| Testing          | Vitest 4, v8 coverage                               |
| Deploy           | Vercel (app) + Render (worker)                      |

## Environment

- **OS**: Windows — terminal is PowerShell. Do NOT use bash syntax (`&&`, `export`, `#!/bin/bash`, etc.). Use `;` to chain commands, `$env:VAR` for env vars.

## Commands

```
npm run dev          # local dev
npm run build        # production build
npm run lint         # eslint (flat config)
npm test             # vitest watch
npm run test:run     # vitest single-run (CI)
```

## Architecture (compressed)

```
src/app/api/search/     → GET → Zod validate → rate-limit → cache check → DOJ API proxy → dedupe → cache set → respond
src/app/api/summarize/  → POST → Groq streaming SSE → locale-aware prompts
src/app/api/deep-analyze/ → POST → rate-limit → validate → HMAC-sign → Render worker proxy → Groq deep summary → SSE
worker/src/index.ts     → Express, HMAC auth, Playwright PDF fetch + pdf-parse, /analyze + /health
```

## Critical Conventions

- **Path alias**: `@/*` → `./src/*`
- **API routes**: use `export const runtime = "nodejs"` (required for Upstash)
- **Locale type**: `SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt"` — used across all API routes and prompts
- **Localized error messages**: every API route has its own `ERROR_MESSAGES` record keyed by `SupportedLocale`
- **Localized AI prompts**: `SUMMARY_PROMPTS` in `src/lib/groq.ts` — one per locale
- **Client components**: must have `"use client"` directive
- **Security**: HMAC-SHA256 worker auth via `WORKER_SHARED_SECRET`, timing-safe compare, HTTPS-only, justice.gov domain whitelist
- **Validation**: all external input through Zod schemas in `src/lib/validation.ts` — searchSchema, analyzeSchema, deepAnalyzeSchema
- **Lazy init**: Redis and Groq clients use lazy initialization to avoid build-time env errors
- **SSE streaming**: `data: {json}\n\n` format, terminated by `data: [DONE]\n\n`
- **Cache**: 24h TTL on search results, graceful degradation when Redis unavailable
- **Rate limits**: search 10/10s, analyze 3/60s per IP — graceful pass-through if Redis missing

## Environment Variables

```
GROQ_API_KEY            # required — Groq console
UPSTASH_REDIS_REST_URL  # required — Upstash/Vercel KV
UPSTASH_REDIS_REST_TOKEN # required
WORKER_SHARED_SECRET    # required — shared between Vercel + Render
RENDER_WORKER_URL       # required for deep-analyze
NEXT_PUBLIC_BASE_URL    # optional — canonical URL
NEON_DATABASE_URL        # required — Neon Postgres for consent logs
CRON_SECRET              # required — shared secret for cleanup endpoint
NEXT_PUBLIC_CONSENT_POLICY_VERSION # required — semver for consent policy
```

## Detailed Docs (progressive disclosure)

| Topic              | File                                     |
| ------------------ | ---------------------------------------- |
| i18n patterns      | [docs/i18n.md](docs/i18n.md)             |
| API route patterns | [docs/api-routes.md](docs/api-routes.md) |
| Security model     | [docs/security.md](docs/security.md)     |
| Testing patterns   | [docs/testing.md](docs/testing.md)       |
| Worker service     | [docs/worker.md](docs/worker.md)         |
| Deployment         | [docs/deployment.md](docs/deployment.md) |
| UI components      | [docs/components.md](docs/components.md) |
