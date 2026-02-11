# Worker Service

Standalone Express 5 server on Render that fetches and parses PDFs from justice.gov using Playwright (headless Chromium). Also provides a search fallback when the DOJ API is unreachable from Vercel.

## Why Separate?

Playwright needs a full browser binary — too large for Vercel serverless. Runs as Docker container on Render free tier.

## Endpoints

| Endpoint   | Method   | Auth | Purpose                                                      |
| ---------- | -------- | ---- | ------------------------------------------------------------ |
| `/`        | GET      | None | Service info (name, version, endpoints list)                 |
| `/health`  | GET      | None | Health check (Render + Docker HEALTHCHECK)                   |
| `/search`  | GET/POST | HMAC | Chromium → justice.gov search with Akamai cookies, 3 retries |
| `/analyze` | POST     | HMAC | Fetches PDF via Playwright, extracts text with pdf-parse     |

## Auth

HMAC-SHA256 signature in `X-Worker-Signature` or `Authorization: Bearer <sig>` — verified with `crypto.timingSafeEqual()`. See [security.md](security.md).

## Rate Limits

| Endpoint   | Limit                       |
| ---------- | --------------------------- |
| `/search`  | 50 requests / 15 min per IP |
| `/analyze` | 60 requests / 15 min per IP |

## SSRF Prevention

All outbound URLs validated by `isAllowedJusticeGovHost()` — allows only `*.justice.gov` over HTTPS. Blocks localhost, private IPs, and non-justice.gov domains.

## Playwright Patterns

- `/search`: Chromium → justice.gov (Akamai cookies, 2s wait) → XHR from page context → 3 retries (1.5s × n backoff)
- `/analyze`: Chromium → PDF URL → age-verify interstitial → cookies → `pdf-parse` → text + metadata

## Middleware

`helmet()` → request logger (method, URL, status, duration) → `cors()` (configurable origins) → `express.json({ limit: "2mb" })`

## Docker

- Base image: `mcr.microsoft.com/playwright:v1.58.1-jammy`
- Build: `npm ci → tsc → prune dev deps`
- Port: `10000` (Render default)
- Health check: HTTP GET to `/health` every 30s

## Config (`render.yaml`)

```yaml
services:
  - type: web
    name: epstein-worker
    runtime: docker
    region: frankfurt
    plan: free
    branch: main
    dockerfilePath: ./worker/Dockerfile
    dockerContext: ./worker
```

## Environment Variables

```
WORKER_SHARED_SECRET  # REQUIRED — HMAC shared secret (must match Vercel)
PORT                  # Optional — defaults to 10000 on Render, 3000 locally
ALLOWED_ORIGINS       # Optional — comma-separated, defaults to Vercel app URL
```

## Worker Package

Separate `worker/package.json` — independent dependency tree from main app. Build: `tsc`. Run: `node dist/index.js`. Dev: `tsx src/index.ts`.

If you change `worker/package.json`, run `cd worker && npm install` and commit `worker/package-lock.json`.

## Adding Worker Endpoints

1. Add route in `worker/src/index.ts`
2. HMAC-protect with `verifySignature()` middleware
3. Add corresponding proxy logic in a Vercel API route
4. Test auth in `tests/worker/`
