import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CountdownView } from "@/components/CountdownView";

describe("shared start countdown", () => {
  it("shows a countdown number before the first question", () => {
    render(createElement(CountdownView, { startedAt: Date.now(), durationMs: 4000 }));

    expect(screen.getByRole("status")).toHaveTextContent("Bersiap!");
    expect(screen.getByRole("status")).toHaveTextContent("3");
  });

  it("shows zero during the final second before the question starts", () => {
    render(
      createElement(CountdownView, {
        startedAt: Date.now() - 3100,
        durationMs: 4000,
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("0");
  });
});
