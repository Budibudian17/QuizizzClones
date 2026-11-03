import type { AvatarConfig } from "./player-avatar";

export type QuizQuestion = {
  id: string;
  text: string;
  options: string[]; // exactly 4
  correctIndex: number; // 0-3
  timerSec: 10 | 20 | 30;
  source?: "opentdb";
};

export type Quiz = {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  updatedAt: number;
  isPublic?: boolean;
  translationStatus?: "complete" | "partial";
};

export type Player = {
  id: string;
  nickname: string;
  avatar?: AvatarConfig;
  score: number;
  lastGain: number; // points earned on the current/last question
  rank?: number;
};

export type PlayerAnswer = {
  choice: number;
  at: number;
};

export type GamePhase = "lobby" | "countdown" | "question" | "reveal" | "leaderboard" | "podium";

export type RoomState = {
  pin: string;
  quizId: string;
  phase: GamePhase;
  questionIndex: number;
  phaseStartedAt: number; // epoch ms
  durationMs: number; // 0 => no auto-advance (lobby / podium)
  players: Player[];
  answers: Record<string, PlayerAnswer>;
  rev: number;
};

export const PHASE_DWELL_MS = {
  reveal: 6000,
  leaderboard: 6500,
} as const;

export function makeId(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}
