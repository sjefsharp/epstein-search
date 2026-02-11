# Deployment

## Architecture

```
Vercel (Next.js app)  ──HMAC──▶  Render (Express worker)
       │                                │
       ▼                                ▼
  Upstash Redis                  Playwright + pdf-parse
  Neon Postgres                  (Docker container)
```

## Vercel (Next.js app)

- Config: `vercel.json` — standard `npm install` + `npm run build`
- Cron: consent cleanup runs daily via Vercel Cron (configured in `vercel.json`)
- Set all env vars in Vercel dashboard:

```
GROQ_API_KEY                        # Groq console
UPSTASH_REDIS_REST_URL              # Upstash dashboard
UPSTASH_REDIS_REST_TOKEN            # Upstash dashboard
WORKER_SHARED_SECRET                # shared with Render — HMAC auth
RENDER_WORKER_URL                   # Render service URL
NEON_DATABASE_URL                   # Neon Postgres connection string
CRON_SECRET                         # shared secret for cleanup cron
NEXT_PUBLIC_CONSENT_POLICY_VERSION  # semver (e.g. 1.0.0)
NEXT_PUBLIC_BASE_URL                # optional — canonical URL
NEXT_PUBLIC_BTC_ADDRESS             # optional — Bitcoin donation
NEXT_PUBLIC_ETH_ADDRESS             # optional — Ethereum donation
NEXT_PUBLIC_ADSENSE_ID              # optional — Google AdSense
```

## Render (worker)

- Config: `render.yaml` in repo root — Docker build from `worker/Dockerfile`
- Base image: `mcr.microsoft.com/playwright:v1.58.1-jammy`
- Region: Frankfurt, free tier
- Health check: `GET /health`
- Auto-deploy on push to `main`

```
WORKER_SHARED_SECRET   # REQUIRED — must match Vercel value
NODE_ENV=production    # required
PORT=10000             # Render default
ALLOWED_ORIGINS        # optional — comma-separated, defaults to Vercel app URL
```

## Deploy Order

1. Deploy worker to Render first (or simultaneously)
2. Copy Render worker URL
3. Set `RENDER_WORKER_URL` in Vercel env vars
4. Deploy Next.js app to Vercel
5. Verify: `curl <RENDER_WORKER_URL>/health` → `{"status":"healthy"}`

## Quick Reference

| Command                      | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `npm run build`              | Production build (Vercel runs this) |
| `npm run dev`                | Local dev server                    |
| `cd worker && npm run build` | Worker TypeScript compile           |
| `cd worker && npm run dev`   | Worker local dev with tsx           |

See [README.md](../README.md) for complete env var documentation.
See [worker.md](worker.md) for worker architecture details.
