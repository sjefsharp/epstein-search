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

## OS Environment — Linux (Bash)

- Terminal is **Bash**. Use `&&` to chain commands: `npm run lint && npm run typecheck`
- Environment variables: `export VAR="value"` (NOT `$env:VAR`)

## Test-Driven Development (Stratified)

Every code change follows TDD. Strategy depends on module type:

| Module             | Test first in                 | Runner                  | Notes                                            |
| ------------------ | ----------------------------- | ----------------------- | ------------------------------------------------ |
| `src/lib/*`        | `tests/lib/*.test.ts`         | `test:run`              | Unit → implement → refactor                      |
| `src/components/*` | `tests/components/*.test.tsx` | `test:run`              | Use `renderWithIntl` wrapper from `tests/utils/` |
| `src/app/api/*`    | `tests/lib/` + `tests/e2e/`   | `test:run` + `test:e2e` | Logic unit + E2E integration                     |
| `worker/*`         | `tests/worker/*.test.ts`      | `test:run`              | Unit → implement → refactor                      |

### Worker Dependency Sync

- `worker/` has its own `package.json` and `package-lock.json`.
- If you change `worker/package.json`, run `cd worker && npm install` and commit `worker/package-lock.json`.
- If you change root `package.json`, run `npm install` and commit `package-lock.json`.
- Docker/CI uses `npm ci` — lockfile drift = build failure.

### Test File Naming

- Unit/component: `*.test.ts` / `*.test.tsx` — E2E: `*.spec.ts`
- Tests live in `tests/`, mirroring `src/` structure (NOT `__tests__/`)

## Git Workflow (MANDATORY — every task)

> Full details and recovery procedures: `.github/instructions/workflow.instructions.md`

**⛔ Every task MUST follow all four phases. Skipping any phase is a violation.**

| Phase       | Command                                    | When                                    |
| ----------- | ------------------------------------------ | --------------------------------------- |
| **START**   | `bash scripts/start-task.sh <type> <desc>` | **BEFORE any file edit or code change** |
| **WORK**    | Implement → Verify → Commit (see below)    | During implementation                   |
| **FINISH**  | `bash scripts/finish-task.sh`              | **AFTER all verification passes**       |
| **CLEANUP** | `bash scripts/cleanup-task.sh [branch]`    | **AFTER the PR is merged**              |

### Agent Rules (non-negotiable)

1. You MUST run `start-task.sh` BEFORE making ANY file changes. It creates the branch (or worktree if dirty).
2. You MUST run `finish-task.sh` AFTER verification. It pushes and creates a PR.
3. You MUST run `cleanup-task.sh` AFTER the PR is merged. It deletes the branch and returns to main.
4. You MUST NEVER work directly on `main`.
5. You MUST NEVER end a task without pushing and creating a PR.
6. If workspace is dirty (another session has uncommitted changes), `start-task.sh` creates a worktree automatically.

### WORK phase steps

1. **Verify branch**: `git rev-parse --abbrev-ref HEAD`
2. **Implement**: TDD per module type (see `AGENTS.md § TDD`)
3. **Doc sync**: update `docs/` if behavior changes
4. **Verify**: `npm run lint && npm run typecheck && npm run test:run` (+ `test:e2e` if UI, + `test:coverage`). Shortcut: `npm run preflight`
5. **Chrome Dev Tools** (advisory, when browser available): Console, Network, Elements, Lighthouse
6. **Commit**: `git add -A && git commit -m "<type>: <description>"` — verify branch before and after

## Security Guidelines

Canonical checklist: `.github/instructions/security-review.instructions.md`

- **HMAC Worker Auth**: HMAC-SHA256 via `WORKER_SHARED_SECRET` → `verifyTimingSafe()` — NEVER `===`, NEVER log secrets
- **SSE Injection**: `JSON.stringify()` all SSE chunks — never interpolate user input. Format: `data: ${JSON.stringify({ text })}\n\n`, terminate with `data: [DONE]\n\n`
- **SSRF**: justice.gov whitelist + HTTPS via `isAllowedJusticeGovHost()` — blocks localhost, IPs, non-justice.gov
- **Markdown XSS**: `dangerouslySetInnerHTML` ONLY for pre-sanitized DOJ highlights
- **General**: Zod schemas for all input → `sanitizeError()` in prod → no `eval()`/`new Function()`/`any`

## Localization Rules

- **Type**: `SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt"`
- **API**: `normalizeLocale()` + `ERROR_MESSAGES: Record<SupportedLocale, {...}>` (all 6)
- **Prompts**: `SUMMARY_PROMPTS` / `DEEP_ANALYSIS_PROMPTS` in `src/lib/groq.ts` — one per locale
- **Client**: `useTranslations()` from `next-intl` — message files in `messages/<locale>.json`
- **New features**: MUST add translations to all 6 locale JSON files

## API Route Pattern

Canonical pattern: `.github/instructions/api-route.instructions.md`

Every route: `export const runtime = "nodejs"` → `SupportedLocale` + `normalizeLocale()` + `ERROR_MESSAGES` (×6) → Zod validate → rate-limit → business logic → Response or SSE stream → catch with `sanitizeError()`

## Code Conventions

- **Path alias**: `@/*` → `./src/*` — always use `@/` imports
- **No `any`**: `@typescript-eslint/no-explicit-any: "error"`
- **Client components**: `"use client"` as first line
- **Lazy init**: Redis, Groq, Postgres — avoids build-time env errors
- **Graceful degradation**: cache/rate-limit never throw — null/pass-through
- **SSE**: `data: {json}\n\n`, terminated by `data: [DONE]\n\n`
- **Conventional commits**: enforced by commitlint + husky

## Agent Operating Style

- Proceed without confirmation unless blocked by missing permissions or critical ambiguity
- Provide clear checklists — note prerequisites, identify required tests
- Human-in-the-loop: user reviews PRs — no unnecessary status questions
- Act autonomously through the workflow in `workflow.instructions.md`

## Generated Files

- **NEVER** create supporting .md files (plans, logs, setup guides) in the repository
- Scratch docs → `temp/` (gitignored). Delete `tmpclaude*` if found.
- Only update existing `docs/` when documented behavior actually changes

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
