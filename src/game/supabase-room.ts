import { useEffect, useState } from "react";

import type { PlayerAnswer, Quiz, QuizQuestion, RoomState } from "./types";
import { createClient, createPlayerClient } from "@/utils/supabase/client";

export type PublicQuiz = Omit<Quiz, "questions"> & {
  questions: Array<Omit<Quiz["questions"][number], "correctIndex"> & { correctIndex?: number }>;
};

export type LiveRoom = {
  roomId: string;
  state: RoomState;
  quiz: PublicQuiz;
};

export function getHostQuiz(room: LiveRoom | null): Quiz | null {
  if (!room || !room.quiz.questions.every(isHostQuestion)) return null;
  return {
    ...room.quiz,
    questions: room.quiz.questions,
  };
}

function isHostQuestion(question: PublicQuiz["questions"][number]): question is QuizQuestion {
  return Number.isInteger(question.correctIndex);
}

type RoomSnapshotPayload = {
  room: {
    id: string;
    pin: string;
    quizId: string;
    phase: RoomState["phase"];
    questionIndex: number;
    phaseStartedAt: number;
    durationMs: number;
  };
  quiz: PublicQuiz;
  players: Array<{
    id: string;
    nickname: string;
    score: number;
    last_gain: number;
  }>;
  answers: Array<{
    player_id: string;
    choice: number;
    at: number;
  }>;
};

function mapSnapshot(payload: RoomSnapshotPayload): LiveRoom {
  const answers: Record<string, PlayerAnswer> = {};
  for (const answer of payload.answers) {
    answers[answer.player_id] = { choice: answer.choice, at: answer.at };
  }

  return {
    roomId: payload.room.id,
    quiz: payload.quiz,
    state: {
      pin: payload.room.pin,
      quizId: payload.room.quizId,
      phase: payload.room.phase,
      questionIndex: payload.room.questionIndex,
      phaseStartedAt: payload.room.phaseStartedAt,
      durationMs: payload.room.durationMs,
      players: payload.players.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        lastGain: player.last_gain,
      })),
      answers,
      rev: 0,
    },
  };
}

export async function fetchRoomSnapshot(roomId: string, isPlayer = false): Promise<LiveRoom> {
  const client = isPlayer ? createPlayerClient() : createClient();
  const { data, error } = await client.rpc("get_room_snapshot", { p_room_id: roomId });
  if (error) throw error;
  return mapSnapshot(data as RoomSnapshotPayload);
}

export async function ensureHostRoom(quizId: string): Promise<{ roomId: string; pin: string }> {
  const { data, error } = await createClient().rpc("ensure_host_room", { p_quiz_id: quizId });
  if (error) throw error;
  const room = data?.[0] as { room_id: string; pin: string } | undefined;
  if (!room) throw new Error("Supabase tidak mengembalikan room host.");
  return { roomId: room.room_id, pin: room.pin };
}

export async function joinSupabaseRoom(pin: string, nickname: string): Promise<string> {
  const client = createPlayerClient();
  const { data: current, error: currentError } = await client.auth.getUser();
  if (currentError) throw currentError;

  if (!current.user) {
    const { error: signInError } = await client.auth.signInAnonymously();
    if (signInError) throw signInError;
  }

  const { data, error } = await client.rpc("join_room", {
    p_pin: pin,
    p_nickname: nickname,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("Supabase tidak mengembalikan room pemain.");
  return data;
}

export async function getCurrentPlayerId(): Promise<string> {
  const { data, error } = await createPlayerClient().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sesi pemain tidak ditemukan. Silakan bergabung kembali.");
  return data.user.id;
}

export async function startSupabaseRoom(roomId: string): Promise<void> {
  const { error } = await createClient().rpc("start_room", { p_room_id: roomId });
  if (error) throw error;
}

export async function tickSupabaseRoom(roomId: string): Promise<void> {
  const { error } = await createClient().rpc("advance_room", { p_room_id: roomId });
  if (error) throw error;
}

export async function submitSupabaseAnswer(roomId: string, choice: number): Promise<void> {
  const { error } = await createPlayerClient().rpc("submit_room_answer", {
    p_room_id: roomId,
    p_choice: choice,
  });
  if (error) throw error;
}

export async function endSupabaseRoom(roomId: string): Promise<void> {
  const { error } = await createClient().rpc("end_room", { p_room_id: roomId });
  if (error) throw error;
}

export function useSupabaseRoom(
  roomId: string | null,
  isPlayer = false,
): {
  room: LiveRoom | null;
  error: string;
} {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setError("");
      return;
    }

    let active = true;
    setError("");
    let refreshTimeout: number | undefined;
    let requestVersion = 0;
    const client = isPlayer ? createPlayerClient() : createClient();
    const refreshSnapshot = () => {
      const version = ++requestVersion;
      void fetchRoomSnapshot(roomId, isPlayer)
        .then((snapshot) => {
          if (active && version === requestVersion) {
            setRoom(snapshot);
            setError("");
          }
        })
        .catch((cause: unknown) => {
          console.error("Failed to load Supabase room.", cause);
          if (active && version === requestVersion) {
            setError("Gagal menyinkronkan lobby. Periksa koneksi Supabase.");
          }
        });
    };
    const refresh = () => {
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        refreshSnapshot();
      }, 50);
    };

    setRoom(null);
    refreshSnapshot();

    const channel = client
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_answers", filter: `room_id=eq.${roomId}` },
        refresh,
      )
      .subscribe((status: string, error?: Error) => {
        if (status === "SUBSCRIBED") {
          refresh();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Supabase room subscription failed.", error ?? status);
          if (active)
            setError("Sinkronisasi real-time terputus. Muat ulang halaman untuk mencoba lagi.");
        }
      });

    return () => {
      active = false;
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      void client.removeChannel(channel);
    };
  }, [roomId, isPlayer]);

  return { room, error };
}
