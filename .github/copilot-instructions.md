# Copilot Instructions — Epstein Search

## Project Identity

Epstein Search is a Next.js 16 App Router application that searches, summarizes, and deep-analyzes 2,000+ DOJ Epstein case documents via a chat UI. It deploys to Vercel (app) and Render (worker).

## Stack (authoritative — do NOT research)

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

## OS Environment — Windows PowerShell

- Terminal is **PowerShell**. Do NOT use bash syntax (`&&`, `export`, `#!/bin/bash`).
- Chain commands with `;` — example: `npm run lint ; npm run typecheck`
- Environment variables: `$env:VAR = "value"` (NOT `export VAR=value`)

## Test-Driven Development (Stratified)

Every code change follows TDD. The strategy depends on the module type:

### `src/lib/` — Pure Logic

1. Write a failing unit test in `tests/lib/<module>.test.ts`
2. Run `npm run test:run` — confirm it fails
3. Implement the minimum code in `src/lib/<module>.ts` to pass
4. Refactor; re-run tests

### `src/components/` — React Components

1. Write a failing component test in `tests/components/<Component>.test.tsx`
2. Use `@testing-library/react` + `next-intl` test wrapper (`tests/utils/renderWithIntl.tsx`)
3. Run `npm run test:run` — confirm it fails
4. Implement the component with `"use client"` directive
5. Refactor; re-run tests

### `src/app/api/` — API Routes

1. Write a failing unit test in `tests/lib/` for any new business logic
2. Write an integration test for the route handler if needed
3. For user-facing flows, add an E2E test in `tests/e2e/<flow>.spec.ts`
4. Run `npm run test:run` then `npm run test:e2e`
5. Implement the route following the established pattern (see API Route Pattern below)

### `worker/` — Express Worker

1. Write a failing unit test in `tests/worker/<module>.test.ts`
2. Run `npm run test:run` — confirm it fails
3. Implement in `worker/src/`
4. Refactor; re-run tests

### `worker/` — Dependency Sync Rule

- `worker/` has its own `package.json` and `package-lock.json`.
- If you change `worker/package.json`, you MUST run `cd worker ; npm install` and commit the updated `worker/package-lock.json`.
- Docker builds use `npm ci`, which fails when the lock file is out of sync.

### Test File Naming

- Unit and component tests: `*.test.ts` / `*.test.tsx`
- E2E tests: `*.spec.ts`
- Tests live in `tests/`, mirroring `src/` structure (NOT `__tests__/`)

## Mandatory Verification & Commit (before every push)

Run these in order. All must pass:

```powershell
npm run lint          # ESLint flat config (9.x)
npm run typecheck     # tsc --noEmit (strict mode)
npm run test:run      # Vitest single-run
npm run test:e2e      # Playwright E2E (only if touching UI flows)
npm run test:coverage # Vitest + v8 (lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%)
```

Then commit and push:

```powershell
git add -A
git commit -m "<type>: <description>"   # feat: | fix: | test: | refactor: | docs: | chore:
git push origin HEAD
```

> **Branch check**: ensure you are on a feature/fix branch, not `main`. Create one with `git checkout -b <type>/<short-description>` if needed.

## Security Guidelines (attack-surface specific)

### HMAC Worker Auth

- Worker requests signed with HMAC-SHA256 via `WORKER_SHARED_SECRET`
- Signature sent in `X-Worker-Signature` header (or `Authorization: Bearer <sig>`)
- Always use `verifyTimingSafe()` from `src/lib/security.ts` — NEVER `===`
- NEVER log secrets or signatures

### SSE Injection Prevention

- All SSE chunks must be `JSON.stringify()`'d — NEVER interpolate user input directly
- Format: `data: ${JSON.stringify({ text })}\n\n`
- Always terminate streams with `data: [DONE]\n\n`
- Errors within streams: send as SSE error chunk, then close

### SSRF via DOJ Proxy

