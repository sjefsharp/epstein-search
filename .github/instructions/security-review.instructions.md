---
applyTo: "src/lib/security.ts,src/lib/validation.ts,src/app/api/**,worker/**"
---

# Security Review Checklist

Run this checklist for every change to security-sensitive files.

## Input Validation (OWASP A03)

- [ ] All user input validated with Zod schemas from `src/lib/validation.ts`
- [ ] `sanitizeError()` used in every catch block (no raw error leaks in prod)
- [ ] No `eval()`, `new Function()`, or `dangerouslySetInnerHTML` (except pre-sanitized DOJ highlights)

## Authentication & Authorization (OWASP A07)

- [ ] Worker auth: HMAC-SHA256 via `WORKER_SHARED_SECRET` → `verifyTimingSafe()` — NEVER `===`
- [ ] Rate limiters applied: search 10/10s, analyze 3/60s, consent 20/60s
- [ ] Rate-limit graceful degradation: pass-through if Redis unavailable — never throw

## SSRF Prevention (OWASP A10)

- [ ] All outbound URLs validated by `isAllowedJusticeGovHost()` — justice.gov + HTTPS only
- [ ] Blocks localhost, private IPs, non-justice.gov domains

## SSE Injection Prevention

- [ ] All SSE data: `data: ${JSON.stringify({ text })}\n\n` — never interpolate user input
- [ ] Stream terminated with `data: [DONE]\n\n`

## Secrets & Config

- [ ] No secrets in source — env vars via `process.env` with lazy init
- [ ] No `console.log` of secrets, tokens, or PII
- [ ] HMAC signatures never logged

## Locale Safety

- [ ] `normalizeLocale()` applied — returns `SupportedLocale`, never raw user string
- [ ] `ERROR_MESSAGES` has entries for all 6 locales
