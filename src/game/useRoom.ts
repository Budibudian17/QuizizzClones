import { useEffect, useState, useSyncExternalStore } from "react";
import { getRoom, subscribeRoom } from "./room";
import type { RoomState } from "./types";

/** Subscribes the component to the shared game room across tabs. */
export function useRoom(): RoomState | null {
  return useSyncExternalStore(subscribeRoom, getRoom, () => null);
}

/** Re-renders on a timer so countdowns tick without touching the room. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function remainingMs(startedAt: number, durationMs: number, now: number): number {
  return Math.max(0, durationMs - (now - startedAt));
}
