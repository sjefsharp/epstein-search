---
applyTo: "src/**,worker/**"
---

# Refactor Instructions

**Prerequisite**: Follow `workflow.instructions.md` for workspace check, deps sync, and post-push lifecycle.

## No-Behavior-Change Rule

1. **Baseline**: `npm run lint && npm run typecheck && npm run test:run` — ALL must pass before touching code
2. **Refactor** — all original tests must still pass WITHOUT modification
3. **Verify**: re-run exact same gate commands — same results

## Scope

**Allowed**: rename, extract function/module, simplify conditionals, reduce duplication, improve types, restructure files
**Forbidden**: new features, bug fixes, API changes, test modifications, dependency upgrades — each gets its own branch + commit type
