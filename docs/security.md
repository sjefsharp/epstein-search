# Security Model

## Worker authentication (HMAC-SHA256)

Request flow: Vercel API → HMAC-sign body → POST to Render worker → worker verifies signature.

```
Signing:   crypto.createHmac('sha256', WORKER_SHARED_SECRET).update(JSON.stringify(body)).digest('hex')
Header:    X-Worker-Signature: {hex}
Verify:    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
```

- Shared secret: `WORKER_SHARED_SECRET` env var (same on both Vercel and Render)
- Signing code: `generateWorkerSignature()` in `src/lib/security.ts`
- Verification: `verifyWorkerSignature()` — constant-time compare, returns false on length mismatch
- Worker also accepts `Authorization: Bearer {signature}` as fallback

## Input validation (SSRF prevention)

All user-supplied URLs validated via Zod refine:

- Protocol must be `https:`
- Hostname must end with `.justice.gov` or equal `justice.gov`
- Separate `enforceHttps()` utility in security.ts

## Rate limiting

See [api-routes.md](api-routes.md#rate-limiting).

## Security middleware (worker)

Worker uses:

- `helmet()` — secure HTTP headers
- `cors()` — origin restricted to `ALLOWED_ORIGINS` or `https://epstein-kappa.vercel.app`
- JSON body limit: 2MB
- No port or path traversal exposed

## Error sanitization

`sanitizeError(error, isDevelopment)`:

- Development: returns `error.message`
- Production: returns generic "An error occurred while processing your request"
- Never exposes stack traces in production
