/**
 * Scoring rules (the numbers users care about — covered by src/test/scoring.test.ts):
 * - A correct answer earns BASE_POINTS plus a speed bonus that decays linearly
 *   with the remaining time fraction of the question.
 * - A wrong answer earns 0.
 * - Scores are always rounded to a multiple of 10.
 */
export const BASE_POINTS = 500;
export const MAX_BONUS = 500;

/** remainingRatio: 1.0 answered instantly, 0.0 at the buzzer. */
export function scoreForAnswer(remainingRatio: number): number {
  const r = Math.min(1, Math.max(0, remainingRatio));
  return Math.round((BASE_POINTS + MAX_BONUS * r) / 10) * 10;
}

export function formatPoints(n: number): string {
  return n.toLocaleString("en-US");
}

/** 0..1 remaining time fraction, clamped. */
export function remainingRatio(startedAt: number, durationMs: number, now: number): number {
  if (durationMs <= 0) return 0;
  const elapsed = now - startedAt;
  return Math.min(1, Math.max(0, 1 - elapsed / durationMs));
}
