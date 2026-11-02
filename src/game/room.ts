import { remainingRatio, scoreForAnswer } from "./scoring";
import { PHASE_DWELL_MS, type GamePhase, type Quiz, type RoomState } from "./types";

/**
 * Mock real-time layer.
 *
 * One authoritative room snapshot lives in localStorage; every tab that opens
 * it subscribes through a BroadcastChannel, so the Host tab and every Player
 * tab see the same state within milliseconds. The Host tab owns phase
 * transitions; players only add their own answers/scores.
 */
const ROOM_KEY = "kampusquiz.room";
const ME_KEY = "kampusquiz.me";
const CHANNEL_NAME = "kampusquiz-room";
export const MIN_PLAYERS_TO_START = 4;

let channel: BroadcastChannel | null = null;
let state: RoomState | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInit() {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ROOM_KEY);
    if (raw) {
      state = removeLegacyBots(JSON.parse(raw) as LegacyRoomState);
      persist();
    }
  } catch {
    state = null;
  }
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const incoming = event.data as RoomState | null;
      if (incoming === null) {
        state = null;
      } else if (!state || incoming.rev > state.rev) {
        state = incoming;
      } else {
        return;
      }
      persist();
      emit();
    };
  }
}

type LegacyRoomState = Omit<RoomState, "players"> & {
  players: (RoomState["players"][number] & { isBot?: boolean; botSkill?: number })[];
  botPlan?: unknown;
};

function removeLegacyBots(room: LegacyRoomState): RoomState {
  const { botPlan: _botPlan, ...roomWithoutBotPlan } = room;
  const botIds = new Set(room.players.filter((player) => player.isBot).map((player) => player.id));
  return {
    ...roomWithoutBotPlan,
    players: room.players
      .filter((player) => !player.isBot)
      .map(({ id, nickname, score, lastGain }) => ({ id, nickname, score, lastGain })),
    answers: Object.fromEntries(
      Object.entries(room.answers).filter(([playerId]) => !botIds.has(playerId)),
    ),
  };
}

function persist() {
  try {
    if (state) window.localStorage.setItem(ROOM_KEY, JSON.stringify(state));
    else window.localStorage.removeItem(ROOM_KEY);
  } catch {
    // ignore
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeRoom(cb: () => void): () => void {
  ensureInit();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Stable snapshot for useSyncExternalStore. */
export function getRoom(): RoomState | null {
  ensureInit();
  return state;
}

function commit(next: RoomState) {
  state = { ...next, rev: next.rev + 1 };
  persist();
  try {
    channel?.postMessage(state);
  } catch {
    // channel closed — local tab still fine
  }
  emit();
}

/** Applies a mutation; skips the commit entirely when the mutation is a no-op. */
function updateRoom(mutate: (s: RoomState) => RoomState | null): void {
  ensureInit();
  if (!state) return;
  const next = mutate(state);
  if (next === null || next === state) return;
  commit(next);
}

/* ------------------------------- persistence ------------------------------ */

export type SavedMe = { playerId: string; nickname: string; pin: string; roomId?: string };

export function saveMe(me: SavedMe): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ME_KEY, JSON.stringify(me));
    window.localStorage.removeItem(ME_KEY);
  } catch {
    // ignore
  }
}

export function loadMe(): SavedMe | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ME_KEY) ?? window.localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const me = JSON.parse(raw) as SavedMe;
    window.sessionStorage.setItem(ME_KEY, JSON.stringify(me));
    window.localStorage.removeItem(ME_KEY);
    return me;
  } catch {
    return null;
  }
}

export function clearMe(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ME_KEY);
  window.localStorage.removeItem(ME_KEY);
}

function applyAnswer(
  s: RoomState,
  playerId: string,
  choice: number,
  correctIndex: number,
  at: number,
): RoomState {
  const ratio = remainingRatio(s.phaseStartedAt, s.durationMs, at);
  const gain = choice === correctIndex ? scoreForAnswer(ratio) : 0;
  return {
    ...s,
    answers: { ...s.answers, [playerId]: { choice, at } },
    players: s.players.map((p) =>
      p.id === playerId ? { ...p, score: p.score + gain, lastGain: gain } : p,
    ),
  };
}

/* ---------------------------------- host ---------------------------------- */

