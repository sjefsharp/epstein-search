# AGENTS.md

Epstein Search — Next.js 16 app that searches, summarizes, and deep-analyzes 2,000+ DOJ Epstein case documents via chat UI.

## Stack

| Layer            | Tech                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| Framework        | Next.js 16.1 (App Router), React 19, TypeScript 5                           |
| Styling          | Tailwind CSS 4, shadcn/ui (new-york style)                                  |
| State            | Zustand (persisted to localStorage)                                         |
| i18n             | next-intl — 6 locales: en, nl, fr, de, es, pt                               |
| Validation       | Zod 4                                                                       |
| AI               | Groq SDK → Llama 3.3 70B (streaming SSE)                                    |
| Cache/Rate-limit | Upstash Redis                                                               |
| Worker           | Express 5 + Playwright + pdf-parse (Docker on Render)                       |
| Testing          | Vitest 4 (unit) + Playwright (E2E), v8 coverage                             |
| CI/CD            | GitHub Actions (lint, typecheck, test, CodeQL, Gitleaks, dependency-review) |
| Deploy           | Vercel (app) + Render (worker)                                              |
| DB               | Neon Postgres (consent logs)                                                |

## Environment

- **OS**: Linux — Bash terminal. Chain with `&&`, env vars via `export VAR=value`.

## Commands

```
npm run dev            # local dev
npm run build          # production build
npm run lint           # eslint (flat config, 9.x)
npm run typecheck      # tsc --noEmit (strict)
npm test               # vitest watch
npm run test:run       # vitest single-run (CI)
npm run test:e2e       # playwright E2E
npm run test:coverage  # vitest + v8 coverage
npm run preflight      # lint + typecheck + test:run + test:coverage
```

## Git Workflow

Full lifecycle: `.github/instructions/workflow.instructions.md` (authoritative source).

Key rules:

- **Never on `main`** — always a feature/fix/refactor branch
- **Dirty workspace → worktree** — never `git checkout` away from uncommitted work
- **Verify branch before every commit** — `git rev-parse --abbrev-ref HEAD`
- **Conventional commits** — `feat` | `fix` | `test` | `refactor` | `docs` | `chore` (commitlint + husky)
- **Squash and merge** — human reviews PRs

## Chrome Dev Tools (extra guardrail)

When a browser is available (local dev or remote debugging), use Chrome Dev Tools **alongside** automated tests:

- **Console** — runtime errors, unhandled rejections, deprecation warnings
- **Network** — API status codes, payloads, CORS issues
- **Elements** — DOM/layout inspection
- **Lighthouse / Accessibility** — quick a11y audit

For remote debugging: capture Dev Tools output → analyze → report in commit/PR.

> Advisory — automated tests remain the hard gate.

## Architecture (compressed)

```
src/app/api/search/       → GET/POST → Zod → rate-limit → cache → DOJ API (fallback: worker) → dedupe → cache set → respond
src/app/api/summarize/    → POST → Groq SSE → locale-aware prompts
src/app/api/deep-analyze/ → POST → rate-limit → validate → HMAC-sign → worker proxy → Groq deep summary → SSE
src/app/api/consent/      → POST → rate-limit → validate → Neon INSERT
worker/src/index.ts       → Express 5, HMAC auth, Playwright PDF fetch + pdf-parse
```

## TDD (stratified by module type)

| Module             | Test first in                 | Runner                  | Notes                        |
| ------------------ | ----------------------------- | ----------------------- | ---------------------------- |
| `src/lib/*`        | `tests/lib/*.test.ts`         | `test:run`              | Unit → implement → refactor  |
| `src/components/*` | `tests/components/*.test.tsx` | `test:run`              | Use `renderWithIntl` wrapper |
| `src/app/api/*`    | `tests/lib/` + `tests/e2e/`   | `test:run` + `test:e2e` | Logic unit + E2E             |
| `worker/*`         | `tests/worker/*.test.ts`      | `test:run`              | Unit → implement → refactor  |

**Rule**: every new function, component, or route gets a test BEFORE implementation.

## Coverage (CI-enforced)

Lines ≥80% · Statements ≥80% · Functions ≥75% · Branches ≥60%

## Security

Canonical checklist: `.github/instructions/security-review.instructions.md`

Key rules: Zod validate all input → HMAC `verifyTimingSafe()` (never `===`) → justice.gov URL whitelist + HTTPS → `JSON.stringify()` SSE chunks → `sanitizeError()` in prod → no `eval()`/`new Function()`/`any`

## Conventions

