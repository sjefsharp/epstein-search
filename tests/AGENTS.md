# tests/ — Test Suite

Vitest 4 (unit + component) and Playwright (E2E) tests. All test infrastructure lives here.

## Structure

```
tests/
├── setup.ts                        # Global env var injection + jest-dom matchers
├── utils/
│   └── renderWithIntl.tsx          # next-intl test wrapper for component tests
├── lib/                            # Unit tests for src/lib/ modules
│   ├── security.test.ts
│   ├── validation.test.ts
│   ├── cache.test.ts
│   ├── consent.test.ts
│   ├── db.test.ts
│   ├── doj-api.test.ts
│   ├── groq.test.ts
│   └── ratelimit.test.ts
├── components/                     # Component tests (Testing Library)
│   ├── ChatInput.test.tsx
│   ├── Message.test.tsx
│   ├── MessageList.test.tsx
│   ├── ConsentBanner.test.tsx
│   ├── LanguageSwitcher.test.tsx
│   ├── DonationPanel.test.tsx
│   ├── Badge.test.tsx
│   ├── ScrollArea.test.tsx
│   ├── AdSenseLoader.test.tsx
│   └── AdSlot.test.tsx
├── worker/                         # Worker auth tests
│   └── auth.test.ts
└── e2e/                            # Playwright E2E tests
    ├── home.spec.ts
    ├── search-flow.spec.ts
    └── pages/                      # Page object models
```

## Setup File (`setup.ts`)

Runs before all tests. Provides:

- Required env vars: `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WORKER_SHARED_SECRET`, `NEON_DATABASE_URL`
- `@testing-library/jest-dom/vitest` matchers (e.g., `toBeInTheDocument()`, `toHaveAttribute()`)

## Coverage Thresholds (CI-enforced)

| Metric     | Minimum | Command                 |
| ---------- | ------- | ----------------------- |
| Lines      | 80%     | `npm run test:coverage` |
| Statements | 80%     |                         |
| Functions  | 75%     |                         |
| Branches   | 60%     |                         |

## Naming Conventions

| Type      | Pattern      | Location            |
| --------- | ------------ | ------------------- |
| Unit      | `*.test.ts`  | `tests/lib/`        |
| Component | `*.test.tsx` | `tests/components/` |
| Worker    | `*.test.ts`  | `tests/worker/`     |
| E2E       | `*.spec.ts`  | `tests/e2e/`        |

## Test Structure Pattern

```typescript
import { describe, it, expect } from "vitest";

describe("moduleName", () => {
  describe("functionName", () => {
    it("should handle the happy path", () => {
      /* ... */
    });
    it("should reject invalid input", () => {
      /* ... */
    });
    it("should handle edge case X", () => {
      /* ... */
    });
  });
});
```

## Component Test Pattern

```typescript
import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "../utils/renderWithIntl";
import MyComponent from "@/components/path/MyComponent";

describe("MyComponent", () => {
  it("should render the translated title", () => {
    renderWithIntl(<MyComponent />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });
});
```

## Validation Test Pattern

```typescript
it("should accept valid input", () => {
  const result = schema.safeParse(validInput);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.field).toBe(expectedValue);
  }
});

it("should reject invalid input", () => {
  const result = schema.safeParse(invalidInput);
  expect(result.success).toBe(false);
});
```

## Rules

- NEVER mock Zod schemas — test them with real input/output
- Use `vi.mock()` for external service clients (Redis, Groq, Postgres)
- Set env vars in `setup.ts` — do NOT set them per-test unless testing env-dependent behavior
- E2E tests use Playwright's `page` fixture — never import Vitest in E2E files
- Path alias `@/` works in tests via `vitest.config.ts` resolve alias
- Test-only changes (new test utilities, setup adjustments) commit with `test:` prefix

### Git Workflow (tests)

```powershell
git checkout -b test/<short-description>

npm run lint ; npm run typecheck ; npm run test:run
npm run test:e2e      # only if touching UI flows
npm run test:coverage # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%

git add -A
git commit -m "test: <description>"
git push origin HEAD
```

Create a PR (GitHub UI or `gh pr create --fill`) using `.github/PULL_REQUEST_TEMPLATE.md`.
Merge strategy: **squash and merge** (self-merge allowed after CI passes).

After the PR is merged:

```powershell
git checkout main
git pull origin main
git branch -d <branch-name>
```

## Output Rules

Do NOT create new markdown files in the repo. Use `temp/` for scratch docs. See root [AGENTS.md](../AGENTS.md) for details.
