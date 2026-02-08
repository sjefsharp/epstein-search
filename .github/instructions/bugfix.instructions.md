---
applyTo: "src/**,worker/**,tests/**"
---

# Bug Fix Instructions

## Reproduce-First Workflow

1. **Write a failing test** that reproduces the bug:
   - This test MUST fail on the current code and pass after the fix
   - Place it alongside existing tests for the affected module
   - Name it descriptively: `it("should not crash when input is empty (regression #123)")`

2. **Confirm the test fails**: `npm run test:run`

3. **Fix the bug** — change only the minimum code necessary

4. **Confirm the test passes**: `npm run test:run`

5. **Check for regressions** — ensure no other tests broke:

   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   npm run test:e2e      # only if the fix touches UI flows
   npm run test:coverage # only if the fix touches security or core logic
   ```

6. **Commit and push**:
   ```powershell
   git add -A
   git commit -m "fix: description of what was fixed"
   git push origin HEAD
   ```

## Rules

- NEVER fix a bug without a regression test
- NEVER modify existing tests to make them pass — fix the code, not the tests
- Keep the fix minimal and surgical — avoid refactoring in the same commit
- Ensure you are on a feature/fix branch, not `main` — create one with `git checkout -b fix/<short-description>` if needed
- If a bugfix changes `worker/package.json`, run `cd worker ; npm install` and commit the updated `worker/package-lock.json`

## Output Rules

- Do NOT create new markdown files (plans, implementation notes, fix logs) in the repo
- If scratch notes are needed, use the `temp/` folder (gitignored)
- Only modify existing `docs/*.md` files when documented behavior changes
