# src/lib/ — Core Business Logic

Pure utility modules shared by API routes, components, and the worker.

## TDD Rule

Every new function gets a unit test BEFORE implementation:

1. Create `tests/lib/<module>.test.ts`
2. Write failing test → `npm run test:run` → confirm red
3. Implement minimum code → confirm green
4. Refactor → re-run tests

Git workflow: see `AGENTS.md § Git Workflow`

## Module Inventory

| Module          | Purpose                            | Lazy Init | Graceful Degrade  |
| --------------- | ---------------------------------- | --------- | ----------------- |
| `types.ts`      | Shared TypeScript types/interfaces | n/a       | n/a               |
| `validation.ts` | Zod schemas for all external input | n/a       | n/a               |
| `security.ts`   | HMAC, timing-safe, sanitizeError   | n/a       | n/a               |
| `groq.ts`       | Groq client + locale prompts       | ✅        | ❌ (throws)       |
| `cache.ts`      | Upstash Redis cache (24h TTL)      | ✅        | ✅ (returns null) |
| `ratelimit.ts`  | Upstash rate limiters              | ✅        | ✅ (pass-through) |
| `doj-api.ts`    | DOJ API proxy + dedup              | n/a       | ❌ (throws)       |
| `db.ts`         | Neon Postgres pool                 | ✅        | ❌ (throws)       |
| `consent.ts`    | GDPR consent logic (client-side)   | n/a       | n/a               |
| `utils.ts`      | `cn()` Tailwind merge helper       | n/a       | n/a               |

## Patterns

### Lazy Initialization

External clients MUST use lazy init to avoid build-time env errors:

```typescript
let client: ClientType | null = null;
function getClient(): ClientType {
  if (!client) client = new ClientType({ apiKey: process.env.API_KEY! });
  return client;
}
```

### Graceful Degradation

Cache and rate-limit modules MUST never throw. Wrap all ops in try/catch → return null or pass-through on failure.

### Zod Validation

- All external input through Zod schema before use — schemas in `validation.ts`, never inline
- Use `schema.safeParse()` → check `.success` → access `.data`
- Whitelist chars via regex, enforce min/max lengths, validate URLs

### Error Handling

- `sanitizeError(error)` in all production responses — never expose stack traces/env vars
- `DojApiError` (from `doj-api.ts`) for DOJ API failures with statusCode

### Security Functions

`createSignature()` | `verifyTimingSafe()` | `enforceHttps()` | `sanitizeError()` — see `security-review.instructions.md`

### Localization

`SupportedLocale` in `types.ts` — `normalizeLocale()` with `"en"` fallback — prompts in `groq.ts` (×6 locales). See `AGENTS.md § Conventions`.

## Import Convention

Always use `@/lib/<module>` path alias. See `AGENTS.md § Conventions`.
