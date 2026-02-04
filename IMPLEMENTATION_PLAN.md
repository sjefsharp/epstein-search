# DOJ Epstein Files Agent - Implementation Plan

## Project Doel

Conversationele zoek-app voor DOJ Epstein documenten met AI-samenvattingen, gratis hosting, en inkomsten via advertenties en crypto-donaties.

---

## Architectuur Overzicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (Gratis)                         │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Frontend          │  API Routes                       │
│  ┌───────────────────┐     │  ┌─────────────────────────────┐  │
│  │ Chat UI (React)   │     │  │ /api/search                 │  │
│  │ - Zustand state   │────▶│  │ → DOJ API → Vercel KV cache │  │
│  │ - localStorage    │     │  └─────────────────────────────┘  │
│  │ - AdSense         │     │  ┌─────────────────────────────┐  │
│  │ - Donatie QR      │────▶│  │ /api/summarize              │  │
│  └───────────────────┘     │  │ → Groq Llama 3.3 (stream)   │  │
│                            │  └─────────────────────────────┘  │
│                            │  ┌─────────────────────────────┐  │
│                            │  │ /api/deep-analyze           │  │
│                            │  │ → Proxy naar Render Worker  │  │
│                            │  └──────────────┬──────────────┘  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER.COM (750u gratis)                    │
├─────────────────────────────────────────────────────────────────┤
│  PDF Worker Service (Node.js + Playwright)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ POST /analyze                                            │   │
│  │ 1. Playwright headless → Auto age-verify                 │   │
│  │ 2. Download PDF van DOJ                                  │   │
│  │ 3. Parse met pdf-parse                                   │   │
│  │ 4. Return { text, pages, metadata }                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui
- **State**: Zustand + persist middleware
- **Markdown**: react-markdown
- **Icons**: lucide-react
- **QR Codes**: qrcode.react

### Backend

- **API Routes**: Next.js App Router API
- **Cache**: Vercel KV (Redis)
- **AI**: Groq SDK (Llama 3.3 70B)
- **Scraping**: native fetch

### Worker Service

- **Runtime**: Node.js 20
- **Framework**: Express
- **Browser**: Playwright (Chromium)
- **PDF Parser**: pdf-parse
- **Container**: Docker (Playwright base image)

---

## Implementatie Stappen

### ✅ Stap 1: Scaffold Next.js Project

```bash
npx create-next-app@latest epstein-search \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"
```

**Dependencies:**

```bash
npm install groq-sdk @vercel/kv zustand qrcode.react react-markdown lucide-react
npm install -D @types/qrcode.react
```

**shadcn/ui:**

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea scroll-area
```

---

### ✅ Stap 2: API Routes

#### `/api/search` - DOJ API Query

- Query DOJ multimedia-search endpoint
- Pagineer door resultaten (100 per batch)
- Extraheer content + PDF URLs
- Cache in Vercel KV (24u TTL)

**DOJ API Endpoint:**

```
https://www.justice.gov/multimedia-search?keys={term}&from={offset}&size=100
```

**Response Structure:**

```typescript
interface DOJResult {
  documentId: string;
  content: string;
  highlight: string[];
  fileName: string;
  fileUri: string;
  startPage: number;
  endPage: number;
}
```

#### `/api/summarize` - Groq AI Samenvatting

- Accepteer content array
- Construct Nederlandse prompt
- Stream response via Groq API
- Return server-sent events

**Groq Model:** `llama-3.3-70b-versatile`

#### `/api/deep-analyze` - PDF Worker Proxy

- Accepteer PDF URL
- Forward naar Render worker
- Combineer met Groq samenvatting
- Stream resultaat

---

### ✅ Stap 3: PDF Worker (Render.com)

**Project:** `/worker` folder

**Dockerfile:**

```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**POST /analyze Endpoint:**

1. Launch Playwright headless Chromium
2. Navigate naar PDF URL
3. Detect age-verify redirect
4. Click "I am 18 or older" button
5. Wait for PDF load/download
6. Parse met pdf-parse
7. Return JSON

---

### ✅ Stap 4: Chat UI Components

**Component Tree:**

```
app/
├── page.tsx (ChatContainer)
└── components/
    ├── chat/
    │   ├── MessageList.tsx
    │   ├── Message.tsx
    │   └── ChatInput.tsx
    ├── results/
    │   ├── DocumentCard.tsx
    │   └── DeepAnalysisPanel.tsx
    └── donations/
        └── DonationPanel.tsx
```

**Features:**

- Dual-mode search (snel/diep toggle)
- Streaming message updates
- Loading states per document
- Copy-to-clipboard voor donatie adressen
- Responsive design (mobile-first)

---

### ✅ Stap 5: State Management

**Zustand Store:**

```typescript
interface ChatStore {
  messages: Message[];
  searchMode: "fast" | "deep";
  addMessage: (msg: Message) => void;
  setSearchMode: (mode: "fast" | "deep") => void;
}
```

**localStorage Persistence:**

- Conversation history (max 50 messages)
- Search preferences
- Donatie panel collapse state

---

### ✅ Stap 6: Monetisatie

**Google AdSense:**

- Script in `app/layout.tsx` head
- Banner (728x90) in header
- Rectangle (300x250) in sidebar
- Responsive units voor mobile

