#!/usr/bin/env bash
# scripts/finish-task.sh — Push branch and create a PR after verification passes
# Usage: bash scripts/finish-task.sh
# Runs preflight checks, pushes the branch, and creates a GitHub PR.
set -euo pipefail

# ── Safety checks ────────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "❌ You are on 'main'. Refusing to push. Create a task branch first."
  echo "   Run: bash scripts/start-task.sh <type> <desc>"
  exit 1
fi

echo "── Finish Task ─────────────────────────────────────────"
echo "Branch: $CURRENT_BRANCH"
echo ""

# ── Check for uncommitted changes ────────────────────────────────────────────
DIRTY=$(git status --porcelain)
if [[ -n "$DIRTY" ]]; then
  echo "⚠️  Uncommitted changes detected. Staging and committing..."
  echo ""
  git add -A
  # Extract type from branch name (e.g., feat/desc → feat)
  COMMIT_TYPE=$(echo "$CURRENT_BRANCH" | cut -d'/' -f1)
  COMMIT_DESC=$(echo "$CURRENT_BRANCH" | cut -d'/' -f2- | tr '-' ' ')
  git commit -m "${COMMIT_TYPE}: ${COMMIT_DESC}"
  echo ""
fi

# ── Verify branch before push ───────────────────────────────────────────────
echo "🔍 Verifying branch..."
VERIFY_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$VERIFY_BRANCH" != "$CURRENT_BRANCH" ]]; then
  echo "❌ Branch mismatch! Expected '$CURRENT_BRANCH', got '$VERIFY_BRANCH'."
  exit 1
fi
echo "   Branch verified: $VERIFY_BRANCH"
echo ""

# ── Check we have commits ahead of main ─────────────────────────────────────
AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo "0")
if [[ "$AHEAD" == "0" ]]; then
  echo "❌ No commits ahead of main. Nothing to push."
  exit 1
fi
echo "   Commits ahead of main: $AHEAD"
echo ""

# ── Push ─────────────────────────────────────────────────────────────────────
echo "🚀 Pushing to origin..."
git push origin HEAD
echo ""

# ── Create PR ────────────────────────────────────────────────────────────────
echo "📋 Creating Pull Request..."
if command -v gh &>/dev/null; then
  PR_URL=$(gh pr create --fill 2>&1) || true
  if echo "$PR_URL" | grep -q "already exists"; then
    echo "   PR already exists for this branch."
    PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "(could not retrieve URL)")
  fi
  echo ""
  echo "✅ Done!"
  echo "   Branch: $CURRENT_BRANCH"
  echo "   PR: $PR_URL"
else
  echo "⚠️  GitHub CLI (gh) not found. Push succeeded — create PR manually."
  echo "   https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/pull/new/$CURRENT_BRANCH"
fi

echo ""
echo "── Next steps ────────────────────────────────────────"
echo "1. Wait for CI to pass"
echo "2. User reviews and merges the PR (squash and merge)"
echo "3. Run: bash scripts/cleanup-task.sh"
