# worker/ — Express PDF Worker Service

Standalone Express 5 service deployed on Render (Docker). Fetches and parses PDF documents from justice.gov using Playwright + pdf-parse.

## TDD Rule

1. Write failing unit test in `tests/worker/<module>.test.ts`
2. Run `npm run test:run` from repo root — confirm red
3. Implement in `worker/src/` — confirm green
4. Worker has its own `package.json` — install deps with `cd worker && npm install`

Git workflow: see `AGENTS.md § Git Workflow`

## Dependency Management

- `worker/` has its own `package.json` + `package-lock.json`, separate from root.
- If you add/update/remove deps: `cd worker && npm install` → commit updated `worker/package-lock.json`
- Docker uses `npm ci` — lockfile drift = build failure
- Optional preflight: `cd worker && npm ci --dry-run` to confirm parity

## Architecture

```
worker/
├── src/index.ts        # Express app: routes + middleware + auth
├── src/shims.d.ts      # Type shims for pdf-parse
├── Dockerfile          # Multi-stage build (Node 20 + Playwright)
├── package.json        # Separate deps (express, playwright, pdf-parse)
└── tsconfig.json       # Separate TS config
```

## Endpoints

| Endpoint   | Method | Auth        | Rate Limit | Purpose                                 |
| ---------- | ------ | ----------- | ---------- | --------------------------------------- |
| `/health`  | GET    | none        | none       | Health check for Render                 |
| `/`        | GET    | none        | none       | Service info                            |
| `/search`  | POST   | HMAC-SHA256 | 50/15min   | Browser-based DOJ search via Playwright |
| `/analyze` | POST   | HMAC-SHA256 | 60/15min   | PDF fetch + parse via Playwright        |

## HMAC Authentication

Signature = HMAC-SHA256 of `JSON.stringify(req.body)` using `WORKER_SHARED_SECRET`. Sent via `X-Worker-Signature` or `Authorization: Bearer <sig>`. Verified with `crypto.timingSafeEqual()` — NEVER direct `===`.

## SSRF Protection

`isAllowedJusticeGovHost(hostname)`: MUST be `justice.gov` or `*.justice.gov`, HTTPS only. Blocks localhost, `127.0.0.1`, `::1`, all IPs via `net.isIP()`.

## Playwright Patterns

- `/search`: Chromium → justice.gov (Akamai cookies, 2s wait) → XHR from page context → 3 retries (1.5s × n backoff)
- `/analyze`: Chromium → PDF URL → age-verify interstitial → cookies → `pdf-parse` → text + metadata

## Middleware

`helmet()` → request logger (method, URL, status, duration) → `cors()` (configurable origins) → `express.json({ limit: "2mb" })`

## Environment Variables

```
WORKER_SHARED_SECRET  # Required — HMAC shared secret
PORT                  # Optional — defaults to 3000
ALLOWED_ORIGINS       # Optional — comma-separated, defaults to Vercel app URL
```
