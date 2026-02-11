---
applyTo: "src/**,worker/**,tests/**"
---

# Bug Fix Instructions

**Prerequisite**: Follow `workflow.instructions.md` for workspace check, deps sync, and post-push lifecycle.

## Reproduce-First Workflow

1. **Write a failing test** reproducing the bug — MUST fail now, pass after fix
2. **Confirm it fails**: `npm run test:run`
3. **Fix the bug** — minimum code change only
4. **Confirm it passes**: `npm run test:run`
5. **Verify no regressions**: `npm run lint && npm run typecheck && npm run test:run` (+ `test:e2e` if UI, + `test:coverage`)
6. **Chrome Dev Tools check** (when browser is available) — Console errors, Network failures, Elements layout, Lighthouse a11y. For remote debugging: capture and analyze Dev Tools output. Advisory — automated tests remain the hard gate.
7. **Commit & push** per `AGENTS.md § Git Workflow`

## Rules

- NEVER fix without a regression test — NEVER modify existing tests to pass — fix the code
- Keep fix minimal and surgical — no refactoring in same commit
- If changing `worker/package.json`: `cd worker && npm install` → commit lockfile
