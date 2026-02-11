---
applyTo: "**"
---

# Workflow — Feedback Loop (use by default for every task)

> **This file is the single source of truth for the git workflow.**
> `AGENTS.md` and `copilot-instructions.md` reference this file — do not duplicate git steps there.

## Step 0 — Workspace Check

```bash
git rev-parse --abbrev-ref HEAD   # know which branch you're on
git status                        # check for uncommitted changes
```

### Decision tree

| Workspace state                                          | Action                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Clean, on `main`                                         | `git checkout -b <type>/<desc>`                      |
| Clean, on another branch (unrelated to this task)        | `git checkout main && git checkout -b <type>/<desc>` |
| **Dirty** (uncommitted/staged changes from another task) | **MUST use worktree** — see below                    |

### Worktree (required when workspace is dirty)

```bash
git worktree add ../<repo>-<desc> -b <type>/<desc> main
cd ../<repo>-<desc>
```

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

## Step 0b — Branch Verification

Before ANY implementation or commit, confirm you are on the correct branch:

```bash
git rev-parse --abbrev-ref HEAD   # must match your task's branch name
```

If it does not match: **STOP**. Resolve before proceeding (see Recovery section).

## Step 1 — Dependency Sync

```bash
npm install                         # root lockfile
cd worker && npm install && cd ..   # only if worker/ is touched
```

Commit any lockfile changes — `npm ci` in CI/Docker fails on drift.

> If using a worktree, run `npm install` **inside the worktree directory**, not
> the original repo. The worktree has its own working tree but shares `.git` —
> `node_modules` must be installed separately.

## Step 2 — Implement

Follow TDD per module type (see `AGENTS.md § TDD`). Write the test first, confirm red, implement, confirm green.

## Step 2b — Doc Sync

If your change affects documented behavior (API contracts, env vars, deploy steps, component API, worker endpoints), update the relevant `docs/` file and `README.md` **before** moving to verify. `docs/` is the single source of truth for human-readable project documentation.

## Step 3 — Verify (all must pass)

```bash
npm run lint && npm run typecheck && npm run test:run
npm run test:e2e        # only if UI flows are touched
npm run test:coverage   # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
```

Shortcut: `npm run preflight`

## Step 3b — Chrome Dev Tools Check (when browser is available)

If you have access to a browser (local dev or remote debugging), open Chrome Dev Tools as an **extra guardrail** alongside automated tests:

1. **Console** — scan for runtime errors, unhandled rejections, or deprecation warnings
2. **Network** — verify API calls return expected status codes and payloads; confirm no failed requests or CORS issues
3. **Elements** — inspect DOM and computed styles to confirm layout intent
4. **Lighthouse / Accessibility** — quick audit for a11y regressions (axe panel or Lighthouse a11y score)

For **remote debugging** (e.g. when investigating a deployed environment):

```
1. Capture screenshots / Console output from the remote host
2. Analyze the Dev Tools feedback and correlate with test results
3. Report findings inline with the commit or PR description
```

> **Non-blocking**: Chrome Dev Tools checks are advisory. Automated tests (Step 3) remain the hard gate — do NOT skip them.

## Step 4 — Commit

```bash
git rev-parse --abbrev-ref HEAD   # ← verify branch BEFORE committing
git add -A && git commit -m "<type>: <description>"
git log --oneline -1              # ← verify commit landed correctly
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
cd /home/user/<original-repo>     # return to original repo directory first
git worktree remove ../<repo>-<desc>
```

Verify terminal CWD is back in the main workspace: `pwd` should show the original repo path.

## Recovery — Wrong Branch

If edits or commits land on the wrong branch, use the appropriate recovery:

### Uncommitted edits on wrong branch

```bash
git stash
git checkout <correct-branch>
git stash pop
```

### Committed to wrong branch (not yet pushed)

```bash
git log --oneline -3              # confirm which commit(s) are wrong
git reset --soft HEAD~1           # undo commit, keep changes staged
git stash
git checkout <correct-branch>
git stash pop
git add -A && git commit -m "<type>: <description>"
```

### Amended the wrong commit

```bash
git reflog                        # find the pre-amend SHA
git reset --hard <pre-amend-sha>  # restore the original commit
```

Then switch to the correct branch and redo the work.

### After any recovery

Always verify:

```bash
git rev-parse --abbrev-ref HEAD   # correct branch?
git log --oneline -3              # correct commit history?
git diff --stat                   # no unintended changes?
```

## Operating Rules

- Never on `main` — always a feature/fix/refactor branch
- Root + worker lockfiles must be in sync before push
- All verify gates (Step 3) must pass before push
- No new .md files outside `temp/` (gitignored) or existing `docs/`
- `docs/` is the single source of truth — keep it current with every behavior change
- Proceed autonomously — only pause for missing permissions or critical ambiguity
- Verify branch name before every commit (`git rev-parse --abbrev-ref HEAD`)
- When using a worktree, all commands and file paths target the worktree directory
