# src/components/ — React Components

Client-side React 19 components using shadcn/ui + Tailwind CSS 4 + next-intl.

## TDD Rule

Every new component gets a test BEFORE implementation:

1. Create `tests/components/<Component>.test.tsx`
2. Use `renderWithIntl` helper from `tests/utils/renderWithIntl.tsx`
3. Write failing test → `npm run test:run` → confirm red
4. Implement component → confirm green

Git workflow: see `AGENTS.md § Git Workflow`

## Folder Structure

`ads/` | `chat/` | `consent/` | `donations/` | `gates/` | `navigation/` | `ui/` (shadcn primitives)

## Rules

### "use client"

EVERY component file MUST start with `"use client"` on line 1. Non-negotiable — App Router requires it for hooks, browser APIs, event handlers.

### shadcn/ui

- Primitives in `src/components/ui/` — import via `@/components/ui/<component>`
- Style variant: **new-york** (not default)
- Use `cn()` from `@/lib/utils` to merge Tailwind classes
- Extend via composition/wrappers — do NOT modify primitives directly

### i18n

- `useTranslations(namespace)` for all user-visible strings — NEVER hardcode English
- Namespace = component name (e.g., `ChatInput` → `useTranslations("ChatInput")`)
- New components: add keys to ALL 6 locale JSON files in `messages/`

### Testing

- `@testing-library/react` — `render`, `screen`, `fireEvent`, `waitFor`
- Use `renderWithIntl` for components calling `useTranslations()`
- Test user behavior, NOT implementation — prefer `getByRole`, `getByLabelText`, `getByText` over `getByTestId`
- Test a11y: `aria-label`, roles, keyboard navigation

### Chrome Dev Tools

When a browser is available, verify component changes with Chrome Dev Tools:

- **Console** — no runtime errors or warnings from the component
- **Elements** — inspect rendered DOM, computed styles, layout
- **Accessibility** — check ARIA roles/labels via the Accessibility pane
- **Network** — confirm any API calls from the component succeed

For remote debugging: capture Dev Tools output → analyze → report in commit/PR.

> Advisory — automated tests remain the hard gate.

### Performance

- `memo()` for stable-callback/large-list components — `useCallback()` for handler props
- Derive inline (e.g., `const trimmed = input.trim()`) — NOT in `useEffect`
- `useRef` for frequent-change values that don't need re-renders
- Hoist static JSX / default props outside the component function
