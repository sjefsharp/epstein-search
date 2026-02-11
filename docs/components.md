# UI Components

## Framework

- shadcn/ui (new-york style) — config in `components.json`
- Tailwind CSS 4 with `tw-animate-css`
- Icons: `lucide-react`
- Path: `@/components/ui/` for shadcn primitives, `@/components/{feature}/` for domain components

## Client Components

All interactive components use `"use client"` directive. Server Components are the default in App Router — only add the directive when using hooks, event handlers, or browser APIs.

## Component Structure

```
src/components/
├── ads/
│   ├── AdCard.tsx               # In-content ad card
│   ├── AdSenseLoader.tsx        # Google AdSense script loader
│   └── AdSlot.tsx               # Generic ad slot container
├── chat/
│   ├── ChatContainer.tsx        # Main chat orchestrator — search, summarize, deep-analyze + SSE
│   ├── ChatInput.tsx            # Input bar with mode toggle
│   ├── Message.tsx              # Single message bubble (user/assistant)
│   └── MessageList.tsx          # Scrollable message list
├── consent/
│   ├── ConsentBanner.tsx        # GDPR cookie consent banner
│   └── ConsentBottomSpacer.tsx  # Layout spacer when banner visible
├── donations/
│   └── DonationPanel.tsx        # QR code donation sidebar (BTC/ETH)
├── gates/
│   └── AgeVerification.tsx      # Age gate overlay
├── navigation/
│   ├── Breadcrumbs.tsx          # Route-aware breadcrumb trail
│   ├── Footer.tsx               # Site footer with links
│   ├── LanguageSwitcher.tsx     # Locale picker (6 languages)
│   ├── MainNav.tsx              # Desktop navigation bar
│   ├── MobileNav.tsx            # Hamburger menu for mobile
│   └── ThemeToggle.tsx          # Light/dark/system theme picker
└── ui/                          # shadcn/ui primitives
    ├── badge.tsx
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    ├── scroll-area.tsx
    ├── skeleton.tsx
    └── textarea.tsx
```

## State Management (Zustand)

| Store   | File                         | Purpose                                                                       |
| ------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Chat    | `src/store/chat-store.ts`    | Messages, search mode, loading — persisted to localStorage (last 50 messages) |
| Age     | `src/store/age-store.ts`     | Age verification status — persisted to localStorage                           |
| Consent | `src/store/consent-store.ts` | Cookie consent state — persisted to localStorage                              |
| Theme   | `src/store/theme-store.ts`   | Light/dark/system preference — persisted to localStorage                      |

## SSE Reading

`readSSE()` in `ChatContainer.tsx` — generic SSE reader that handles `data: {json}\n\n` chunks and `data: [DONE]\n\n` termination. Reused for both summarize and deep-analyze streams.

## i18n in Components

- `useTranslations("Namespace")` for client components
- `getTranslations()` for server components (layout.tsx)
- `useLocale()` to pass locale to API calls as query param
- All user-facing strings in `messages/*.json` — all 6 locales required

## Adding a Component

1. Create in `src/components/{feature}/`
2. Add `"use client"` if interactive
3. Use `useTranslations()` for strings — add keys to all 6 `messages/*.json` files
4. Import shadcn/ui primitives from `@/components/ui/`
5. Add test in `tests/components/{Name}.test.tsx` using `renderWithIntl`
