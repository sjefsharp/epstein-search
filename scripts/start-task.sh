#!/usr/bin/env bash
# scripts/start-task.sh — Initialize a task branch (or worktree if workspace is dirty)
# Usage: bash scripts/start-task.sh <type> <description>
# Example: bash scripts/start-task.sh feat add-search-filter
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
TYPE="${1:-}"
DESC="${2:-}"

if [[ -z "$TYPE" || -z "$DESC" ]]; then
  echo "❌ Usage: bash scripts/start-task.sh <type> <description>"
  echo "   Types: feat | fix | test | refactor | docs | chore"
  echo "   Example: bash scripts/start-task.sh feat add-search-filter"
  exit 1
fi

VALID_TYPES="feat fix test refactor docs chore"
if ! echo "$VALID_TYPES" | grep -qw "$TYPE"; then
  echo "❌ Invalid type '$TYPE'. Must be one of: $VALID_TYPES"
  exit 1
fi

BRANCH="${TYPE}/${DESC}"
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")

# ── Workspace state ──────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIRTY=$(git status --porcelain)

echo "── Start Task ──────────────────────────────────────────"
echo "Branch to create: $BRANCH"
echo "Current branch:   $CURRENT_BRANCH"
echo "Workspace dirty:  $([ -n "$DIRTY" ] && echo 'YES' || echo 'no')"
echo ""

# ── Decision tree ─────────────────────────────────────────────────────────────
if [[ -n "$DIRTY" ]]; then
  # Dirty workspace → MUST use worktree
  WORKTREE_DIR="../${REPO_NAME}-${DESC}"
  echo "⚠️  Workspace has uncommitted changes — creating worktree."
  echo "   Worktree path: $(cd .. && pwd)/${REPO_NAME}-${DESC}"
  echo ""
  git worktree add "$WORKTREE_DIR" -b "$BRANCH" main
  echo ""
  echo "⚠️  IMPORTANT — Editor/Terminal Divergence:"
  echo "   Terminal cd does NOT change VS Code's workspace root."
  echo "   After 'cd $WORKTREE_DIR':"
  echo "   1. All git and npm commands MUST run in the worktree directory."
  echo "   2. All file-edit tool paths MUST use the worktree's absolute path."
  echo "   3. Alternatively, open the worktree as a VS Code workspace folder."
  echo ""
  echo "   Run: cd $WORKTREE_DIR"
  echo ""
  # Install deps in worktree
  (cd "$WORKTREE_DIR" && npm install --silent 2>/dev/null)
  echo ""
  echo "✅ Worktree ready at: $(cd "$WORKTREE_DIR" && pwd)"
  echo "   Branch: $BRANCH"
  echo "   ⚡ Run: cd $WORKTREE_DIR"
elif [[ "$CURRENT_BRANCH" == "main" ]]; then
  # Clean, on main → create branch directly
  git checkout -b "$BRANCH"
  npm install --silent 2>/dev/null
  echo ""
  echo "✅ Branch created: $BRANCH"
  echo "   Dependencies synced."
else
  # Clean, on another branch → switch to main first
  echo "ℹ️  Switching from '$CURRENT_BRANCH' to main first."
  git checkout main
  git pull origin main --quiet 2>/dev/null || true
  git checkout -b "$BRANCH"
  npm install --silent 2>/dev/null
  echo ""
  echo "✅ Branch created: $BRANCH"
  echo "   Dependencies synced."
fi

echo ""
echo "── Ready to work ─────────────────────────────────────"
echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$BRANCH")"
echo "Next: implement changes, then run 'bash scripts/finish-task.sh'"
