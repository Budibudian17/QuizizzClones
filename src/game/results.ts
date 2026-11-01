import type { Player } from "./types";

export function getPlayersBelowPodium(players: Player[]): Player[] {
  return players.slice(3);
}
