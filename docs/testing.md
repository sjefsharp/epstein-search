# Testing Patterns

## Framework

- Vitest 4, v8 coverage provider
- Config: `vitest.config.ts` — globals enabled, node environment
- Setup: `tests/setup.ts` — sets all required env vars before tests

## Directory structure

```
tests/
├── setup.ts                  # env var injection
├── lib/
│   ├── security.test.ts      # HMAC, signature verification, enforceHttps, sanitizeError
│   └── validation.test.ts    # Zod schema tests (search, analyze)
└── worker/
    └── auth.test.ts          # Worker auth tests
```

## Path alias

Tests use `@/` path alias — resolved via `vitest.config.ts` alias config (mirrors tsconfig paths).

## Conventions

- Use `describe()` blocks grouped by function/module
- `safeParse` pattern for validation tests: assert `result.success` then check `result.data`
- Test both valid and invalid inputs (injection, boundary values, wrong domains)
- Environment variables set in `tests/setup.ts` `beforeAll`, not per-test
- `tsconfig.json` excludes `tests/` dir — tests are not type-checked with app code

## Coverage exclusions

```
node_modules/, tests/, *.config.*, .next/, worker/
```

## Running

```
npm test             # watch mode
npm run test:run     # single run (CI)
npm run test:ui      # visual UI
```

## Adding tests

1. Create `tests/{module-path}/{name}.test.ts`
2. Import from `@/lib/...` using path alias
3. Group with `describe()`/`it()`
4. If new env vars needed, add to `tests/setup.ts`
