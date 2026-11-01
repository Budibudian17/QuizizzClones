import { describe, expect, it } from "vitest";

import { formatPoints, remainingRatio, scoreForAnswer } from "@/game/scoring";

describe("scoring rules", () => {
  it("awards the base 500 plus full 500 bonus for an instant correct answer", () => {
    expect(scoreForAnswer(1)).toBe(1000);
  });

  it("awards exactly the 500 base points at the buzzer", () => {
    expect(scoreForAnswer(0)).toBe(500);
  });

  it("decays the speed bonus linearly with remaining time", () => {
    expect(scoreForAnswer(0.5)).toBe(750);
    expect(scoreForAnswer(0.2)).toBe(600);
    expect(scoreForAnswer(0.9)).toBe(950);
  });

  it("always returns a multiple of 10", () => {
    for (let r = 0; r <= 1.001; r += 0.037) {
      expect(scoreForAnswer(r) % 10).toBe(0);
    }
  });

  it("clamps out-of-range ratios instead of producing weird scores", () => {
    expect(scoreForAnswer(-0.5)).toBe(500);
    expect(scoreForAnswer(2)).toBe(1000);
  });
});

describe("remaining time fraction", () => {
  it("goes from 1 to 0 across the question duration", () => {
    expect(remainingRatio(1000, 10_000, 1000)).toBe(1);
    expect(remainingRatio(1000, 10_000, 6000)).toBeCloseTo(0.5);
    expect(remainingRatio(1000, 10_000, 11_000)).toBe(0);
  });
});

describe("formatPoints", () => {
  it("formats scores with thousands separators", () => {
    expect(formatPoints(1250)).toBe("1,250");
  });
});
