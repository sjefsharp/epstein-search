# Worker Deployment Guide

## ✅ Deployed via Render MCP

Your worker service is already deployed!

**Service Details:**

- **URL**: https://epstein-worker.onrender.com
- **Region**: Frankfurt
- **Plan**: Free (750 hours/month)
- **Auto-deploy**: Enabled (deploys on git push)

## Deployment Status

Check deployment status:

```bash
# Health check (wait until build completes)
curl https://epstein-worker.onrender.com/health

# Expected response:
# {"status":"healthy","service":"epstein-pdf-worker","timestamp":"..."}
```

## Build Process

The build command automatically:

1. `cd worker` - Navigate to worker directory
2. `npm install` - Install dependencies
3. `npx playwright install chromium --with-deps` - Install browser + dependencies
4. `npm run build` - Compile TypeScript

**Build time**: 5-10 minutes (first time)

## Monitoring

**Render Dashboard**: https://dashboard.render.com/web/srv-d61r9vsr85hc7399matg

View:

- Build logs
- Runtime logs
- Metrics (CPU, Memory)
- Environment variables

## Testing

Once deployed, test the `/analyze` endpoint:

```bash
curl -X POST https://epstein-worker.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"fileUri":"https://www.justice.gov/d9/2024-07/maxwell_001.pdf"}'
```

Expected response:

```json
{
  "text": "...extracted PDF content...",
  "pages": 42,
  "metadata": {
    "extractedAt": "2026-02-04T...",
    "source": "playwright-text-extraction"
  }
}
```

## Troubleshooting

### Build fails

- Check build logs in Render dashboard
- Verify `package.json` has correct dependencies
- Ensure Playwright version is compatible

### Worker times out

- Free tier has 512MB RAM
- Large PDFs may exceed limits
- Consider pagination or upgrading plan

### Age-gate bypass fails

- Worker tries multiple selectors automatically
- Some PDFs may not have age gates
- Check runtime logs for details

## Updates

Push to GitHub `main` branch to trigger automatic redeployment:

```bash
git add .
git commit -m "Update worker"
git push origin main
# Render auto-deploys in 2-5 minutes
```

## Environment Variables

No secrets needed for worker. Optional:

- `PORT` - Auto-set by Render (default: 10000)
- `NODE_ENV` - Set to `production`

## Next Steps

1. ✅ Worker deployed
2. ✅ URL configured in `.env.local`
3. → Wait for build to complete (5-10 min)
4. → Test health endpoint
5. → Deploy Next.js app to Vercel
6. → Test full flow (search → summarize → deep analyze)
