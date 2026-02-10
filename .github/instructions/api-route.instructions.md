---
applyTo: "src/app/api/**"
---

# API Route Instructions

## Mandatory Structure

Every API route file MUST follow this exact pattern:

```typescript
export const runtime = "nodejs";

type SupportedLocale = "en" | "nl" | "fr" | "de" | "es" | "pt";

function normalizeLocale(locale?: string): SupportedLocale {
  /* ... */
}

const ERROR_MESSAGES: Record<
  SupportedLocale,
  {
    // All error keys for this route, all 6 locales
  }
> = {
  /* ... */
};

export async function POST(request: Request) {
  try {
    // 1. Rate-limit
    // 2. Parse + validate with Zod
    // 3. Normalize locale
    // 4. Business logic
    // 5. Return Response
  } catch (error) {
    return Response.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
```

## Checklist

- [ ] `export const runtime = "nodejs"` on line 1 (after imports)
- [ ] `SupportedLocale` type defined locally
- [ ] `normalizeLocale()` function defined locally
- [ ] `ERROR_MESSAGES` record with ALL 6 locales
- [ ] Input validated with Zod schema from `@/lib/validation`
- [ ] Rate-limiting via `checkRateLimit()` from `@/lib/ratelimit` (if publicly accessible)
- [ ] `sanitizeError()` used in all catch blocks
- [ ] Cache check before expensive operations (if applicable)
- [ ] No `any` types
- [ ] No exposed internals in error responses

## SSE Routes (summarize, deep-analyze)

- Create `ReadableStream` with `TextEncoder`
- Each chunk: `data: ${JSON.stringify({ text })}\n\n`
- Stream terminator: `data: [DONE]\n\n`
- Error during stream: send error chunk then close
- Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

## Security

- HMAC-sign all worker requests with `createSignature()` from `@/lib/security`
- Validate URLs with Zod schema + `isAllowedJusticeGovHost()` for justice.gov whitelist
- Never log request bodies containing sensitive data

## Output Rules

- Do NOT create new markdown files (plans, implementation notes, fix logs) in the repo
- If scratch notes are needed, use the `temp/` folder (gitignored)
- Only modify existing `docs/*.md` files when documented behavior changes
- After completing the route, follow the full git workflow (branch → verify → commit → push → PR → cleanup) from [AGENTS.md](../../AGENTS.md)
- See also: [src/app/api/AGENTS.md](../../src/app/api/AGENTS.md) for route inventory and "Adding a New Route" checklist
