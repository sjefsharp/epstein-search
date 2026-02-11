# tests/ — Test Suite

Vitest 4 (unit + component) and Playwright (E2E) tests. All test infrastructure lives here.

## Structure

```
tests/
├── setup.ts                        # Global env var injection + jest-dom matchers
├── utils/renderWithIntl.tsx        # next-intl test wrapper for component tests
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
├── worker/                         # Worker auth tests
├── store/                          # Zustand store tests
└── e2e/                            # Playwright E2E tests + page objects
```

## Setup (`setup.ts`)

Runs before all tests. Provides:

- Required env vars: `GROQ_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WORKER_SHARED_SECRET`, `NEON_DATABASE_URL`
- `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument()`, `toHaveAttribute()`, etc.)

## Coverage (CI-enforced)

Lines ≥80% · Statements ≥80% · Functions ≥75% · Branches ≥60% — via `npm run test:coverage`

## Naming

Unit/component: `*.test.ts` / `*.test.tsx` — E2E: `*.spec.ts` — all in `tests/` mirroring `src/` (NOT `__tests__/`)

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
  if (result.success) expect(result.data.field).toBe(expectedValue);
});

it("should reject invalid input", () => {
  const result = schema.safeParse(invalidInput);
  expect(result.success).toBe(false);
});
```

## Rules

- NEVER mock Zod schemas — test with real input/output
- `vi.mock()` for external service clients (Redis, Groq, Postgres)
- Env vars in `setup.ts` — NOT per-test unless testing env-dependent behavior
- E2E: Playwright `page` fixture — never import Vitest in E2E files
- Path alias `@/` works via `vitest.config.ts` resolve alias
- Test-only changes commit with `test:` prefix

Git workflow: see `AGENTS.md § Git Workflow`
