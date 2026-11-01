import { beforeEach, describe, expect, it } from "vitest";

import {
  createRoom,
  generatePin,
  hostTick,
  joinRoom,
  loadMe,
  MIN_PLAYERS_TO_START,
  rankPlayers,
  resetRoom,
  saveMe,
  startGame,
  submitAnswer,
} from "@/game/room";
import { getRoom } from "@/game/room";
import { createQuizFixture } from "./quiz-fixture";

const PIN_RE = /^[1-9]\d{5}$/;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetRoom();
});

describe("room lifecycle", () => {
  it("generates a 6-digit PIN with a non-zero first digit", () => {
    for (let i = 0; i < 30; i++) expect(generatePin()).toMatch(PIN_RE);
  });

  it("starts in lobby with no players", () => {
    const quiz = createQuizFixture();
    createRoom(quiz.id);
    const room = getRoom();
    expect(room).not.toBeNull();
    expect(room!.pin).toMatch(PIN_RE);
    expect(room!.phase).toBe("lobby");
    expect(room!.players).toHaveLength(0);
  });

  it("rejects joining with the wrong PIN or before launch", () => {
    const quiz = createQuizFixture();
    createRoom(quiz.id);
    expect(joinRoom("000001", "p1", "Budi")).toEqual({ ok: false, error: "wrong-pin" });
    resetRoom();
    expect(joinRoom("999999", "p1", "Budi")).toEqual({ ok: false, error: "room-not-found" });
  });

  it("joins players by PIN and is idempotent per player", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    expect(joinRoom(pin, "p1", "Budi")).toEqual({ ok: true });
    expect(joinRoom(pin, "p1", "Budi")).toEqual({ ok: true });
    expect(getRoom()!.players).toHaveLength(1);
    expect(joinRoom(pin, "p2", "Sari")).toEqual({ ok: true });
    expect(getRoom()!.players.map((p) => p.nickname)).toEqual(["Budi", "Sari"]);
  });

  it("requires at least four joined players before starting", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    for (let index = 0; index < MIN_PLAYERS_TO_START - 1; index++) {
      joinRoom(pin, `p${index}`, `Pemain ${index}`);
    }

    startGame(quiz);
    expect(getRoom()!.phase).toBe("lobby");

    joinRoom(pin, "p4", "Pemain 4");
    startGame(quiz);
    expect(getRoom()!.phase).toBe("question");
  });

  it("persists the active room and player identity for refresh recovery", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    for (let index = 1; index <= MIN_PLAYERS_TO_START; index++) {
      joinRoom(pin, `p${index}`, `Pemain ${index}`);
    }
    saveMe({ playerId: "p1", nickname: "Budi", pin });
    startGame(quiz);

    const persistedRoom = JSON.parse(window.localStorage.getItem("kampusquiz.room")!);
    expect(persistedRoom.phase).toBe("question");
    expect(persistedRoom.players[0].nickname).toBe("Pemain 1");
    expect(loadMe()).toEqual({ playerId: "p1", nickname: "Budi", pin });
  });

  it("migrates the previous shared player identity into the current tab session", () => {
    const me = { playerId: "p1", nickname: "Budi", pin: "123456" };
    window.localStorage.setItem("kampusquiz.me", JSON.stringify(me));

    expect(loadMe()).toEqual(me);
    expect(window.sessionStorage.getItem("kampusquiz.me")).toBe(JSON.stringify(me));
    expect(window.localStorage.getItem("kampusquiz.me")).toBeNull();
  });
});

