# API Route Patterns

## Runtime

All API routes must export `export const runtime = "nodejs"` — required for Upstash Redis SDK (uses Node crypto).

## Routes

| Route                    | Method   | Purpose                                                                                                         |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| `/api/search`            | GET/POST | Zod validate → rate-limit → Redis cache → **Neon cache** → DOJ proxy (fallback: worker) → dedupe → cache → JSON |
| `/api/summarize`         | POST     | Parse body → Groq streaming → SSE response                                                                      |
| `/api/deep-analyze`      | POST     | Rate-limit → Zod validate → HMAC-sign → Render worker proxy → Groq deep summary → SSE                           |
| `/api/consent`           | POST     | Rate-limit → Zod validate → Neon INSERT (consent log)                                                           |
| `/api/consent/cleanup`   | POST     | Cron-triggered → `CRON_SECRET` auth → delete expired consent records                                            |
| `/api/cron/refresh-docs` | GET/POST | Cron-triggered → `CRON_SECRET` auth → re-crawl DOJ metadata into Neon cache                                     |

## SSE Streaming Format

All streaming responses use this exact format:

```
data: {"text":"chunk"}\n\n     ← content chunks
data: {"error":"msg"}\n\n      ← error mid-stream
data: [DONE]\n\n               ← termination signal
```

Client reads via `ReadableStream` reader in `ChatContainer.tsx` → `readSSE()` helper.

## Request Validation

All external input goes through Zod schemas in `src/lib/validation.ts`:

- `searchSchema` — validates query string, from/size pagination
- `analyzeSchema` — validates HTTPS + justice.gov domain, fileName required
- `deepAnalyzeSchema` — same domain validation, used for deep-analyze route

URL validation enforces: HTTPS protocol only + `*.justice.gov` hostname (SSRF prevention).

## Rate Limiting

| Route               | Limit                           |
| ------------------- | ------------------------------- |
| `/api/search`       | 10 requests / 10 seconds per IP |
| `/api/deep-analyze` | 3 requests / 60 seconds per IP  |
| `/api/consent`      | 20 requests / 60 seconds per IP |

Graceful pass-through: if Redis unavailable, rate limiting is skipped (no hard failure).

Client IP extraction: `getClientIp()` from `src/lib/ratelimit.ts` (x-forwarded-for aware).

## Caching

- Key format: `getCacheKey()` in `src/lib/doj-api.ts`
- TTL: 24 hours (86400s)
- Graceful degradation: null return on Redis failure → fresh DOJ fetch
- Deduplication: `deduplicateDocuments()` removes duplicate chunks from DOJ results

## Error Handling Pattern

Every route:

1. Detects locale from query param or body
2. Looks up `ERROR_MESSAGES[locale]` (all 6 locales)
3. Returns localized error JSON with appropriate HTTP status
4. Production errors sanitized via `sanitizeError()` in `src/lib/security.ts`

## Adding a New API Route

1. Create `src/app/api/{name}/route.ts`
2. Add `export const runtime = "nodejs"`
3. Define `ERROR_MESSAGES` record for all 6 locales
4. Validate input with Zod schema (add to `src/lib/validation.ts`)
5. Add rate limiting if needed
6. Follow pattern in `api-route.instructions.md`
7. Test with vitest in `tests/`
