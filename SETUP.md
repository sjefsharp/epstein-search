# Epstein Search Project - Complete Setup Guide

## 🎯 What is This Project?

**Epstein Search** is a web application that enables users to search, read, and analyze the 2,000+ documents released by the U.S. Department of Justice related to the Jeffrey Epstein case.

**Features**:
- ✅ Full-text search via DOJ API
- ✅ AI-powered Dutch summaries (Groq Llama 3.3)
- ✅ PDF deep analysis with Playwright automation
- ✅ Real-time streaming responses
- ✅ Redis caching for fast results
- ✅ Free hosting (Vercel + Render)

---

## 📁 Project Structure

```
epstein/                ← Next.js Frontend (Vercel deployment)
├─ src/app/api/        ← API routes (search, summarize, deep-analyze)
├─ src/components/     ← Chat UI components
├─ src/lib/            ← Business logic (DOJ API, cache, Groq)
├─ worker/             ← Playwright PDF Worker (Render deployment)
│  ├─ src/index.ts     ← Express server + Playwright automation
│  ├─ Dockerfile       ← Container for Render
│  └─ DEPLOYMENT.md    ← Render deployment guide
├─ DEPLOYMENT.md       ← Vercel deployment guide
├─ IMPLEMENTATION_PLAN.md  ← Original architecture plan
└─ SETUP.md (this file)    ← Setup instructions
```

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+ with npm
- Git

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template (you already have .env.local)
# .env.local should already have:
# - GROQ_API_KEY
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
# - RENDER_WORKER_URL (will be set after worker deployment)

# 3. Start dev server
npm run dev

# 4. Open browser
# → http://localhost:3000
```

### Test Search
```bash
# Test fast search (works without worker)
curl "http://localhost:3000/api/search?q=epstein"

# Test summarization (works with Groq API key)
curl "http://localhost:3000/api/summarize" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"documents":[{"fileName":"test.pdf","content":"Lorem ipsum..."}],"searchTerm":"test"}'
```

---

## 📦 Production Deployment

### Phase 1: Deploy Frontend to Vercel

1. Enter `DEPLOYMENT.md`
2. Follow step-by-step guide
3. Get live URL: `https://your-project.vercel.app`

**Time**: 5-10 minutes

### Phase 2: Deploy Worker to Render

1. Enter `worker/DEPLOYMENT.md`
2. Deploy Express server to Render
3. Get URL: `https://epstein-worker.onrender.com`
4. Update `RENDER_WORKER_URL` in Vercel env vars

**Time**: 10-15 minutes

### Phase 3: Verify Links

- [ ] Frontend loads at Vercel URL
- [ ] Search works: `/{url}/api/search?q=test`
- [ ] Health check: `https://epstein-worker.onrender.com/health`
- [ ] Deep analysis works (all three components)

---

## 🔑 Environment Variables

### Obtained From:

| Variable | Source | Status |
|----------|--------|--------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | ✅ Set |
| `UPSTASH_REDIS_REST_URL` | Vercel KV dashboard | ✅ Set |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel KV dashboard | ✅ Set |
| `RENDER_WORKER_URL` | After Render deployment | ⏳ Set later |
| `NEXT_PUBLIC_BTC_ADDRESS` | Your wallet | ⏳ Optional |
| `NEXT_PUBLIC_ETH_ADDRESS` | Your wallet | ⏳ Optional |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense | ⏳ Optional |

### Development (.env.local)
Kept locally, **never committed** to Git.

### Production (Vercel Dashboard)
Entered in Vercel → Project Settings → Environment Variables.

---

## 🏗️ Architecture Deep Dive

### Data Flow: Fast Search

```
User Input "maxwell"
    ↓
Next.js /api/search
    ↓
Check Redis Cache (24h TTL)
    ├─ HIT  → Return cached results
    └─ MISS → Fetch from DOJ API
    ↓
DOJ API: https://www.justice.gov/multimedia-search
    ↓
Return documents + cache in Redis
    ↓
Stream to UI
```

