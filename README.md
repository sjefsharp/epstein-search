# Epstein Search

AI-powered search and analysis tool for 2,000+ DOJ documents related to the Jeffrey Epstein case. Search, summarize, and deep-analyze court filings via a chat UI with real-time SSE streaming.

## Features

- **Full-text search** via DOJ API with Redis caching and deduplication
- **AI summaries** powered by Groq (Llama 3.3 70B) in 6 languages (en, nl, fr, de, es, pt)
- **PDF deep analysis** — Playwright extracts text from justice.gov PDFs, then AI summarizes
- **Real-time streaming** via Server-Sent Events (SSE)
- **Consent logging** to Neon Postgres with GDPR-aligned retention
- **Age verification gate** and cookie consent banner
- **Responsive UI** with dark mode, breadcrumbs, and mobile navigation

## Tech Stack

| Layer     | Tech                                            |
| --------- | ----------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling   | Tailwind CSS 4, shadcn/ui (new-york)            |
| AI        | Groq SDK → Llama 3.3 70B                        |
| Cache     | Upstash Redis                                   |
| DB        | Neon Postgres (consent logs)                    |
| Worker    | Express 5 + Playwright + pdf-parse (Docker)     |
| i18n      | next-intl — 6 locales                           |
| State     | Zustand (persisted to localStorage)             |
| Testing   | Vitest (unit) + Playwright (E2E)                |
| Deploy    | Vercel (app) + Render (worker)                  |

## Quick Start

```bash
git clone https://github.com/sjefsharp/epstein-search.git
cd epstein-search
npm install
cp .env.local.example .env.local   # then fill in values below
npm run dev                         # http://localhost:3000
```

## Environment Variables

| Variable                             | Required | Source                                       |
| ------------------------------------ | -------- | -------------------------------------------- |
| `GROQ_API_KEY`                       | Yes      | [console.groq.com](https://console.groq.com) |
| `UPSTASH_REDIS_REST_URL`             | Yes      | Upstash dashboard                            |
| `UPSTASH_REDIS_REST_TOKEN`           | Yes      | Upstash dashboard                            |
| `WORKER_SHARED_SECRET`               | Yes      | Shared between Vercel + Render (HMAC auth)   |
| `RENDER_WORKER_URL`                  | Yes      | Render service URL after deploying worker    |
| `NEON_DATABASE_URL`                  | Yes      | Neon Postgres connection string              |
| `CRON_SECRET`                        | Yes      | Shared secret for consent cleanup endpoint   |
| `NEXT_PUBLIC_CONSENT_POLICY_VERSION` | Yes      | Semver (e.g. `1.0.0`)                        |
| `NEXT_PUBLIC_BASE_URL`               | No       | Canonical URL (defaults to Vercel URL)       |
| `NEXT_PUBLIC_BTC_ADDRESS`            | No       | Bitcoin donation address                     |
| `NEXT_PUBLIC_ETH_ADDRESS`            | No       | Ethereum donation address                    |
| `NEXT_PUBLIC_ADSENSE_ID`             | No       | Google AdSense publisher ID                  |

## Documentation

| Topic      | File                                               |
| ---------- | -------------------------------------------------- |
| Deployment | [docs/deployment.md](docs/deployment.md)           |
| API routes | [docs/api-routes.md](docs/api-routes.md)           |
| Components | [docs/components.md](docs/components.md)           |
| Testing    | [docs/testing.md](docs/testing.md)                 |
| Worker     | [docs/worker.md](docs/worker.md)                   |
| Security   | [docs/security.md](docs/security.md)               |
| i18n       | [docs/i18n.md](docs/i18n.md)                       |
| Consent    | [docs/consent-logging.md](docs/consent-logging.md) |

For AI agent instructions, see [AGENTS.md](AGENTS.md).

## License

MIT
