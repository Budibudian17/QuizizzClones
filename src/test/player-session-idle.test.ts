import { describe, expect, it } from "vitest";

import { isPlayerSessionIdleExpired, PLAYER_IDLE_TIMEOUT_MS } from "@/utils/player-session-idle";

describe("player idle session timeout", () => {
  it("expires after two hours without activity", () => {
    expect(isPlayerSessionIdleExpired(1_000, 1_000 + PLAYER_IDLE_TIMEOUT_MS)).toBe(true);
  });

  it("does not expire before two hours or for an invalid timestamp", () => {
    expect(isPlayerSessionIdleExpired(1_000, 1_000 + PLAYER_IDLE_TIMEOUT_MS - 1)).toBe(false);
    expect(isPlayerSessionIdleExpired(0, 1_000_000)).toBe(false);
    expect(isPlayerSessionIdleExpired(Number.NaN, 1_000_000)).toBe(false);
  });
});
