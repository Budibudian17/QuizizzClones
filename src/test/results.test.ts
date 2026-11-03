import { createElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FinalLeaderboard, Leaderboard, Podium } from "@/components/Results";
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
        players: [
          { id: "player-1", nickname: "Pemain 1", score: 0, lastGain: 0 },
          { id: "player-2", nickname: "Pemain 2", score: 400, lastGain: 0 },
        ],
        meId: "player-1",
        hideOtherScores: true,
      }),
    );

    expect(screen.getByLabelText("Skor disembunyikan")).toHaveTextContent("?");
    expect(screen.getByLabelText("0 poin")).toHaveTextContent("0");
  });

  it("shows all scores in the final leaderboard", () => {
    vi.useFakeTimers();
    render(createElement(FinalLeaderboard, { players }));

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("400")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
