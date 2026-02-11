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

## Git Workflow (before every push)

Follow this lifecycle for every task. Full details in `.github/instructions/workflow.instructions.md`.

### 0) Workspace check

```bash
git rev-parse --abbrev-ref HEAD   # know which branch you're on
git status                        # check for uncommitted changes
```

- **Clean**: `git checkout -b <type>/<desc>` from `main`
- **Clean, on another branch (unrelated to this task)**: `git checkout main && git checkout -b <type>/<desc>`
- **Dirty**: isolate via worktree — `git worktree add ../<repo>-<desc> -b <type>/<desc> main && cd ../<repo>-<desc>`

Never work directly on `main`.

> **⚠ IMPORTANT — Editor/Terminal Divergence**
>
> Terminal `cd` does NOT change the VS Code editor's workspace root.
> After `cd ../<repo>-<desc>`, file-edit tools and diagnostics still target the
> original directory. To avoid editing files on the wrong branch:
>
> 1. All `git` and `npm` commands MUST run in the worktree directory.
> 2. All file-edit tool paths MUST use the worktree's absolute path
>    (e.g., `/home/user/<repo>-<desc>/src/...`), not the original repo path.
> 3. Alternatively, open the worktree as a VS Code workspace folder so the
>    editor tracks the correct branch.

### Rules

- **NEVER** `git checkout` to switch away from a branch that has uncommitted work.
- **NEVER** work directly on `main`.
- **NEVER** assume the terminal branch matches the editor workspace — always verify.

### 1) Dependency sync

```bash
npm install                         # root — always
cd worker && npm install && cd ..   # only if worker/ touched
```

### 2) Verify (all must pass)

```bash
npm run lint && npm run typecheck && npm run test:run
npm run test:e2e        # only if touching UI flows
npm run test:coverage   # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
```

Shortcut: `npm run preflight`

### 2b) Doc sync

If your change affects documented behavior (API contracts, env vars, deploy steps, component API, worker endpoints), update the relevant `docs/` file and `README.md` **before** committing. `docs/` is the single source of truth for human-readable project documentation.

### 3) Commit

```bash
git rev-parse --abbrev-ref HEAD   # ← verify branch BEFORE committing
git add -A && git commit -m "<type>: <description>"
git log --oneline -1              # ← verify commit landed correctly
```

Prefixes: `feat` | `fix` | `test` | `refactor` | `docs` | `chore` (commitlint + husky enforced).

### 4) Push & PR

```bash
git push origin HEAD
gh pr create --fill   # follow .github/PULL_REQUEST_TEMPLATE.md
```

Merge: **squash and merge** (self-merge after CI). Human-in-the-loop: user reviews PRs.

### 5) Cleanup

```bash
git checkout main && git pull origin main && git branch -d <branch>
git worktree remove ../<repo>-<desc>   # only if worktree was used
```

Verify terminal CWD is back in the main workspace: `pwd` should show the original repo path.

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
