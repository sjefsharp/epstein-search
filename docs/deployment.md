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
WORKER_URL                          # Worker service URL
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
WORKER_SHARED_SECRET      # REQUIRED — must match Vercel value
NODE_ENV=production       # required
PORT=10000                # Render default
ALLOWED_ORIGINS           # optional — comma-separated, defaults to Vercel app URL
PROXY_URL                 # optional — HTTP proxy to bypass Akamai IP blocks
PREWARM_INTERVAL_MINUTES  # optional — defaults to 0 (disabled) when PROXY_URL set
```

## Deploy Order

1. Deploy worker to Render first (or simultaneously)
2. Copy Render worker URL
3. Set `WORKER_URL` in Vercel env vars
4. Deploy Next.js app to Vercel
5. Verify: `curl <WORKER_URL>/health` → `{"status":"healthy"}`

## Keep-Alive (Preventing Cold Starts)

Neon Postgres (free tier) suspends compute after ~5 min idle, and Render (free tier) spins down after ~15 min. A `/api/keep-alive` endpoint pings both services to prevent cold starts.

- **Vercel cron**: `vercel.json` includes an hourly cron (`0 * * * *`) hitting `/api/keep-alive` — this is the Hobby plan maximum.
- **External monitor (recommended)**: Use [UptimeRobot](https://uptimerobot.com/) (free, 5-min intervals) or [cron-job.org](https://cron-job.org/) to ping the keep-alive endpoint every 5 minutes.
- **No auth required**: The endpoint is read-only and returns no sensitive data — safe to expose publicly.
- **Upstash Redis**: No keep-alive needed — HTTP REST API with no cold start.

### External monitor setup (UptimeRobot)

1. Create an account at [uptimerobot.com](https://uptimerobot.com/)
2. Add a new HTTP(S) monitor:
   - URL: `https://<your-domain>/api/keep-alive`
   - Monitoring interval: 5 minutes
3. Save — both Neon and Render will stay warm

## Quick Reference

| Command                      | Purpose                             |
| ---------------------------- | ----------------------------------- |
| `npm run build`              | Production build (Vercel runs this) |
| `npm run dev`                | Local dev server                    |
| `cd worker && npm run build` | Worker TypeScript compile           |
| `cd worker && npm run dev`   | Worker local dev with tsx           |

See [README.md](../README.md) for complete env var documentation.
See [worker.md](worker.md) for worker architecture details.
