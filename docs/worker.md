# Worker Service

Standalone Express server on Render that fetches and parses PDFs from justice.gov using Playwright (headless Chromium).

## Why separate?

Playwright needs a full browser binary — too large for Vercel serverless. Runs as Docker container on Render free tier.

## Endpoints

| Endpoint   | Method | Auth | Purpose                                                                                    |
| ---------- | ------ | ---- | ------------------------------------------------------------------------------------------ |
| `/health`  | GET    | None | Health check (Render + Docker HEALTHCHECK)                                                 |
| `/analyze` | POST   | HMAC | Receives `{ fileUri, fileName }`, fetches PDF via Playwright, extracts text with pdf-parse |

## Auth

HMAC-SHA256 signature in `X-Worker-Signature` header or `Authorization: Bearer` — see [security.md](security.md).

## Tech

- `express` + `helmet` + `cors`
- `playwright` Chromium for PDF download (handles age-gate)
- `pdf-parse` for text extraction
- ESM/CJS dual import handling for pdf-parse

## Docker

- Base image: `mcr.microsoft.com/playwright:v1.40.0-jammy`
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

## Worker package

Separate `worker/package.json` — independent dependency tree from main app. Build: `tsc`. Run: `node dist/index.js`. Dev: `tsx src/index.ts`.

## Adding worker endpoints

1. Add route in `worker/src/index.ts`
2. HMAC-protect with `verifySignature()` middleware
3. Add corresponding proxy logic in a Vercel API route
4. Test auth in `tests/worker/`
