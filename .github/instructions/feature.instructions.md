---
applyTo: "src/**,worker/**"
---

# Feature Development Instructions

**Prerequisite**: Follow `workflow.instructions.md` for workspace check, deps sync, and post-push lifecycle.

## TDD Workflow (mandatory)

1. **Write the test first** — determine module type (see `AGENTS.md § TDD` table)
2. **Confirm the test fails**: `npm run test:run`
3. **Implement the minimum code** to make the test pass
4. **Refactor** while keeping tests green
5. **Verify**: `npm run lint && npm run typecheck && npm run test:run` (+ `test:e2e` if UI, + `test:coverage`)
6. **Chrome Dev Tools check** (when browser is available) — Console errors, Network failures, Elements layout, Lighthouse a11y. For remote debugging: capture and analyze Dev Tools output. Advisory — automated tests remain the hard gate.
7. **Commit & push** per `AGENTS.md § Git Workflow`

## i18n Requirement

- Every user-visible string: `useTranslations()` (client) or `ERROR_MESSAGES` (API)
- Add keys to ALL 6 files: `messages/{en,nl,fr,de,es,pt}.json`
- Never hardcode English text

## API Route Requirement

New routes: follow `api-route.instructions.md` — `export const runtime = "nodejs"` → `SupportedLocale` → `normalizeLocale()` → `ERROR_MESSAGES` (×6) → Zod schema → rate-limit

## Security Requirement

Zod validate all input → `sanitizeError()` in catch → HMAC-sign worker calls → HTTPS + justice.gov whitelist for URLs

## Worker Dependency Requirement

If changing `worker/package.json`: `cd worker && npm install` → commit `worker/package-lock.json`. Preflight: `cd worker && npm ci --dry-run`.
