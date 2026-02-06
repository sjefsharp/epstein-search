# UI Components

## Framework

- shadcn/ui (new-york style) — config in `components.json`
- Tailwind CSS 4 with `tw-animate-css`
- Icons: `lucide-react`
- Path: `@/components/ui/` for shadcn primitives, `@/components/{feature}/` for domain components

## Client components

All interactive components use `"use client"` directive. Server Components are the default in App Router — only add the directive when using hooks, event handlers, or browser APIs.

## Component structure

```
src/components/
├── chat/
│   ├── ChatContainer.tsx    # Main chat orchestrator — search, summarize, deep-analyze flows + SSE reader
│   ├── ChatInput.tsx        # Input bar with mode toggle
│   ├── Message.tsx          # Single message bubble (user/assistant)
│   └── MessageList.tsx      # Scrollable message list
├── donations/
│   └── DonationPanel.tsx    # QR code donation sidebar
├── navigation/
│   └── LanguageSwitcher.tsx # Locale picker
├── results/                 # (empty — results rendered inline in Message.tsx)
└── ui/                      # shadcn/ui primitives (badge, button, card, input, scroll-area, skeleton, textarea)
```

## State management

Zustand store: `src/store/chat-store.ts`

- Persisted to localStorage (key: `epstein-chat-storage`)
- Keeps last 50 messages only (via `partialize`)
- Actions: `addMessage`, `updateMessage`, `setSearchMode`, `setLoading`, `clearMessages`, `deleteMessage`
- Search modes: `"fast"` (search + summarize) vs `"deep"` (deep-analyze with PDF extraction)

## SSE reading

`readSSE()` in `ChatContainer.tsx` — generic SSE reader that handles `data: {json}\n\n` chunks and `data: [DONE]\n\n` termination. Reused for both summarize and deep-analyze streams.

## i18n in components

- `useTranslations("Namespace")` for client components
- `getTranslations()` for server components (layout.tsx)
- `useLocale()` to pass locale to API calls as query param

## Adding a component

1. Create in appropriate `src/components/{feature}/` directory
2. Add `"use client"` if interactive
3. Use `useTranslations()` for user-facing strings — add keys to all 6 `messages/*.json` files
4. Import shadcn/ui primitives from `@/components/ui/`
