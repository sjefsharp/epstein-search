# Epstein Search - Vercel Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│          VERCEL (Next.js Frontend)                  │
│  - /api/search → DOJ API proxy + caching           │
│  - /api/summarize → Groq AI streaming              │
│  - /api/deep-analyze → Render Worker proxy         │
│  - Chat UI with real-time streaming                │
└─────────────────────────────────────────────────────┘
         ↓                              ↓
    DOJ API              UPSTASH REDIS   GROQ AI
  (Data Source)         (Cache Layer)   (Summarization)
         ✓                    ✓             ✓
         
    ┌────────────────────────────────────────────┐
    │  RENDER (Worker Service - Separate Deploy) │
    │  - POST /analyze → Playwright PDF parse   │
    │  - Age-gate bypass automation             │
    │  - PDF text extraction                    │
    └────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### 1. Environment Variables Ready
```bash
✓ GROQ_API_KEY=gsk_... (from console.groq.com)
✓ UPSTASH_REDIS_REST_URL=https://... (from Vercel KV)
✓ UPSTASH_REDIS_REST_TOKEN=... (from Vercel KV)
? RENDER_WORKER_URL=... (set AFTER worker deploys)
```

### 2. Local Testing
```bash
cd epstein
npm install
npm run dev
# Test: http://localhost:3000/api/search?q=test
```

### 3. Git Cleanup
```bash
# Ensure secrets are NOT in .git history
git rm --cached .env.local  # Remove from tracking
git status # Should show no .env.local
```

---

## Step-by-Step Deployment

### Step 1: Connect GitHub to Vercel

1. Visit [vercel.com](https://vercel.com)
2. Sign in / Create account
3. Click **Add New** → **Project**
4. **Import Git Repository**
   - Select your GitHub repo containing `epstein` folder
   - Click **Import**

### Step 2: Configure Project

| Setting | Value |
|---------|-------|
| **Project Name** | `epstein-search` |
| **Framework Preset** | Next.js |
| **Root Directory** | `.` (root) |
| **Build Command** | `npm run build` |
| **Install Command** | `npm install` |
| **Output Directory** | `.next` |

### Step 3: Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```
Name: GROQ_API_KEY
Value: gsk_...
Environments: Production, Preview, Development
```

Repeat for:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RENDER_WORKER_URL` (placeholder: `https://epstein-worker.onrender.com`)

### Step 4: Deploy

Click **Deploy** → Vercel will:
1. Clone repo
2. Run `npm install`
3. Run `npm run build`
4. Deploy to production
5. Assign URL: `https://epstein-*.vercel.app`

---

## Post-Deployment Steps

### Step 1: Test Frontend

```bash
# Should be live after 2-3 minutes
https://your-project.vercel.app

# Test endpoints:
curl https://your-project.vercel.app/api/search?q=yfke
curl https://your-project.vercel.app/api/search?q=maxwell
```

### Step 2: Update Worker URL

If worker is NOT yet deployed to Render:
1. Leave `RENDER_WORKER_URL=https://epstein-worker.onrender.com` (placeholder)
2. Deep analysis feature will show friendly error until worker is live

Once worker IS live on Render:
1. Get URL: `https://epstein-worker.onrender.com`
2. Update in Vercel Environment Variables: `RENDER_WORKER_URL`
3. Redeploy (or it auto-updates for new deployments)

### Step 3: Monitor

**Vercel Observability**:
- Dashboard → **Analytics** → Function duration, invocations
- Dashboard → **Logs** → Real-time function logs
- Check for errors in `/api/*` endpoints

---

## Troubleshooting

### "GROQ_API_KEY is not set"
→ Verify env var in Vercel dashboard  
→ Redeploy after adding

###  "Upstash connection failed"  
→ Test Redis manually:
```bash
curl -X POST \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  https://your-url.upstash.io/set/testkey/testvalue
```

### "Worker not responding"
→ Deploy worker to Render FIRST (see `worker/DEPLOYMENT.md`)  
→ Get live URL  
→ Update `RENDER_WORKER_URL` env var

### "PDFs not parsing in /api/deep-analyze"
→ Check worker logs in Render dashboard  
→ Ensure worker is running: `curl https://epstein-worker.onrender.com/health`  
→ Test with simpler PDF URLs first

---

## Performance Optimization

### Caching Strategy
- **Search results**: 24 hours (Redis)
- **PDF analysis**: No caching (each fresh)
- **Groq responses**: Streamed in real-time

### Rate Limiting (Optional Future)
```typescript
// In /api/search/route.ts
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 h"),
});

const { success } = await ratelimit.limit(request.ip);
if (!success) return Response.json({ error: "Rate limited" }, { status: 429 });
```

### Cold Start Optimization
- Node.js 20.x runtime ✓
- API functions optimized for quick response
- Groq streaming prevents timeout on large summaries

---

## Monitoring & Alerts (Optional)

### Sentry Integration (Error Tracking)
```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## Rollback

If something breaks after deployment:

1. **Revert commit**: `git revert <commit>`
2. **Push**: `git push origin main`
3. **Vercel auto-redeploys** the previous version

---

## Next Steps

1. Deploy to Vercel (this guide)
2. Deploy worker to Render (`worker/DEPLOYMENT.md`)
3. Add Google AdSense (monetization)
4. Setup monitoring/alerts
5. Custom domain setup
