/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { ScrollArea } from "../../src/components/ui/scroll-area";

describe("ScrollArea", () => {
  it("renders scroll area with viewport", () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>,
    );

    expect(container.querySelector('[data-slot="scroll-area"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toBeTruthy();
  });
});
