# worker/ — Express PDF Worker Service

Standalone Express 5 service deployed on Render (Docker). Fetches and parses PDF documents from justice.gov using Playwright + pdf-parse.

## TDD Rule

1. Write failing unit test in `tests/worker/<module>.test.ts`
2. Run `npm run test:run` from repo root — confirm red
3. Implement in `worker/src/` — confirm green
4. Worker has its own `package.json` — install deps with `cd worker ; npm install`
5. Verify, commit, and push:
   ```powershell
   npm run lint ; npm run typecheck ; npm run test:run
   git add -A ; git commit -m "feat: description" ; git push origin HEAD
   ```

## Architecture

```
worker/
├── src/
│   ├── index.ts        # Express app: routes + middleware + auth
│   └── shims.d.ts      # Type shims for pdf-parse
├── Dockerfile          # Multi-stage build (Node 20 + Playwright)
├── package.json        # Separate deps (express, playwright, pdf-parse)
└── tsconfig.json       # Separate TS config
```

## Endpoints

| Endpoint    | Method | Auth          | Rate Limit   | Purpose                          |
|-------------|--------|---------------|--------------|----------------------------------|
| `/health`   | GET    | none          | none         | Health check for Render          |
| `/`         | GET    | none          | none         | Service info                     |
| `/search`   | POST   | HMAC-SHA256   | 50/15min     | Browser-based DOJ search via Playwright |
| `/analyze`  | POST   | HMAC-SHA256   | 60/15min     | PDF fetch + parse via Playwright |

## HMAC Authentication

Every `/search` and `/analyze` request must include:
- `X-Worker-Signature` header (or `Authorization: Bearer <signature>`)
- Signature = HMAC-SHA256 of `JSON.stringify(req.body)` using `WORKER_SHARED_SECRET`
- Verification uses `crypto.timingSafeEqual()` — NEVER direct string comparison

## SSRF Protection

- `isAllowedJusticeGovHost(hostname)` validates all outbound URLs:
  - MUST be `justice.gov` or `*.justice.gov`
  - Blocks `localhost`, `127.0.0.1`, `::1`, `*.localhost`
  - Blocks all IP addresses via `net.isIP()`
- URL protocol MUST be `https:`

## Playwright Patterns

### /search — DOJ Search with Akamai Bypass
1. Launch headless Chromium
2. Visit `https://www.justice.gov/` first (acquires Akamai session cookies)
3. Wait 2s for bot-detection scripts
4. Execute XHR from page context (carries cookies)
5. Retry up to 3x with exponential backoff (1.5s × attempt)

### /analyze — PDF Fetch + Parse
1. Launch headless Chromium
2. Navigate to PDF URL
3. Handle age-verify interstitial (click through if present)
4. Extract cookies from browser context
5. Fetch PDF with cookies via `fetch()` (NOT Playwright)
6. Parse with `pdf-parse` → return text + metadata

## Middleware Stack

1. `helmet()` — security headers
2. Custom request logger (method, URL, status, duration)
3. `cors()` — configurable origins via `ALLOWED_ORIGINS` env var
4. `express.json({ limit: "2mb" })` — body parser

## Environment Variables

```
WORKER_SHARED_SECRET  # Required — HMAC shared secret
PORT                  # Optional — defaults to 3000
ALLOWED_ORIGINS       # Optional — comma-separated, defaults to Vercel app URL
```

## Type Patterns

- Rate limiters cast as `MiddlewareHandler` type alias (Express 5 overload compatibility)
- `pdf-parse` imported via `* as pdfParseModule` with ESM/CJS compatibility wrapper
- Request/Response types from `express` — do NOT use `express-serve-static-core`

## Output Rules

Do NOT create new markdown files in the repo. Use `temp/` for scratch docs. See root [AGENTS.md](../AGENTS.md) for details.
