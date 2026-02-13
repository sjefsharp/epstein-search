---
applyTo: "src/**,worker/**,tests/**"
---

# Bug Fix Instructions

**⛔ BEFORE starting**: Run `bash scripts/start-task.sh fix <desc>` to create the branch. See `workflow.instructions.md`.
**⛔ AFTER step 7**: Run `bash scripts/finish-task.sh` to push and create a PR.

## Reproduce-First Workflow

1. **Write a failing test** reproducing the bug — MUST fail now, pass after fix
2. **Confirm it fails**: `npm run test:run`
3. **Fix the bug** — minimum code change only
4. **Confirm it passes**: `npm run test:run`
5. **Verify no regressions**: `npm run lint && npm run typecheck && npm run test:run` (+ `test:e2e` if UI, + `test:coverage`)
6. **Chrome Dev Tools check** (when browser is available) — Console errors, Network failures, Elements layout, Lighthouse a11y. For remote debugging: capture and analyze Dev Tools output. Advisory — automated tests remain the hard gate.
7. **Commit**: `git add -A && git commit -m "fix: <description>"`
8. **Finish**: `bash scripts/finish-task.sh` (pushes + creates PR)

## Rules

- NEVER fix without a regression test — NEVER modify existing tests to pass — fix the code
- Keep fix minimal and surgical — no refactoring in same commit
- If changing `worker/package.json`: `cd worker && npm install` → commit lockfile
