# Testing Patterns

## Framework

- Vitest 4, v8 coverage provider
- Config: `vitest.config.ts` — globals enabled, node environment
- Setup: `tests/setup.ts` — sets all required env vars before tests
- Path alias: `@/` resolved via vitest alias config (mirrors tsconfig paths)

## Directory Structure

```
tests/
├── setup.ts                     # env var injection for all tests
├── smoke.sh                     # Bash smoke tests for worker endpoints
├── components/                  # 18 component test files
│   ├── AdCard.test.tsx
│   ├── AdSenseLoader.test.tsx
│   ├── AdSlot.test.tsx
│   ├── AgeVerification.test.tsx
│   ├── Badge.test.tsx
│   ├── Breadcrumbs.test.tsx
│   ├── Button.test.tsx
│   ├── ChatInput.test.tsx
│   ├── ConsentBanner.test.tsx
│   ├── ConsentBottomSpacer.test.tsx
│   ├── DonationPanel.test.tsx
│   ├── Footer.test.tsx
│   ├── LanguageSwitcher.test.tsx
│   ├── MainNav.test.tsx
│   ├── Message.test.tsx
│   ├── MessageList.test.tsx
│   ├── MobileNav.test.tsx
│   ├── ScrollArea.test.tsx
│   └── ThemeToggle.test.tsx
├── e2e/                         # 7 Playwright E2E specs
│   ├── accessibility.spec.ts
│   ├── age-gate.spec.ts
│   ├── dark-mode.spec.ts
│   ├── home.spec.ts
│   ├── layout-stability.spec.ts
│   ├── navigation.spec.ts
│   └── search-flow.spec.ts
├── lib/                         # 8 library unit tests
│   ├── cache.test.ts
│   ├── consent.test.ts
│   ├── db.test.ts
│   ├── doj-api.test.ts
│   ├── groq.test.ts
│   ├── ratelimit.test.ts
│   ├── security.test.ts
│   └── validation.test.ts
├── store/
│   └── consent-store.test.ts
├── utils/
│   └── renderWithIntl.tsx       # i18n wrapper for component tests
└── worker/
    ├── auth.test.ts
    ├── ratelimit.test.ts
    └── stealth.test.ts
```

## Commands

| Command                 | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `npm test`              | Watch mode                                  |
| `npm run test:run`      | Single run (CI)                             |
| `npm run test:coverage` | v8 coverage report                          |
| `npm run test:e2e`      | Playwright E2E (auto-starts dev server)     |
| `npm run preflight`     | lint + typecheck + test:run + test:coverage |

## Coverage Thresholds (CI-enforced)

Lines ≥80% · Statements ≥80% · Functions ≥75% · Branches ≥60%

## Conventions

- `describe()` blocks grouped by function/module
- `safeParse` pattern for Zod validation tests: assert `result.success`, then check `result.data`
- Test both valid and invalid inputs (injection, boundary values, wrong domains)
- Env vars set in `tests/setup.ts` `beforeAll` — not per-test

## Component Testing

Use `renderWithIntl` from `tests/utils/renderWithIntl.tsx` for all component tests — wraps the component with `NextIntlClientProvider` to handle i18n.

```typescript
import { renderWithIntl } from "../utils/renderWithIntl";
renderWithIntl(<MyComponent />);
```

## Smoke Tests

Worker endpoint smoke tests (run against deployed worker):

```bash
bash tests/smoke.sh
```

Tests health, search, and analyze endpoints with expected status codes.

## Adding Tests

1. Create `tests/{module-path}/{name}.test.ts` (or `.test.tsx` for components)
2. Import from `@/lib/...` using path alias
3. Group with `describe()`/`it()`
4. If new env vars needed, add to `tests/setup.ts`