**Crypto Donaties:**

- BTC adres + QR code
- ETH adres + QR code
- Copy button met toast feedback
- Env vars: `NEXT_PUBLIC_BTC_ADDRESS`, `NEXT_PUBLIC_ETH_ADDRESS`

**Optioneel:**

- Ko-fi widget button
- Buy Me a Coffee integration

---

### ✅ Stap 7: Deployment

#### Vercel (Frontend)

1. GitHub repo pushen
2. Vercel project linken
3. Environment variables instellen
4. Auto-deploy on push

**Env Vars:**

```
GROQ_API_KEY=gsk_...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
RENDER_WORKER_URL=https://epstein-worker.onrender.com
NEXT_PUBLIC_BTC_ADDRESS=bc1q...
NEXT_PUBLIC_ETH_ADDRESS=0x...
NEXT_PUBLIC_ADSENSE_ID=ca-pub-...
```

#### Render (Worker)

1. Docker-based web service
2. Gratis tier (750 uur/maand)
3. Auto-deploy from GitHub
4. Health check endpoint

---

## Data Flows

### Fast Search Flow

```
User query
  → /api/search
  → Check Vercel KV cache
  → [MISS] Query DOJ API
  → Cache results
  → /api/summarize
  → Groq streaming
  → UI updates
```

### Deep Analysis Flow

```
User clicks "Analyseer"
  → /api/deep-analyze
  → POST Render worker /analyze
  → Playwright age-verify automation
  → Download + parse PDF
  → Return full text
  → Groq summarize full content
  → Stream to UI
```

---

## Gratis Capaciteit

| Service        | Limiet        | Geschat Gebruik        |
| -------------- | ------------- | ---------------------- |
| Vercel Hosting | 100GB/maand   | ~1M pageviews          |
| Vercel KV      | 3000 req/dag  | 3000 searches/dag      |
| Render Worker  | 750 uur/maand | 33K PDF analyses/maand |
| Groq API       | 30 req/min    | 43K samenvattingen/dag |

**Totale kosten:** €0/maand

---

## Inkomsten Potentieel

| Kanaal       | Geschat (conservatief)    |
| ------------ | ------------------------- |
| AdSense      | €50-200/maand bij 10K MAU |
| BTC donaties | €20-100/maand             |
| ETH donaties | €20-100/maand             |

**Totaal:** €90-400/maand mogelijk

---

## Projectstructuur

```
epstein-search/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root + AdSense
│   │   ├── page.tsx            # Chat UI
│   │   ├── globals.css
│   │   └── api/
│   │       ├── search/route.ts
│   │       ├── summarize/route.ts
│   │       └── deep-analyze/route.ts
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── chat/
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── Message.tsx
│   │   │   └── ChatInput.tsx
│   │   ├── results/
│   │   │   ├── DocumentCard.tsx
│   │   │   └── DeepAnalysisPanel.tsx
│   │   └── donations/
│   │       └── DonationPanel.tsx
│   ├── lib/
│   │   ├── doj-api.ts          # DOJ scraping
│   │   ├── groq.ts             # Groq client
│   │   ├── cache.ts            # Vercel KV
│   │   └── utils.ts            # shadcn utils
│   └── store/
│       └── chat-store.ts       # Zustand + persist
├── worker/
│   ├── src/
│   │   ├── index.ts            # Express server
│   │   ├── age-verify.ts       # Playwright automation
│   │   └── pdf-parser.ts       # pdf-parse wrapper
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── .env.local
```

---

## Testing Strategie

### Frontend

- Component tests (Playwright Component Testing)
- E2E tests voor chat flow
- API route integration tests

### Worker

- Unit tests voor age-verify logic
- Integration tests voor PDF parsing
- Mock DOJ responses

---

## Security Overwegingen

1. **Rate Limiting**: API routes rate-limiten op IP
2. **Input Validation**: Sanitize search queries
3. **CORS**: Restrict worker endpoint access
4. **Secrets**: Nooit API keys in frontend
5. **CSP**: Content Security Policy headers

---

## Performance Optimalisaties

1. **Vercel KV Caching**: 24u TTL voor search results
2. **Streaming Responses**: SSE voor real-time updates
3. **Code Splitting**: Dynamic imports voor heavy components
4. **Image Optimization**: Next.js Image component voor QR codes
5. **Edge Functions**: Deploy API routes to edge

---

## Toekomstige Features (v2)

- [ ] User accounts (Supabase Auth)
- [ ] Saved searches
- [ ] Email alerts voor nieuwe documenten
- [ ] Advanced filters (datum, document type)
- [ ] Export naar PDF/JSON
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] API access voor developers

---

## Launch Checklist

- [ ] Next.js project scaffolded
- [ ] API routes geïmplementeerd
- [ ] Chat UI compleet
- [ ] Worker deployed op Render
- [ ] Vercel deployment
- [ ] Environment variables
- [ ] AdSense goedkeuring
- [ ] Crypto wallet adressen
- [ ] Testing completed
- [ ] SEO optimalisatie
- [ ] Privacy policy
- [ ] Terms of service
- [ ] Google Analytics
- [ ] Error monitoring (Sentry)

---

**Status:** Ready for implementation
**Start Date:** February 4, 2026
