# src/app/api/ — API Routes

Next.js App Router API route handlers. All follow the same structural pattern.

## TDD Rule

1. Extract business logic into `src/lib/` — test it in `tests/lib/`
2. For user-facing flows, add E2E tests in `tests/e2e/`
3. Unit test the logic → E2E test the integration → implement the route

Git workflow: see `AGENTS.md § Git Workflow`

## Route Inventory

| Route                  | Method   | Auth        | Rate Limit | Response   |
| ---------------------- | -------- | ----------- | ---------- | ---------- |
| `/api/search`          | GET/POST | none        | 10/10s     | JSON       |
| `/api/summarize`       | POST     | none        | none       | SSE stream |
| `/api/deep-analyze`    | POST     | none        | 3/60s      | SSE stream |
| `/api/consent`         | POST     | none        | 20/60s     | JSON       |
| `/api/consent/cleanup` | POST     | CRON_SECRET | none       | JSON       |

## Mandatory Pattern

Every route follows the template in `api-route.instructions.md`:

`export const runtime = "nodejs"` → `SupportedLocale` + `normalizeLocale()` + `ERROR_MESSAGES` (×6) → Zod validate → rate-limit → business logic → Response or SSE stream → catch with `sanitizeError()`

## SSE Streaming

See `api-route.instructions.md § SSE Routes` for the canonical `ReadableStream` pattern:

- Each chunk: `data: ${JSON.stringify({ text })}\n\n`
- Terminator: `data: [DONE]\n\n`
- Error: send error chunk → close stream
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

## Security

See `security-review.instructions.md` — key rules:

- Zod schema FIRST, before any business logic
- Rate-limit via `checkRateLimit()` from `@/lib/ratelimit`
- SSRF: validate URLs against justice.gov whitelist + HTTPS
- `sanitizeError()` in all catch blocks
- HMAC-sign worker requests with `createSignature()`
- `JSON.stringify()` SSE payloads — never interpolate raw input

## Cache

Search results: 24h TTL via `getCachedSearch()` / `setCachedSearch()`. All ops try/catch — never blocks response. Key format: deterministic from query params.

## Adding a New Route

New route: `src/app/api/<name>/route.ts` → `export const runtime = "nodejs"` → `SupportedLocale` + `normalizeLocale()` + `ERROR_MESSAGES` (×6) → Zod schema in `validation.ts` → rate limiter in `ratelimit.ts` (if needed) → tests (lib + e2e) → verify → commit → PR

See `AGENTS.md § Git Workflow` for the full lifecycle.
