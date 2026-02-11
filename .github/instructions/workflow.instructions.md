---
applyTo: "**"
---

# Workflow — Feedback Loop (use by default for every task)

## Step 0 — Workspace Check

```bash
git status
```

- **Clean**: `git checkout -b <type>/<desc>` from `main`
- **Dirty** (pending/staged changes from another task): create a worktree to isolate work:
  ```bash
  git worktree add ../<repo>-<desc> -b <type>/<desc> main
  cd ../<repo>-<desc>
  ```

Never work directly on `main`.

## Step 1 — Dependency Sync

```bash
npm install                         # root lockfile
cd worker && npm install && cd ..   # only if worker/ is touched
```

Commit any lockfile changes — `npm ci` in CI/Docker fails on drift.

## Step 2 — Implement

Follow TDD per module type (see `AGENTS.md § TDD`). Write the test first, confirm red, implement, confirm green.

## Step 3 — Verify (all must pass)

```bash
npm run lint && npm run typecheck && npm run test:run
npm run test:e2e        # only if UI flows are touched
npm run test:coverage   # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
```

Shortcut: `npm run preflight`

## Step 4 — Commit

```bash
git add -A && git commit -m "<type>: <description>"
```

Prefixes: `feat` | `fix` | `test` | `refactor` | `docs` | `chore` (enforced by commitlint + husky).

## Step 5 — Push & PR

```bash
git push origin HEAD
gh pr create --fill   # or GitHub UI
```

- Follow `.github/PULL_REQUEST_TEMPLATE.md`
- Merge strategy: **squash and merge**
- Human-in-the-loop: user reviews PRs — proceed without asking for extra confirmations

## Step 6 — Cleanup

```bash
git checkout main && git pull origin main && git branch -d <branch>
```

If a worktree was used:

```bash
git worktree remove ../<repo>-<desc>
```

## Operating Rules

- Never on `main` — always a feature/fix/refactor branch
- Root + worker lockfiles must be in sync before push
- All verify gates (Step 3) must pass before push
- No new .md files outside `temp/` (gitignored) or existing `docs/`
- Proceed autonomously — only pause for missing permissions or critical ambiguity