- **Path alias**: `@/*` → `./src/*`
- **API routes**: `export const runtime = "nodejs"` — pattern in `api-route.instructions.md`
- **Locale**: `SupportedLocale = "en"|"nl"|"fr"|"de"|"es"|"pt"` — `normalizeLocale()` + `ERROR_MESSAGES` (×6)
- **Prompts**: `SUMMARY_PROMPTS` / `DEEP_ANALYSIS_PROMPTS` in `src/lib/groq.ts` — one per locale
- **Components**: `"use client"` on line 1 — `useTranslations()` for all strings — all 6 locale JSONs
- **Lazy init**: Redis, Groq, Postgres clients — avoids build-time env errors
- **Graceful degradation**: cache/rate-limit never throw — return null/pass-through
- **SSE**: `data: {json}\n\n` terminated by `data: [DONE]\n\n`
- **Rate limits**: search 10/10s, analyze 3/60s, consent 20/60s — pass-through if Redis missing
- **Commits**: conventional — enforced by commitlint + husky

## Dependency Sync

| Scope  | When                          | Command                                                        |
| ------ | ----------------------------- | -------------------------------------------------------------- |
| Root   | `package.json` changes        | `npm install` → commit `package-lock.json`                     |
| Worker | `worker/package.json` changes | `cd worker && npm install` → commit `worker/package-lock.json` |

Docker/CI uses `npm ci` — lockfile drift = build failure.

## Worker Service

- Express 5 + Helmet + CORS + JSON body limit (2mb)
- HMAC auth: `X-Worker-Signature` or `Authorization: Bearer <sig>` → `crypto.timingSafeEqual()`
- SSRF: `isAllowedJusticeGovHost()` blocks non-justice.gov, localhost, IPs
- `/search`: Chromium → justice.gov (Akamai cookies, 2s wait) → XHR from page context → 3 retries (1.5s × n)
- `/analyze`: Chromium → PDF URL → age-verify → cookies → `pdf-parse` → text + metadata
- Rate limits: `/search` 50/15min, `/analyze` 60/15min

## Agent Operating Style

- Proceed without confirmation unless blocked by missing permissions or critical ambiguity
- Provide clear checklists — note prerequisites, identify required tests
- Human-in-the-loop: user reviews PRs — no unnecessary status questions
- Act autonomously through the workflow defined in `workflow.instructions.md`

## Generated Files

- NEVER create supporting .md files (plans, logs, setup guides) in the repository
- Scratch docs → `temp/` (gitignored). Delete `tmpclaude*` files if found.
- Only update existing `docs/` when documented behavior actually changes

## Environment Variables

```
GROQ_API_KEY             # required — Groq console
UPSTASH_REDIS_REST_URL   # required — Upstash Redis
UPSTASH_REDIS_REST_TOKEN # required
WORKER_SHARED_SECRET     # required — shared between Vercel + Render
RENDER_WORKER_URL        # required for deep-analyze + search fallback
NEXT_PUBLIC_BASE_URL     # optional — canonical URL
NEON_DATABASE_URL        # required — Neon Postgres for consent logs
CRON_SECRET              # required — shared secret for cleanup endpoint
NEXT_PUBLIC_CONSENT_POLICY_VERSION # required — semver for consent policy
```

## Docs (progressive disclosure)

| Topic           | File                                               |
| --------------- | -------------------------------------------------- |
| i18n            | [docs/i18n.md](docs/i18n.md)                       |
| API routes      | [docs/api-routes.md](docs/api-routes.md)           |
| Security        | [docs/security.md](docs/security.md)               |
| Testing         | [docs/testing.md](docs/testing.md)                 |
| Worker          | [docs/worker.md](docs/worker.md)                   |
| Deployment      | [docs/deployment.md](docs/deployment.md)           |
| Components      | [docs/components.md](docs/components.md)           |
| Consent logging | [docs/consent-logging.md](docs/consent-logging.md) |

## Key Files

| Purpose        | File                             |
| -------------- | -------------------------------- |
| Shared types   | `src/lib/types.ts`               |
| Zod schemas    | `src/lib/validation.ts`          |
| Security utils | `src/lib/security.ts`            |
| Groq client    | `src/lib/groq.ts`                |
| Redis cache    | `src/lib/cache.ts`               |
| Rate limiters  | `src/lib/ratelimit.ts`           |
| DOJ API proxy  | `src/lib/doj-api.ts`             |
| Neon DB pool   | `src/lib/db.ts`                  |
| i18n routing   | `src/i18n/routing.ts`            |
| Test setup     | `tests/setup.ts`                 |
| Test helper    | `tests/utils/renderWithIntl.tsx` |
