import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CountdownView } from "@/components/CountdownView";

describe("shared start countdown", () => {
  it("shows a countdown number before the first question", () => {
    render(createElement(CountdownView, { startedAt: Date.now(), durationMs: 3000 }));

    expect(screen.getByRole("status")).toHaveTextContent("Bersiap!");
    expect(screen.getByRole("status")).toHaveTextContent("3");
  });

  it("signals when the countdown has finished", () => {
    render(
      createElement(CountdownView, {
        startedAt: Date.now() - 3000,
        durationMs: 3000,
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("GO!");
  });
});
