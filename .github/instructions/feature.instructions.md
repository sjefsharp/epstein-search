---
applyTo: "src/**,worker/**"
---

# Feature Development Instructions

## TDD Workflow (mandatory)

1. **Write the test first** — determine the module type:
   - `src/lib/` → `tests/lib/<module>.test.ts`
   - `src/components/` → `tests/components/<Component>.test.tsx`
   - `src/app/api/` → `tests/lib/<logic>.test.ts` + `tests/e2e/<flow>.spec.ts`
   - `worker/` → `tests/worker/<module>.test.ts`

2. **Confirm the test fails**: `npm run test:run`

3. **Implement the minimum code** to make the test pass

4. **Refactor** while keeping tests green

5. **Verify before committing**:

   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   npm run test:e2e      # only if the feature touches UI flows
   npm run test:coverage # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
   ```

6. **Commit and push**:
   ```powershell
   git add -A
   git commit -m "feat: description of the new feature"
   git push origin HEAD
   ```

> **Branch check**: ensure you are on a feature branch, not `main`. Create one with `git checkout -b feat/<short-description>` if needed.

## i18n Requirement

- Every user-visible string MUST use `useTranslations()` (client) or `ERROR_MESSAGES` (API)
- Add translation keys to ALL 6 files: `messages/en.json`, `nl.json`, `fr.json`, `de.json`, `es.json`, `pt.json`
- Never hardcode English text in components or API responses

## API Route Requirement

If adding a new API route:

- `export const runtime = "nodejs"`
- Define `SupportedLocale`, `normalizeLocale()`, `ERROR_MESSAGES` (all 6 locales)
- Add Zod schema to `src/lib/validation.ts`
- Implement rate-limiting if the route accepts user input

## Security Requirement

- Validate all external input through Zod before use
- Use `sanitizeError()` in catch blocks
- If calling the worker: HMAC-sign the request body
- If accepting URLs: enforce HTTPS + justice.gov domain whitelist

## Worker Dependency Requirement

- If a feature changes `worker/package.json`, run `cd worker ; npm install` and commit the updated `worker/package-lock.json`.
- Optional preflight: `cd worker ; npm ci --dry-run` to verify lock file parity.

## Output Rules

- Do NOT create new markdown files (plans, implementation notes, fix logs) in the repo
- If scratch notes are needed, use the `temp/` folder (gitignored)
- Only modify existing `docs/*.md` files when documented behavior changes