### Data Flow: AI Summary

```
Fast Search Results
    ↓
Top 10 documents sent to /api/summarize
    ↓
Groq API (llama-3.3-70b-versatile)
    ↓
Stream chunks to UI in real-time
    ↓
User reads streaming Dutch summary
```

### Data Flow: Deep PDF Analysis

```
User clicks "Analyseer PDF"
    ↓
Next.js /api/deep-analyze
    ↓
POST to Render Worker: /analyze
    ↓
Worker (Playwright):
  1. Navigate to PDF URL
  2. Bypass age-verification gate
  3. Extract text (or parse PDF binary)
  4. Return raw text content
    ↓
Groq streams detailed analysis
    ↓
UI shows results
```

---

## 🔒 Security & Best Practices

### 1. API Keys
- ✅ Never commit `.env.local`
- ✅ Use Vercel environment variables for production
- ✅ Rotate keys if exposed

### 2. CORS & Rate Limiting
- ✅ DOJ API: Public (no auth needed)
- ✅ Groq API: Key-based (hidden from client)
- ✅ Redis: Upstash handles auth

### 3. Worker Service
- ✅ Headless browser (no UI)
- ✅ Timeout protection (30s max)
- ✅ Resource limits (512MB on Render free tier)

---

## 🐛 Troubleshooting

### "GROQ_API_KEY not found"
```bash
# Check .env.local exists
cat .env.local | grep GROQ_API_KEY

# If missing, add it
echo 'GROQ_API_KEY=gsk_...' >> .env.local
```

### "Redis connection failed"
```bash
# Test Redis manually
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-url.upstash.io/set/testkey/testvalue
```

### "Worker not responding"
```bash
# Check if Render deployment succeeded
curl https://epstein-worker.onrender.com/health

# Should return:
# {"status": "healthy", "service": "epstein-pdf-worker", "timestamp": "..."}
```

### "PDF analysis hangs"
- Render free tier has 512MB RAM + time limits
- Worker has 30s timeout
- Large PDFs may need chunking

---

## 📊 Monitoring

### Vercel Observability
- **Logs**: Vercel Dashboard → Deployments → Logs
- **Functions**: Check which API routes are slow
- **Errors**: Automatic Sentry integration (optional)

### Render Monitoring
- **Logs**: Render Dashboard → Logs
- **Health**: GET `/health` endpoint
- **Resource Usage**: Memory/CPU graphs

---

## 🎓 Learning Resources

- **Next.js**: [nextjs.org/learn](https://nextjs.org/learn)
- **Groq API**: [groq-sdk docs](https://github.com/groq/groq-python)
- **Upstash Redis**: [upstash.com/docs](https://upstash.com/docs)
- **Playwright**: [playwright.dev](https://playwright.dev)

---

## 📋 Checklist: From Development to Production

- [ ] Local dev server works (`npm run dev`)
- [ ] `.env.local` has all required keys
- [ ] Search API returns results
- [ ] Groq summarization works
- [ ] Git history cleaned (no secrets)
- [ ] Vercel deployment (see `DEPLOYMENT.md`)
- [ ] Worker deployment (see `worker/DEPLOYMENT.md`)
- [ ] Health checks pass
- [ ] Full end-to-end test (search → summarize → deep analyze)
- [ ] Custom domain setup (optional)
- [ ] Monitoring alerts (optional)

---

## 🆘 Support

If you encounter issues:

1. **Check logs**: Vercel/Render dashboards
2. **Review this guide**: Likely has the answer
3. **Test locally first**: `npm run dev`
4. **Review env vars**: Most issues are missing keys
5. **API docs**: DOJ, Groq, Upstash official sites

---

## 📝 Next Steps

1. ✅ Codebase cleanup ← You are here
2. → Deploy frontend to Vercel
3. → Deploy worker to Render
4. → Add monetization (AdSense, crypto)
5. → Add user accounts (Supabase)
6. → Launch marketing

---

**Happy deploying! 🚀**
