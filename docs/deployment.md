# Deployment

## Vercel (Next.js app)

- Config: `vercel.json` — standard `npm install` + `npm run build`
- Environment: set all env vars in Vercel dashboard (see root AGENTS.md)
- `RENDER_WORKER_URL` must point to deployed Render service URL
- `NEXT_PUBLIC_BASE_URL` optional, defaults to `https://epstein-search.vercel.app`

## Render (worker)

- Config: `render.yaml` in repo root
- Docker build from `worker/Dockerfile`
- Region: Frankfurt, free tier
- Health check: `/health` endpoint
- Env vars: `NODE_ENV=production`, `PORT=10000`, `WORKER_SHARED_SECRET` (must match Vercel)

## Deploy order

1. Deploy worker to Render first (or simultaneously)
2. Copy Render worker URL
3. Set `RENDER_WORKER_URL` in Vercel env vars
4. Deploy Next.js app to Vercel

## Env var checklist

```
Vercel:                          Render:
  GROQ_API_KEY          ✓         WORKER_SHARED_SECRET  ✓
  UPSTASH_REDIS_REST_URL  ✓       NODE_ENV=production   ✓
  UPSTASH_REDIS_REST_TOKEN ✓      PORT=10000            ✓
  WORKER_SHARED_SECRET    ✓
  RENDER_WORKER_URL       ✓
  NEXT_PUBLIC_BASE_URL    (optional)
```
