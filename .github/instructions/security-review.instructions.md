---
applyTo: "src/lib/security.ts,src/lib/validation.ts,src/app/api/**,worker/**"
---

# Security Review Instructions

OWASP-focused review checklist specific to Epstein Search's attack surface.

## When to Run

Run this checklist before every commit that touches `src/lib/security.ts`, `src/lib/validation.ts`, `src/app/api/**`, or `worker/**`. After completing the review, follow the standard commit & push workflow from [AGENTS.md](../../AGENTS.md#git-workflow).

## A01: Broken Access Control

- [ ] Worker endpoints verify HMAC signature before processing
- [ ] `verifyTimingSafe()` used (never `===` for secret comparison)
- [ ] CRON endpoints verify `CRON_SECRET` before executing
- [ ] No authentication bypass via missing early-return

## A03: Injection

- [ ] All external input validated through Zod schemas BEFORE use
- [ ] Search queries restricted by regex whitelist: `^[a-zA-Z0-9\s\-._]+$`
- [ ] SSE chunks use `JSON.stringify()` — no template literal interpolation of user input
- [ ] `dangerouslySetInnerHTML` used ONLY for pre-sanitized DOJ highlights
- [ ] No `eval()`, `new Function()`, `vm.runInNewContext()`

## A05: Security Misconfiguration

- [ ] `export const runtime = "nodejs"` on every API route
- [ ] Helmet applied on worker (security headers)
- [ ] CORS restricted to allowed origins (not `*`)
- [ ] `sanitizeError()` used in production error responses
- [ ] No secrets in logs, responses, or client-side code

## A07: SSRF (Server-Side Request Forgery)

- [ ] All user-provided URLs validated against justice.gov domain whitelist
- [ ] HTTPS protocol enforced (`url.protocol === "https:"`)
- [ ] `isAllowedJusticeGovHost()` blocks: localhost, `127.0.0.1`, `::1`, IPs, non-justice.gov
- [ ] URL validation happens at BOTH Zod schema level AND runtime level
- [ ] Worker uses validated `safeUrl` (not raw `fileUri`) for all outbound requests

## A08: Software and Data Integrity

- [ ] Worker requests authenticated via HMAC-SHA256 with per-request signature
- [ ] `WORKER_SHARED_SECRET` never logged or exposed
- [ ] Timing-safe comparison prevents timing attacks on signatures
- [ ] `crypto.timingSafeEqual()` uses Buffer length guard (prevents length leak)

## A09: Logging and Monitoring

- [ ] Security-relevant events logged (auth failures, rate-limit hits, validation failures)
- [ ] No secrets, tokens, or PII in log output
- [ ] Worker logs request method, URL, status, and duration (not body)

## Rate Limiting

- [ ] Search: 10 requests per 10 seconds (sliding window)
- [ ] Analyze: 3 requests per 60 seconds (sliding window)
- [ ] Consent: 20 requests per 60 seconds (sliding window)
- [ ] Rate limiters degrade gracefully (pass-through when Redis unavailable)
- [ ] 429 responses include `Retry-After` header

## Regex Safety

- [ ] No unsafe regex patterns (enforced by `eslint-plugin-security`)
- [ ] IP detection uses `net.isIP()` — not custom regex
- [ ] RegExp objects hoisted outside loops

## Generated Files

- [ ] No new documentation files created outside `temp/` or existing `docs/` structure
