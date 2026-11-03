import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Leaderboard, Podium } from "@/components/Results";
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

  it("centers a two-player podium without an empty third-place slot", () => {
    const { container } = render(createElement(Podium, { players: players.slice(0, 2) }));

    expect(screen.getByText("Pemain 1")).toBeInTheDocument();
    expect(screen.getByText("Pemain 2")).toBeInTheDocument();
    expect(container.querySelector(".grid-cols-2")).toBeInTheDocument();
    expect(container.querySelectorAll(".grid-cols-2 > div")).toHaveLength(2);
  });

  it("uses a question mark instead of leaving hidden player scores blank", () => {
    render(
      createElement(Leaderboard, {
        players: [{ ...players[0], score: 0 }, players[1]],
        meId: "player-1",
        hideOtherScores: true,
      }),
    );

    expect(screen.getByLabelText("Skor disembunyikan")).toHaveTextContent("?");
    expect(screen.getByLabelText("0 poin")).toHaveTextContent("0");
  });
});
