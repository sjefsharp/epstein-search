# src/lib/ — Core Business Logic

Pure utility modules shared by API routes, components, and the worker.

## TDD Rule

Every new function gets a unit test BEFORE implementation:
1. Create `tests/lib/<module>.test.ts`
2. Write failing test → `npm run test:run` → confirm red
3. Implement minimum code → confirm green
4. Refactor → re-run tests
5. Verify, commit, and push:
   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   git add -A ; git commit -m "feat: description" ; git push origin HEAD
   ```

## Module Inventory

| Module          | Purpose                          | Lazy Init | Graceful Degrade |
|-----------------|----------------------------------|-----------|------------------|
| `types.ts`      | Shared TypeScript types/interfaces| n/a       | n/a              |
| `validation.ts` | Zod schemas for all external input| n/a       | n/a              |
| `security.ts`   | HMAC, timing-safe, sanitizeError | n/a       | n/a              |
| `groq.ts`       | Groq client + locale prompts     | ✅        | ❌ (throws)       |
| `cache.ts`      | Upstash Redis cache (24h TTL)    | ✅        | ✅ (returns null)  |
| `ratelimit.ts`  | Upstash rate limiters            | ✅        | ✅ (pass-through)  |
| `doj-api.ts`    | DOJ API proxy + dedup            | n/a       | ❌ (throws)       |
| `db.ts`         | Neon Postgres pool               | ✅        | ❌ (throws)       |
| `consent.ts`    | GDPR consent logic (client-side) | n/a       | n/a              |
| `utils.ts`      | `cn()` Tailwind merge helper     | n/a       | n/a              |

## Patterns

### Lazy Initialization

External clients MUST use lazy init to avoid build-time env errors:

```typescript
let client: ClientType | null = null;
function getClient(): ClientType {
  if (!client) {
    client = new ClientType({ apiKey: process.env.API_KEY! });
  }
  return client;
}
```

### Graceful Degradation

Cache and rate-limit modules MUST never throw. Wrap all operations in try/catch and return null or pass-through on failure. This allows the app to function without Redis.

### Zod Validation

- All external input MUST go through a Zod schema before use
- Schemas live in `validation.ts` — add new schemas here, never inline
- Use `schema.safeParse()` for validation — check `.success` boolean before accessing `.data`
- Keep schemas strict: whitelist chars via regex, enforce min/max lengths, validate URLs

### Error Handling

- Use `sanitizeError(error)` from `security.ts` in all production error responses
- Throw `DojApiError` (from `doj-api.ts`) for DOJ API failures with statusCode
- NEVER expose stack traces, internal paths, or env var names in error responses

### Security Functions

- `createSignature(payload, secret)` → HMAC-SHA256 hex digest
- `verifyTimingSafe(provided, expected)` → timing-safe comparison with length guard
- `enforceHttps(url)` → throws if not HTTPS in production
- `sanitizeError(error)` → generic message in production, detailed in development

### Localization

- `SupportedLocale` type defined in `types.ts`
- `normalizeLocale(input)` normalizes to `SupportedLocale` with `"en"` fallback
- `SUMMARY_PROMPTS` and `DEEP_ANALYSIS_PROMPTS` in `groq.ts` — one per locale
- When adding a locale-dependent feature, provide all 6 locales

## Import Convention

Always use `@/lib/<module>` path alias:

```typescript
import { searchSchema } from "@/lib/validation";
import { createSignature } from "@/lib/security";
import type { SupportedLocale } from "@/lib/types";
```

## Output Rules

Do NOT create new markdown files in the repo. Use `temp/` for scratch docs. See root [AGENTS.md](../../AGENTS.md) for details.
