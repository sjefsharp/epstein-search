---
applyTo: "src/app/api/**"
---

# API Route Pattern

Every API route MUST follow this structure:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { normalizeLocale } from "@/lib/validation";
import type { SupportedLocale } from "@/lib/types";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<
  SupportedLocale,
  { invalid_input: string; rate_limited: string; server_error: string }
> = {
  en: {
    invalid_input: "Invalid input",
    rate_limited: "Too many requests",
    server_error: "Server error",
  },
  nl: {
    invalid_input: "Ongeldige invoer",
    rate_limited: "Te veel verzoeken",
    server_error: "Serverfout",
  },
  fr: {
    invalid_input: "Entrée invalide",
    rate_limited: "Trop de requêtes",
    server_error: "Erreur serveur",
  },
  de: {
    invalid_input: "Ungültige Eingabe",
    rate_limited: "Zu viele Anfragen",
    server_error: "Serverfehler",
  },
  es: {
    invalid_input: "Entrada inválida",
    rate_limited: "Demasiadas solicitudes",
    server_error: "Error del servidor",
  },
  pt: {
    invalid_input: "Entrada inválida",
    rate_limited: "Muitas solicitações",
    server_error: "Erro do servidor",
  },
};

const RequestSchema = z.object({
  /* ... */
});

export async function POST(request: NextRequest) {
  try {
    const locale = normalizeLocale(request.headers.get("x-locale"));
    const messages = ERROR_MESSAGES[locale];
    const body = RequestSchema.parse(await request.json());
    // rate-limit → business logic → Response or SSE stream
  } catch (error) {
    return NextResponse.json(
      { error: ERROR_MESSAGES[normalizeLocale(null)].server_error },
      { status: 500 },
    );
  }
}
```

## Checklist

- [ ] `export const runtime = "nodejs"` present
- [ ] Zod schema validates all input
- [ ] `normalizeLocale()` + `ERROR_MESSAGES` (×6 locales)
- [ ] Rate limiter applied (pass-through if Redis unavailable)
- [ ] `sanitizeError()` in catch blocks
- [ ] SSE routes: `data: ${JSON.stringify(...)}\n\n` + `data: [DONE]\n\n`
- [ ] Security review per `security-review.instructions.md`