export function createRoom(quizId: string): RoomState {
  ensureInit();
  const pin = generatePin();
  const room: RoomState = {
    pin,
    quizId,
    phase: "lobby",
    questionIndex: 0,
    phaseStartedAt: Date.now(),
    durationMs: 0,
    players: [],
    answers: {},
    rev: 0,
  };
  commit(room);
  return state!;
}

export function generatePin(): string {
  // 6 digits, first one non-zero so it never gets dropped when typed
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function resetRoom(): void {
  ensureInit();
  state = null;
  persist();
  try {
    channel?.postMessage(null);
  } catch {
    // ignore
  }
  emit();
}

/** Host engine tick: advances when every joined player answers or the timer expires. */
export function hostTick(quiz: Quiz, now = Date.now()): void {
  updateRoom((s) => {
    if (s.quizId !== quiz.id) return s;
    if (s.phase === "question") {
      const everyoneAnswered =
        s.players.length > 0 && Object.keys(s.answers).length >= s.players.length;
      if (now >= s.phaseStartedAt + s.durationMs || everyoneAnswered) {
        return withPhase(s, "reveal", PHASE_DWELL_MS.reveal, now);
      }
      return s;
    }
    if (s.phase === "reveal") {
      if (now >= s.phaseStartedAt + s.durationMs) {
        return withPhase(s, "leaderboard", PHASE_DWELL_MS.leaderboard, now);
      }
      return s;
    }
    if (s.phase === "leaderboard" && s.durationMs > 0) {
      if (now < s.phaseStartedAt + s.durationMs) return s;
      const nextIndex = s.questionIndex + 1;
      if (quiz.questions[nextIndex]) return startQuestionAt(s, quiz, nextIndex, now);
      return withPhase(s, "podium", 0, now);
    }
    return s;
  });
}

/** Launches question `index`: fresh timer, answers cleared, per-player gains reset. */
export function startGame(quiz: Quiz): void {
  updateRoom((s) =>
    s.phase === "lobby" && s.players.length >= MIN_PLAYERS_TO_START
      ? startQuestionAt(s, quiz, 0, Date.now())
      : s,
  );
}

function startQuestionAt(s: RoomState, quiz: Quiz, index: number, now: number): RoomState {
  const question = quiz.questions[index];
  const timerSec = question?.timerSec ?? 20;
  const durationMs = timerSec * 1000;

  return {
    ...s,
    phase: "question",
    questionIndex: index,
    phaseStartedAt: now,
    durationMs,
    answers: {},
    players: s.players.map((p) => ({ ...p, lastGain: 0 })),
  };
}

/* --------------------------------- player --------------------------------- */

export type JoinResult =
  { ok: true } | { ok: false; error: "room-not-found" | "wrong-pin" | "game-in-progress" };

export function joinRoom(pin: string, playerId: string, nickname: string): JoinResult {
  ensureInit();
  if (!state) return { ok: false, error: "room-not-found" };
  if (state.pin !== pin) return { ok: false, error: "wrong-pin" };
  if (state.phase !== "lobby") return { ok: false, error: "game-in-progress" };
  updateRoom((s) =>
    s.players.some((p) => p.id === playerId)
      ? s
      : { ...s, players: [...s.players, { id: playerId, nickname, score: 0, lastGain: 0 }] },
  );
  return { ok: true };
}

export function submitAnswer(
  playerId: string,
  choice: number,
  correctIndex: number,
  now = Date.now(),
): void {
  updateRoom((s) => {
    if (
      s.phase !== "question" ||
      s.answers[playerId] ||
      !s.players.some((player) => player.id === playerId) ||
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > 3 ||
      now >= s.phaseStartedAt + s.durationMs
    ) {
      return s;
    }
    return applyAnswer(s, playerId, choice, correctIndex, now);
  });
}

/* --------------------------------- helpers -------------------------------- */

function withPhase(s: RoomState, phase: GamePhase, durationMs: number, now: number): RoomState {
  return { ...s, phase, durationMs, phaseStartedAt: now };
}

export function rankPlayers(s: RoomState | null): RoomState["players"] {
  if (!s) return [];
  if (s.players.every((player) => player.rank !== undefined)) {
    return [...s.players].sort(
      (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return [...s.players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
}
