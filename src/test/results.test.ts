import { describe, expect, it } from "vitest";

import { getPlayersBelowPodium } from "@/game/results";
import type { Player } from "@/game/types";

const players: Player[] = Array.from({ length: 5 }, (_, index) => ({
  id: `player-${index + 1}`,
  nickname: `Pemain ${index + 1}`,
  score: (5 - index) * 100,
  lastGain: 0,
}));

describe("final standings", () => {
  it("lists everyone below third place after the podium", () => {
    expect(getPlayersBelowPodium(players).map((player) => player.nickname)).toEqual([
      "Pemain 4",
      "Pemain 5",
    ]);
  });

  it("returns no extra standings when the podium contains everyone", () => {
    expect(getPlayersBelowPodium(players.slice(0, 3))).toEqual([]);
  });
});