- All user-provided URLs validated against justice.gov domain whitelist
- Enforce HTTPS protocol (`url.protocol === "https:"`)
- Block localhost, IPs, internal hostnames via `isAllowedJusticeGovHost()`
- Zod schema (`analyzeSchema`) enforces URL format + domain at validation layer

### Markdown XSS

- User content rendered via `react-markdown` with `remarkGfm`
- `dangerouslySetInnerHTML` used ONLY for DOJ search highlights (pre-sanitized server-side)
- NEVER pass raw user input to `dangerouslySetInnerHTML`

### General

- All external input through Zod schemas (`src/lib/validation.ts`)
- `sanitizeError()` strips error details in production
- No `eval()`, no `new Function()`, no dynamic `require()`
- `eslint-plugin-security` enforces: no unsafe regex, no object injection, no buffer constructor

## Localization Rules

- **Type**: `SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt"`
- **ERROR_MESSAGES**: every API route defines `ERROR_MESSAGES: Record<SupportedLocale, { ... }>` with all 6 locales
- **AI prompts**: `SUMMARY_PROMPTS` and `DEEP_ANALYSIS_PROMPTS` in `src/lib/groq.ts` — one entry per locale
- **normalizeLocale()**: standardizes locale input → `SupportedLocale` (falls back to `"en"`)
- **Client i18n**: use `useTranslations()` from `next-intl`; message files in `messages/<locale>.json`
- **New features**: MUST add translations to all 6 locale JSON files

## API Route Pattern (follow exactly)

```typescript
export const runtime = "nodejs"; // Required for Upstash
type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";
function normalizeLocale(locale?: string): SupportedLocale {
  /* ... */
}
const ERROR_MESSAGES: Record<
  SupportedLocale,
  {
    /* route-specific keys */
  }
> = {
  /* all 6 */
};

export async function POST(request: Request) {
  // 1. Rate-limit (graceful — pass through if Redis unavailable)
  // 2. Parse + Zod validate input
  // 3. Normalize locale
  // 4. Business logic (cache check → compute → cache set)
  // 5. Return Response (or SSE ReadableStream)
  // 6. Catch → sanitizeError() → localized error response
}
```

## Code Conventions

- **Path alias**: `@/*` → `./src/*` — always use `@/` imports
- **No `any`**: ESLint enforces `@typescript-eslint/no-explicit-any: "error"`
- **Client components**: must have `"use client"` as first line
- **Lazy init**: Redis, Groq, Postgres clients use lazy initialization to avoid build-time env errors
- **Graceful degradation**: cache and rate-limit operations NEVER throw — return null/pass-through
- **SSE format**: `data: {json}\n\n`, terminated by `data: [DONE]\n\n`
- **Conventional commits**: enforced by commitlint + husky (e.g., `feat:`, `fix:`, `test:`, `docs:`)

## Generated Files

- **NEVER** create supporting markdown files (plans, logs, setup guides, fix notes) in the repository
- If scratch documentation is needed during a task, create it under `temp/` (gitignored)
- Claude Code CLI may create `tmpclaude*` marker files in the repo root; delete them if found (gitignored)
- Only update existing docs in `docs/` when the documented behavior actually changes
- Essential docs structure: `README.md`, `AGENTS.md` files, `docs/*.md`, `.github/*.md`

## Key Files Reference

| Purpose               | File                             |
| --------------------- | -------------------------------- |
| Shared types          | `src/lib/types.ts`               |
| Zod schemas           | `src/lib/validation.ts`          |
| Security utilities    | `src/lib/security.ts`            |
| Groq client + prompts | `src/lib/groq.ts`                |
| Redis cache           | `src/lib/cache.ts`               |
| Rate limiters         | `src/lib/ratelimit.ts`           |
| DOJ API proxy         | `src/lib/doj-api.ts`             |
| Neon DB pool          | `src/lib/db.ts`                  |
| i18n routing          | `src/i18n/routing.ts`            |
| Test setup            | `tests/setup.ts`                 |
| Test helper           | `tests/utils/renderWithIntl.tsx` |
