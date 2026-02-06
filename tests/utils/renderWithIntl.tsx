import { ReactNode } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../messages/en.json";

interface RenderWithIntlOptions {
  locale?: string;
  messages?: Record<string, unknown>;
}

export function renderWithIntl(
  ui: ReactNode,
  { locale = "en", messages = enMessages }: RenderWithIntlOptions = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}
