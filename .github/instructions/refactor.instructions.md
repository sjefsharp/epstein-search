---
applyTo: "src/**,worker/**"
---

# Refactor Instructions

## Core Rule: No Behavior Change

A refactor changes code structure while preserving ALL existing behavior. If a test must change, it's not a refactor — it's a feature or bugfix.

## Workflow

1. **Run the full test suite first** — establish a baseline:

   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   ```

2. **All tests must pass** before you start refactoring

3. **Refactor in small steps** — run tests after each step

4. **After completion**, run the full verification:

   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   npm run test:e2e      # only if the refactor touches UI components
   npm run test:coverage
   ```

5. **All original tests must still pass WITHOUT modification**

## Allowed Changes

- Rename variables, functions, files (update all imports)
- Extract helper functions or modules
- Replace patterns with more idiomatic alternatives
- Reduce duplication (e.g., extracting shared `normalizeLocale()`)
- Improve type safety (narrowing `any` to specific types)
- Performance optimizations (memoization, derive state inline)

## Forbidden Changes

- Adding new features or changing return values
- Modifying test assertions or expectations
- Changing API response shapes or HTTP status codes
- Altering SSE stream format
- Removing security checks or validation rules
- Disabling ESLint rules

## Commit

Use: `refactor: description of structural change`

```powershell
git add -A
git commit -m "refactor: description of structural change"
git push origin HEAD
```

> **Branch check**: ensure you are on a feature/fix branch, not `main`. Create one with `git checkout -b refactor/<short-description>` if needed.

## Output Rules

- Do NOT create new markdown files (plans, implementation notes, fix logs) in the repo
- If scratch notes are needed, use the `temp/` folder (gitignored)
- Only modify existing `docs/*.md` files when documented behavior changes
