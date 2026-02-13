#!/usr/bin/env bash
# scripts/cleanup-task.sh — Delete the task branch and return to main
# Usage: bash scripts/cleanup-task.sh [branch-name]
# If branch-name is omitted, uses the current branch (must not be main).
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

if [[ "$BRANCH" == "main" ]]; then
  echo "❌ Cannot clean up 'main'. Provide the task branch name."
  echo "   Usage: bash scripts/cleanup-task.sh <branch-name>"
  exit 1
fi

echo "── Cleanup Task ────────────────────────────────────────"
echo "Branch to remove: $BRANCH"
echo ""

# ── Check for worktree ──────────────────────────────────────────────────────
WORKTREE_PATH=""
while IFS= read -r line; do
  if echo "$line" | grep -q "$BRANCH"; then
    # The worktree list format: /path/to/worktree SHA [branch]
    WORKTREE_PATH=$(echo "$line" | awk '{print $1}')
  fi
done < <(git worktree list)

if [[ -n "$WORKTREE_PATH" && "$WORKTREE_PATH" != "$REPO_ROOT" ]]; then
  echo "🗑️  Removing worktree at: $WORKTREE_PATH"
  # Make sure we're not inside the worktree
  cd "$REPO_ROOT"
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
  echo "   Worktree removed."
  echo ""
fi

# ── Switch to main ──────────────────────────────────────────────────────────
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT" != "main" ]]; then
  # Check for uncommitted changes before switching
  DIRTY=$(git status --porcelain)
  if [[ -n "$DIRTY" ]]; then
    echo "⚠️  Uncommitted changes on '$CURRENT'. Stashing before switch."
    git stash push -m "cleanup-task: auto-stash from $CURRENT"
  fi
  git checkout main
fi

git pull origin main --quiet 2>/dev/null || true

# ── Delete local branch ────────────────────────────────────────────────────
if git branch --list "$BRANCH" | grep -q "$BRANCH"; then
  git branch -d "$BRANCH" 2>/dev/null || git branch -D "$BRANCH"
  echo "🗑️  Local branch '$BRANCH' deleted."
else
  echo "ℹ️  Local branch '$BRANCH' not found (already deleted or was a worktree-only branch)."
fi

echo ""
echo "✅ Cleanup complete."
echo "   Branch: main"
echo "   CWD: $(pwd)"
echo "   Ready for next task: bash scripts/start-task.sh <type> <desc>"
