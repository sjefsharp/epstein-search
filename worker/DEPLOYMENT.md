# Worker Deployment Guide

## Deployed via Render

- **URL**: https://epstein-worker.onrender.com
- **Region**: Frankfurt
- **Plan**: Free (750 hours/month)
- **Auto-deploy**: Enabled (deploys on push to `main`)

## Health Check

```bash
curl https://epstein-worker.onrender.com/health
# {"status":"healthy","service":"epstein-pdf-worker","timestamp":"..."}
```

## Build Process

Automatic on deploy:

1. `cd worker` → `npm install` → `npx playwright install chromium --with-deps` → `npm run build`
2. Build time: 5–10 minutes (first deploy)

## Environment Variables

| Variable               | Required | Purpose                                                                                          |
| ---------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `WORKER_SHARED_SECRET` | **Yes**  | HMAC shared secret — must match Vercel value. Without this, all authenticated requests will 401. |
| `NODE_ENV`             | Yes      | Set to `production`                                                                              |
| `PORT`                 | Auto     | Set by Render (default: `10000`)                                                                 |
| `ALLOWED_ORIGINS`      | No       | Comma-separated CORS origins (defaults to Vercel app URL)                                        |

## Testing

Test the `/analyze` endpoint (requires HMAC signature):

```bash
# Generate HMAC signature for the request body
BODY='{"fileUri":"https://www.justice.gov/d9/2024-07/maxwell_001.pdf"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WORKER_SHARED_SECRET" | awk '{print $2}')

curl -X POST https://epstein-worker.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -H "X-Worker-Signature: $SIG" \
  -d "$BODY"
```

## Troubleshooting

| Issue                 | Fix                                                                            |
| --------------------- | ------------------------------------------------------------------------------ |
| Build fails           | Check build logs in Render dashboard — verify Playwright version compatibility |
| 401 on all requests   | `WORKER_SHARED_SECRET` not set or doesn't match Vercel value                   |
| Worker times out      | Free tier has 512MB RAM — large PDFs may exceed limits                         |
| Age-gate bypass fails | Worker tries multiple selectors automatically — check runtime logs             |

## Monitoring

View build logs, runtime logs, and metrics in the [Render dashboard](https://dashboard.render.com).

See [docs/worker.md](../docs/worker.md) for architecture details and [docs/deployment.md](../docs/deployment.md) for full deploy order.
