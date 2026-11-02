export const PLAYER_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export function isPlayerSessionIdleExpired(lastActivityAt: number, now: number): boolean {
  return (
    Number.isFinite(lastActivityAt) &&
    lastActivityAt > 0 &&
    now - lastActivityAt >= PLAYER_IDLE_TIMEOUT_MS
  );
}
