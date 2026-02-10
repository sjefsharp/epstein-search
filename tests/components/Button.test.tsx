/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("uses pointer cursor for interactive buttons", () => {
    const { getByRole } = render(<Button>Click me</Button>);

    expect(getByRole("button", { name: /click me/i })).toHaveClass("cursor-pointer");
  });
});
