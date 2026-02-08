/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { Badge } from "../../src/components/ui/badge";

describe("Badge", () => {
  it("applies variant data attribute", () => {
    const { getByText } = render(<Badge variant="outline">Test</Badge>);

    expect(getByText("Test")).toHaveAttribute("data-variant", "outline");
  });
});
