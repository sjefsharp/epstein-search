---
applyTo: "**"
---

# Workflow — Feedback Loop (use by default for every task)

> **This file is the single source of truth for the git workflow.**
> `AGENTS.md` and `copilot-instructions.md` reference this file — do not duplicate git steps there.

---

## ⛔ MANDATORY — Every Task Has Three Phases

> **Agents MUST execute all three phases. Skipping any phase is a workflow violation.**

| Phase       | Script                                        | When                                    |
| ----------- | --------------------------------------------- | --------------------------------------- |
| **START**   | `bash scripts/start-task.sh <type> <desc>`    | **BEFORE any file edit or code change** |
| **WORK**    | Implement → Verify → Commit (see steps below) | During implementation                   |
| **FINISH**  | `bash scripts/finish-task.sh`                 | **AFTER all verification passes**       |
| **CLEANUP** | `bash scripts/cleanup-task.sh [branch]`       | **AFTER the PR is merged**              |

### Agent Rules (non-negotiable)

1. **You MUST run `bash scripts/start-task.sh <type> <desc>` BEFORE making ANY file changes.** No exceptions.
2. **You MUST run `bash scripts/finish-task.sh` AFTER verification passes.** This pushes to origin and creates a PR.
3. **You MUST run `bash scripts/cleanup-task.sh` AFTER the PR is merged.** This deletes the local branch and returns to main.
4. **You MUST NEVER work directly on `main`.** The start script enforces this.
5. **You MUST NEVER skip the push and PR creation step.** Every task ends with a remote push and PR.
6. **You MUST NEVER leave stale local branches.** Cleanup removes them.
7. **If the workspace is dirty (another session has uncommitted changes), the start script automatically creates a worktree.** Follow the worktree instructions it prints.

---

## Phase 1 — START

```bash
bash scripts/start-task.sh <type> <desc>
```

Types: `feat` | `fix` | `test` | `refactor` | `docs` | `chore`

The script handles all branching logic automatically:

- **Clean on `main`** → creates `<type>/<desc>` branch
- **Clean on another branch** → switches to `main` first, then creates branch
- **Dirty workspace** → creates a **git worktree** and prints the worktree path

### Worktree — When Another Session Has Uncommitted Work

If a separate agent/chat session is already working in this repo with uncommitted changes, the start script detects dirty state and creates a worktree automatically.

> **⚠ IMPORTANT — Editor/Terminal Divergence**
>
> Terminal `cd` does NOT change the VS Code editor's workspace root.
> After the script creates a worktree:
>
> 1. All `git` and `npm` commands MUST run in the worktree directory.
> 2. All file-edit tool paths MUST use the worktree's absolute path
>    (e.g., `/home/user/<repo>-<desc>/src/...`), not the original repo path.
> 3. Alternatively, open the worktree as a VS Code workspace folder so the
>    editor tracks the correct branch.

---

## Phase 2 — WORK

### Step 1 — Branch Verification

Before ANY implementation, confirm the start script succeeded:

```bash
git rev-parse --abbrev-ref HEAD   # must match your task's branch name
```

If it does not match: **STOP**. Resolve before proceeding (see Recovery section).

### Step 2 — Implement

Follow TDD per module type (see `AGENTS.md § TDD`). Write the test first, confirm red, implement, confirm green.

### Step 3 — Doc Sync

If your change affects documented behavior (API contracts, env vars, deploy steps, component API, worker endpoints), update the relevant `docs/` file and `README.md` **before** moving to verify. `docs/` is the single source of truth for human-readable project documentation.

### Step 4 — Verify (all must pass)

```bash
npm run lint && npm run typecheck && npm run test:run
npm run test:e2e        # only if UI flows are touched
npm run test:coverage   # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
```

Shortcut: `npm run preflight`

### Step 4b — Chrome Dev Tools Check (when browser is available)

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

> **Non-blocking**: Chrome Dev Tools checks are advisory. Automated tests (Step 4) remain the hard gate — do NOT skip them.

### Step 5 — Commit

```bash
git rev-parse --abbrev-ref HEAD   # ← verify branch BEFORE committing
git add -A && git commit -m "<type>: <description>"
git log --oneline -1              # ← verify commit landed correctly
```

Prefixes: `feat` | `fix` | `test` | `refactor` | `docs` | `chore` (enforced by commitlint + husky).

---

## Phase 3 — FINISH (push + PR)

```bash
bash scripts/finish-task.sh
```

The script:

1. Verifies you are NOT on `main`
2. Commits any remaining uncommitted changes
3. Pushes the branch to `origin`
4. Creates a PR via `gh pr create --fill` (follows `.github/PULL_REQUEST_TEMPLATE.md`)
5. Prints the PR URL

- Merge strategy: **squash and merge**
- Human-in-the-loop: user reviews PRs — proceed without asking for extra confirmations

> **⛔ You MUST run this script. Do NOT end a task without pushing and creating a PR.**

---

## Phase 4 — CLEANUP (after PR merge)

```bash
bash scripts/cleanup-task.sh [branch-name]
```

The script:

1. Removes any worktree associated with the branch
2. Switches to `main` and pulls latest
3. Deletes the local task branch
4. Verifies CWD is back in the main workspace

> **⛔ You MUST run cleanup after the PR is merged. Do NOT leave stale local branches.**

---

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

---

## Operating Rules

- Never on `main` — always a feature/fix/refactor branch
- Root + worker lockfiles must be in sync before push
- All verify gates (Step 4) must pass before push
- No new .md files outside `temp/` (gitignored) or existing `docs/`
- `docs/` is the single source of truth — keep it current with every behavior change
- Proceed autonomously — only pause for missing permissions or critical ambiguity
- Verify branch name before every commit (`git rev-parse --abbrev-ref HEAD`)
- When using a worktree, all commands and file paths target the worktree directory
- **Every task must complete all phases: START → WORK → FINISH → CLEANUP**
