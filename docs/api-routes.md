# API Route Patterns

## Runtime

All API routes must export `export const runtime = "nodejs"` — required for Upstash Redis SDK (uses Node crypto).

## Routes

| Route               | Method | Purpose                                                                                  |
| ------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `/api/search`       | GET    | Zod validate → rate-limit → cache check → DOJ proxy → dedupe → cache set → JSON response |
| `/api/summarize`    | POST   | Parse body → Groq streaming → SSE response                                               |
| `/api/deep-analyze` | POST   | Rate-limit → Zod validate → HMAC-sign → Render worker proxy → Groq deep summary → SSE    |

## SSE streaming format

All streaming responses use this exact format:

```
data: {"text":"chunk"}\n\n     ← content chunks
data: {"error":"msg"}\n\n      ← error mid-stream
data: [DONE]\n\n               ← termination signal
```

Client reads via `ReadableStream` reader in `ChatContainer.tsx` → `readSSE()` helper.

## Request validation

All external input goes through Zod schemas in `src/lib/validation.ts`:

- `searchSchema` — validates query string, from/size pagination
- `analyzeSchema` — validates HTTPS + justice.gov domain, fileName required
- `deepAnalyzeSchema` — same domain validation, used for deep-analyze route

URL validation enforces: HTTPS protocol only + `*.justice.gov` hostname (SSRF prevention).

## Rate limiting

- Search: 10 requests / 10 seconds per IP (`slidingWindow`)
- Analyze: 3 requests / 60 seconds per IP
- Graceful pass-through: if Redis unavailable, rate limiting is skipped (no hard failure)
- Client IP extraction: `getClientIp()` from `src/lib/ratelimit.ts` (x-forwarded-for aware)

## Caching

- Key format: `getCacheKey()` in `src/lib/doj-api.ts`
- TTL: 24 hours (86400s)
- Cache events tracked via `trackCacheEvent()`
- Graceful degradation: null return on Redis failure → fresh DOJ fetch
- Deduplication: `deduplicateDocuments()` removes duplicate chunks from DOJ results

## Error handling pattern

Every route:

1. Detects locale from query param or body
2. Looks up `ERROR_MESSAGES[locale]`
3. Returns localized error JSON with appropriate HTTP status
4. Production errors sanitized via `sanitizeError()` in `src/lib/security.ts`

## Adding a new API route

1. Create `src/app/api/{name}/route.ts`
2. Add `export const runtime = "nodejs"`
3. Declare `SupportedLocale` type and `normalizeLocale()` locally
4. Define `ERROR_MESSAGES` record for all 6 locales
5. Validate input with Zod schema (add to `src/lib/validation.ts`)
6. Add rate limiting if needed
7. Test with vitest in `tests/`