describe("game flow", () => {
  it("runs lobby → question → reveal → leaderboard → next question, scoring correctly", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    joinRoom(pin, "p1", "Budi");
    joinRoom(pin, "p2", "Sari");
    joinRoom(pin, "p3", "Mia");
    joinRoom(pin, "p4", "Raka");

    startGame(quiz);
    let room = getRoom()!;
    expect(room.phase).toBe("question");
    expect(room.questionIndex).toBe(0);
    expect(room.durationMs).toBe(quiz.questions[0]!.timerSec * 1000);

    // Q1 answer: option index 0 is correct.
    submitAnswer("p1", 0, 0);
    room = getRoom()!;
    expect(room.answers["p1"]!.choice).toBe(0);
    const budi = room.players.find((p) => p.id === "p1")!;
    expect(budi.score).toBeGreaterThanOrEqual(500);
    expect(budi.score).toBeLessThanOrEqual(1000);
    expect(budi.score % 10).toBe(0);

    // A second submission must not double-score.
    submitAnswer("p1", 1, 0);
    room = getRoom()!;
    expect(room.players.find((p) => p.id === "p1")!.score).toBe(budi.score);

    // A wrong answer scores 0.
    submitAnswer("p2", 2, 0);
    submitAnswer("p3", 1, 0);
    submitAnswer("p4", 3, 0);
    room = getRoom()!;
    expect(room.players.find((p) => p.id === "p2")!.score).toBe(0);

    // Everyone answered → reveal fires even before the timer expires.
    const now = Date.now();
    hostTick(quiz, now);
    room = getRoom()!;
    expect(room.phase).toBe("reveal");

    hostTick(quiz, now + 7_000);
    room = getRoom()!;
    expect(room.phase).toBe("leaderboard");

    hostTick(quiz, now + 14_000);
    room = getRoom()!;
    expect(room.phase).toBe("question");
    expect(room.questionIndex).toBe(1);
    expect(Object.keys(room.answers)).toHaveLength(0);
    expect(room.durationMs).toBe(quiz.questions[1]!.timerSec * 1000);
    expect(room.players.every((p) => p.lastGain === 0)).toBe(true);
  });

  it("advances by timeout when players stall, and finishes on the podium", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    for (let index = 1; index <= MIN_PLAYERS_TO_START; index++) {
      joinRoom(pin, `p${index}`, `Pemain ${index}`);
    }

    startGame(quiz);
    let now = Date.now();
    // Nobody answers: question ends at its own deadline.
    hostTick(quiz, now + 500);
    expect(getRoom()!.phase).toBe("question");
    hostTick(quiz, now + quiz.questions[0]!.timerSec * 1000 + 200);
    expect(getRoom()!.phase).toBe("reveal");

    // Fast-forward through every remaining question to the podium.
    for (let step = 0; step < 60; step++) {
      now += 20_000;
      hostTick(quiz, now);
    }
    const room = getRoom()!;
    expect(room.phase).toBe("podium");
    expect(room.questionIndex).toBe(quiz.questions.length - 1);
  });

  it("ranks players by score, ties broken alphabetically", () => {
    const quiz = createQuizFixture();
    const { pin } = createRoom(quiz.id);
    joinRoom(pin, "a", "Zed");
    joinRoom(pin, "b", "Ana");
    joinRoom(pin, "c", "Mia");
    joinRoom(pin, "d", "Budi");
    startGame(quiz);
    submitAnswer("a", 0, 0); // correct → ≥ 500
    submitAnswer("b", 1, 0);
    submitAnswer("c", 2, 0);
    submitAnswer("d", 3, 0);
    hostTick(quiz, Date.now()); // reveal
    const ranked = rankPlayers(getRoom());
    expect(ranked[0]!.nickname).toBe("Zed");
    expect(ranked.map((p) => p.nickname).slice(1)).toEqual(["Ana", "Budi", "Mia"]);
  });
});

describe("human-only gameplay", () => {
  it("does not submit answers automatically for joined players", () => {
    const quiz = createQuizFixture();
    createRoom(quiz.id);
    const { pin } = getRoom()!;
    for (let index = 1; index <= MIN_PLAYERS_TO_START; index++) {
      joinRoom(pin, `p${index}`, `Pemain ${index}`);
    }
    startGame(quiz);
    const questionStartedAt = getRoom()!.phaseStartedAt;

    hostTick(quiz, questionStartedAt + 2000);

    expect(getRoom()!.answers).toEqual({});
    expect(getRoom()!.phase).toBe("question");
  });

  it("rejects answers from non-players, invalid choices, and after the deadline", () => {
    const quiz = createQuizFixture();
    createRoom(quiz.id);
    const { pin } = getRoom()!;
    for (let index = 1; index <= MIN_PLAYERS_TO_START; index++) {
      joinRoom(pin, `p${index}`, `Pemain ${index}`);
    }
    startGame(quiz);

    const room = getRoom()!;
    const correctIndex = quiz.questions[0]!.correctIndex;
    const deadline = room.phaseStartedAt + room.durationMs;
    submitAnswer("unknown", correctIndex, correctIndex, room.phaseStartedAt);
    submitAnswer("p1", 4, correctIndex, room.phaseStartedAt);
    submitAnswer("p1", correctIndex, correctIndex, deadline);

    expect(getRoom()!.answers).toEqual({});
    expect(getRoom()!.players[0]!.score).toBe(0);
  });
});
