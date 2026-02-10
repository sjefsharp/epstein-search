# src/components/ — React Components

Client-side React 19 components using shadcn/ui + Tailwind CSS 4 + next-intl.

## TDD Rule

Every new component gets a test BEFORE implementation:

1. Create `tests/components/<Component>.test.tsx`
2. Use the `renderWithIntl` helper from `tests/utils/renderWithIntl.tsx`
3. Write failing test → `npm run test:run` → confirm red
4. Implement component → confirm green
5. Git workflow (required):

   ```powershell
   git checkout -b <type>/<short-description>

   npm run lint ; npm run typecheck ; npm run test:run
   npm run test:e2e      # only if touching UI flows
   npm run test:coverage # lines ≥80%, statements ≥80%, functions ≥75%, branches ≥60%

   git add -A
   git commit -m "<type>: <description>"
   git push origin HEAD
   ```

   Create a PR (GitHub UI or `gh pr create --fill`) using `.github/PULL_REQUEST_TEMPLATE.md`.
   Merge strategy: **squash and merge** (self-merge allowed after CI passes).

   After the PR is merged:

   ```powershell
   git checkout main
   git pull origin main
   git branch -d <branch-name>
   ```

## Folder Structure

```
components/
├── ads/          # AdSense integration (AdSlot, AdSenseLoader)
├── chat/         # Chat UI (ChatInput, Message, MessageList)
├── consent/      # GDPR consent banner
├── donations/    # Donation panel (QR codes, links)
├── navigation/   # LanguageSwitcher, header
├── results/      # Search result display
└── ui/           # shadcn/ui primitives (Button, Badge, ScrollArea, Textarea, Accordion)
```

## Rules

### "use client" Directive

EVERY component file MUST start with `"use client"` as an expression statement on line 1. This is non-negotiable — Next.js App Router requires it for any component using hooks, browser APIs, or event handlers.

### shadcn/ui Usage

- Primitives live in `src/components/ui/` — imported via `@/components/ui/<component>`
- Style variant: **new-york** (not default)
- Use `cn()` from `@/lib/utils` to merge Tailwind classes conditionally
- Do NOT modify shadcn/ui primitives directly — extend via composition or wrapper components

### i18n Integration

- Use `useTranslations(namespace)` from `next-intl` for all user-visible strings
- NEVER hardcode English text — every string must come from `messages/<locale>.json`
- Namespace convention: component name matches translation namespace (e.g., `ChatInput` → `useTranslations("ChatInput")`)
- When creating a new component with text, add keys to ALL 6 locale JSON files

### Testing Conventions

- Import `@testing-library/react` — `render`, `screen`, `fireEvent`, `waitFor`
- Use `renderWithIntl` wrapper for components that call `useTranslations()`
- Test user behavior (clicks, typing), NOT implementation details
- Test accessibility: check `aria-label`, role attributes, keyboard navigation
- Avoid `getByTestId` — prefer `getByRole`, `getByLabelText`, `getByText`

### Performance Patterns

- Use `memo()` for components receiving stable callbacks or large lists
- Use `useCallback()` for event handlers passed as props
- Derive computed values inline (e.g., `const trimmed = input.trim()`) — NOT in `useEffect`
- Use `useRef` for values that change frequently but don't need re-renders
- Hoist static JSX / default prop values outside the component function

### Props and Types

- Define props as `interface <Component>Props` — always exported for testing
- Use `React.ChangeEvent<T>`, `React.FormEvent<T>`, etc. for typed event handlers
- Avoid `any` — use specific types or `unknown` with type narrowing

## Output Rules

Do NOT create new markdown files in the repo. Use `temp/` for scratch docs. See root [AGENTS.md](../../AGENTS.md) for details.
