# Epstein Search

AI-powered search and analysis tool for the 2,000+ DOJ documents related to the Jeffrey Epstein case.

## Features

- ✅ **Full-text search** via DOJ API
- ✅ **AI summaries** in Dutch (Groq Llama 3.3)
- ✅ **PDF deep analysis** with Playwright automation
- ✅ **Real-time streaming** responses
- ✅ **Redis caching** for fast results
- ✅ **Free hosting** on Vercel + Render

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
GROQ_API_KEY=                    # Get from console.groq.com
UPSTASH_REDIS_REST_URL=          # Get from Vercel KV dashboard
UPSTASH_REDIS_REST_TOKEN=        # Get from Vercel KV dashboard
RENDER_WORKER_URL=               # Set after deploying worker
```

## Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Vercel deployment
- **[worker/DEPLOYMENT.md](worker/DEPLOYMENT.md)** - Worker deployment

## Tech Stack

- **Frontend**: Next.js 16 + React 19
- **AI**: Groq (Llama 3.3)
- **Cache**: Upstash Redis
- **Worker**: Express + Playwright
- **Hosting**: Vercel (frontend) + Render (worker)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
