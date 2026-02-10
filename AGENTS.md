# AGENTS.md

Epstein Search — Next.js 16 app that searches, summarizes, and deep-analyzes 2,000+ DOJ Epstein case documents via chat UI.

## Stack

| Layer            | Tech                                                     |
| ---------------- | -------------------------------------------------------- |
| Framework        | Next.js 16.1 (App Router), React 19, TypeScript 5        |
| Styling          | Tailwind CSS 4, shadcn/ui (new-york style)               |
| State            | Zustand (persisted to localStorage)                      |
| i18n             | next-intl — 6 locales: en, nl, fr, de, es, pt            |
| Validation       | Zod 4                                                    |
| AI               | Groq SDK → Llama 3.3 70B (streaming SSE)                 |
| Cache/Rate-limit | Upstash Redis                                            |
| Worker           | Express 5 + Playwright + pdf-parse (Docker on Render)    |
| Testing          | Vitest 4 (unit) + Playwright (E2E), v8 coverage          |
| CI/CD            | GitHub Actions (lint, typecheck, test, CodeQL, Gitleaks) |
| Deploy           | Vercel (app) + Render (worker)                           |
| DB               | Neon Postgres (consent logs)                             |

## Environment

- **OS**: Windows — terminal is PowerShell. Do NOT use bash syntax (`&&`, `export`, `#!/bin/bash`).
- Use `;` to chain commands, `$env:VAR` for env vars.

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
```

## Git Workflow

Follow this lifecycle for every task (feature, fix, refactor, test, docs, chore).

### 1) Start a new branch (never work on `main`)

```powershell
git checkout -b <type>/<short-description>   # e.g., feat/consent-export, fix/sse-encoding
```

### 2) Mandatory verification (before every commit)

Run all of these in order. All must pass:

```powershell
npm run lint          # ESLint flat config (9.x)
npm run typecheck     # tsc --noEmit (strict mode)
npm run test:run      # Vitest single-run
npm run test:e2e      # Playwright E2E (only if touching UI flows)
npm run test:coverage # Vitest + v8 (lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%)
```

Optional shortcut:

```powershell
npm run preflight
```

### 3) Commit (conventional commits)

Use **conventional commits** (enforced by commitlint + husky):

| Prefix      | When to use                                   |
| ----------- | --------------------------------------------- |
| `feat:`     | New feature or capability                     |
| `fix:`      | Bug fix (always with regression test)         |
| `test:`     | Test-only changes (new tests, test utilities) |
| `refactor:` | Code restructuring, no behavior change        |
| `docs:`     | Documentation updates                         |
| `chore:`    | Build, CI, dependency, config changes         |

**Default**: one commit per completed task. **Optional**: separate commits per logical step (test → implementation → refactor) for large changes.

### 4) Push

```powershell
git push origin HEAD
```

### 5) Create a pull request

- Use GitHub UI or `gh pr create --fill`
- Follow `.github/PULL_REQUEST_TEMPLATE.md`
- Merge strategy: **squash and merge** (self-merge allowed after CI passes)

### 6) Cleanup (after PR is merged)

```powershell
git checkout main
git pull origin main
git branch -d <branch-name>
```

## Architecture (compressed)

```
src/app/api/search/     → GET/POST → Zod validate → rate-limit → cache check → DOJ API proxy (fallback: worker) → dedupe → cache set → respond
src/app/api/summarize/  → POST → Groq streaming SSE → locale-aware prompts
src/app/api/deep-analyze/ → POST → rate-limit → validate → HMAC-sign → Render worker proxy → Groq deep summary → SSE
src/app/api/consent/    → POST → rate-limit → validate → Neon Postgres INSERT (locale-specific table)
worker/src/index.ts     → Express 5, HMAC auth, Playwright PDF fetch + pdf-parse, /search + /analyze + /health
```

## Test-Driven Development (stratified by module type)

| Module             | TDD Flow                                           | Test Location                                 |
| ------------------ | -------------------------------------------------- | --------------------------------------------- |
| `src/lib/*`        | Unit test first → implement → refactor             | `tests/lib/*.test.ts`                         |
| `src/components/*` | Component test first (Testing Library) → implement | `tests/components/*.test.tsx`                 |
| `src/app/api/*`    | Unit test (logic) + E2E (user flows) → implement   | `tests/lib/*.test.ts` + `tests/e2e/*.spec.ts` |
| `worker/*`         | Unit test first → implement                        | `tests/worker/*.test.ts`                      |

**Rule**: every new function, component, or route gets a test BEFORE implementation.

## Coverage Thresholds (enforced by CI)

| Metric     | Minimum |
| ---------- | ------- |
| Lines      | 80%     |
| Statements | 80%     |
| Functions  | 75%     |
| Branches   | 60%     |

## Security Checklist (verify on every PR)

- [ ] All external input validated through Zod schemas (`src/lib/validation.ts`)
- [ ] Worker requests use HMAC-SHA256 + `verifyTimingSafe()` — never `===`
- [ ] User-provided URLs checked against justice.gov whitelist + HTTPS enforcement
- [ ] SSE chunks JSON-stringified — no direct user input interpolation
- [ ] No `eval()`, `new Function()`, dynamic `require()`
- [ ] `sanitizeError()` used in all production error responses
- [ ] No secrets in logs, no `any` types, no disabled ESLint rules

## Critical Conventions

- **Path alias**: `@/*` → `./src/*`
- **API routes**: `export const runtime = "nodejs"` (required for Upstash)
- **Locale type**: `SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt"`
- **Localized errors**: every API route has `ERROR_MESSAGES: Record<SupportedLocale, {...}>`
- **Localized AI prompts**: `SUMMARY_PROMPTS` / `DEEP_ANALYSIS_PROMPTS` in `src/lib/groq.ts`
- **Client components**: must have `"use client"` directive
- **Lazy init**: Redis, Groq, Postgres clients — avoids build-time env errors
- **SSE streaming**: `data: {json}\n\n` format, terminated by `data: [DONE]\n\n`
- **Cache**: 24h TTL, graceful degradation (never throws)
- **Rate limits**: search 10/10s, analyze 3/60s, consent 20/60s — pass-through if Redis missing
- **Commits**: conventional commits enforced by commitlint + husky — see **Git Workflow** section above

## Generated Files

- NEVER create supporting markdown files (plans, logs, setup guides, fix notes) in the repository
- If scratch documentation is needed during a task, create it under `temp/` (gitignored)
- Claude Code CLI may create `tmpclaude*` marker files in the repo root; delete them if found (gitignored)
- Only update existing docs in `docs/` when the documented behavior actually changes
- Essential docs structure: `README.md`, `AGENTS.md` files, `docs/*.md`, `.github/*.md`

## Worker Service Conventions

- Express 5 with Helmet, CORS, JSON body limit (2mb)
- HMAC signature verified via `X-Worker-Signature` or `Authorization: Bearer <sig>`
- SSRF protection: `isAllowedJusticeGovHost()` blocks non-justice.gov, localhost, IPs
- Playwright: launches headless Chromium, handles Akamai bot-detection cookies
- `/search`: visits DOJ homepage first → XHR from page context → 3 retries
- `/analyze`: navigates to PDF URL → handles age-verify → cookies → pdf-parse
- Rate limiters: `/search` 50/15min, `/analyze` 60/15min
- Worker dependencies are isolated: update `worker/package-lock.json` via `cd worker ; npm install` whenever `worker/package.json` changes (Docker `npm ci` requires parity)

## Environment Variables

```
GROQ_API_KEY            # required — Groq console
UPSTASH_REDIS_REST_URL  # required — Upstash/Vercel KV
UPSTASH_REDIS_REST_TOKEN # required
WORKER_SHARED_SECRET    # required — shared between Vercel + Render
RENDER_WORKER_URL       # required for deep-analyze + search fallback
NEXT_PUBLIC_BASE_URL    # optional — canonical URL
NEON_DATABASE_URL       # required — Neon Postgres for consent logs
CRON_SECRET             # required — shared secret for cleanup endpoint
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
