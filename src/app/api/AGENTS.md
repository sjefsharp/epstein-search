# src/app/api/ — API Routes

Next.js App Router API route handlers. All follow the same structural pattern.

## TDD Rule

1. Extract business logic into `src/lib/` — test it in `tests/lib/`
2. For user-facing flows, add E2E tests in `tests/e2e/`
3. Unit test the logic → E2E test the integration → implement the route
4. Git workflow (required):

```powershell
git checkout -b <type>/<short-description>

npm run lint ; npm run typecheck ; npm run test:run
npm run test:e2e      # only if touching UI flows
npm run test:coverage # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%

git add -A
git commit -m "<type>: <description>"
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

## Route Inventory

| Route                  | Method   | Auth        | Rate Limit | Response   |
| ---------------------- | -------- | ----------- | ---------- | ---------- |
| `/api/search`          | GET/POST | none        | 10/10s     | JSON       |
| `/api/summarize`       | POST     | none        | none       | SSE stream |
| `/api/deep-analyze`    | POST     | none        | 3/60s      | SSE stream |
| `/api/consent`         | POST     | none        | 20/60s     | JSON       |
| `/api/consent/cleanup` | POST     | CRON_SECRET | none       | JSON       |

## Mandatory Pattern (every route)

```typescript
// Line 1: runtime directive
export const runtime = "nodejs"; // Required — Upstash SDK needs Node.js runtime

// Local type (duplicated per route — intentional, keeps routes self-contained)
type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

// Locale normalizer
function normalizeLocale(locale?: string): SupportedLocale {
  const supported: SupportedLocale[] = ["en", "nl", "fr", "de", "es", "pt"];
  if (!locale) return "en";
  const lower = locale.toLowerCase();
  const match = supported.find((l) => lower === l || lower.startsWith(l));
  return match ?? "en";
}

// Localized error messages — ALL 6 locales, route-specific keys
const ERROR_MESSAGES: Record<
  SupportedLocale,
  {
    /* ... */
  }
> = {
  /* ... */
};

// Handler
export async function POST(request: Request) {
  // 1. Rate-limit (graceful pass-through if Redis unavailable)
  // 2. Parse body → Zod validate
  // 3. Normalize locale from input
  // 4. Business logic
  // 5. Return Response or SSE stream
  // 6. Catch → sanitizeError() → localized error JSON
}
```

## SSE Streaming Pattern

```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    try {
      await doWork((text) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    } catch (error) {
      const message = sanitizeError(error);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      controller.close();
    }
  },
});
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

## Security Rules

- **Input validation**: Zod schema FIRST, before any business logic
- **Rate limiting**: use `checkRateLimit()` from `@/lib/ratelimit` — returns `{ success, limit, remaining, reset }`
- **SSRF**: validate URLs against `justice.gov` domain whitelist + HTTPS enforcement
- **Error responses**: always use `sanitizeError()` — never expose internals in production
- **HMAC signing**: worker requests signed with `createSignature()` from `@/lib/security`
- **SSE injection**: always `JSON.stringify()` SSE payloads — never interpolate raw input

## Cache Rules

- Search results: 24h TTL via `getCachedSearch()` / `setCachedSearch()` from `@/lib/cache`
- Cache is optional — all ops wrapped in try/catch, never block the response
- Cache key format: deterministic from query params

## Adding a New Route

1. Create `src/app/api/<name>/route.ts`
2. Add `export const runtime = "nodejs"`
3. Define `SupportedLocale`, `normalizeLocale()`, `ERROR_MESSAGES` (all 6 locales)
4. Add Zod schema to `src/lib/validation.ts`
5. Add rate limiter to `src/lib/ratelimit.ts` if needed
6. Write unit tests for business logic + E2E test if user-facing
7. Verify:

```powershell
npm run lint ; npm run typecheck ; npm run test:run
npm run test:e2e      # only if touching UI flows
npm run test:coverage # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%
```

8. Commit and push:

```powershell
git add -A
git commit -m "feat: add <name> route"
git push origin HEAD
```

9. Create PR and cleanup (see root [AGENTS.md](../../../AGENTS.md))

## Output Rules

Do NOT create new markdown files in the repo. Use `temp/` for scratch docs. See root [AGENTS.md](../../../AGENTS.md) for details.
