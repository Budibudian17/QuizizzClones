import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  Home,
  Loader2,
  Trophy,
  User,
  Users,
  XCircle,
} from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import { TimerRing } from "@/components/TimerRing";
import { ConfettiBurst } from "@/components/Confetti";
import { FinalStandings, Leaderboard, Podium } from "@/components/Results";
import { clearMe, loadMe, rankPlayers, saveMe, type SavedMe } from "@/game/room";
import {
  fetchRoomSnapshot,
  getCurrentPlayerId,
  joinSupabaseRoom,
  submitSupabaseAnswer,
  useSupabaseRoom,
} from "@/game/supabase-room";
import type { PublicQuiz } from "@/game/supabase-room";
import type { Player, RoomState } from "@/game/types";
import { formatPoints } from "@/game/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/join")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gabung Permainan — KampusQuiz" },
      {
        name: "description",
        content: "Masuk dengan Game PIN dan nickname untuk ikut kuis multiplayer real-time.",
      },
      { property: "og:title", content: "Gabung Permainan — KampusQuiz" },
      { property: "og:description", content: "Masuk dengan Game PIN untuk ikut kuis real-time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

const LETTERS = ["A", "B", "C", "D"];
const OPTION_BG = ["bg-opt-1", "bg-opt-2", "bg-opt-3", "bg-opt-4"];

const ERROR_TEXT: Record<string, string> = {
  "room-not-found": "Game PIN tidak ditemukan. Pastikan host sudah menekan “Luncurkan” di dasbor.",
  "wrong-pin": "PIN salah — periksa kembali angkanya.",
  "game-in-progress": "Permainan sudah dimulai. Coba lagi di ronde berikutnya.",
};

function JoinPage() {
  const [session, setSession] = useState<SavedMe | null>(null);
  const [restored, setRestored] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const { room: liveRoom, error: roomError } = useSupabaseRoom(session?.roomId ?? null, true);
  const room = liveRoom?.state ?? null;

  // Restore an in-flight session (e.g. after refresh).
  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const me = loadMe();
        if (!me?.roomId) {
          clearMe();
          return;
        }
        const playerId = await getCurrentPlayerId();
        if (playerId !== me.playerId) {
          clearMe();
          return;
        }
        const current = await fetchRoomSnapshot(me.roomId, true);
        if (
          current.state.pin === me.pin &&
          current.state.players.some((player) => player.id === playerId)
        ) {
          if (active) setSession(me);
        } else {
          clearMe();
        }
      } catch (cause) {
        console.error("Failed to restore player session.", cause);
        if (active)
          setRestoreError("Sesi sebelumnya tidak dapat dipulihkan. Silakan bergabung lagi.");
        clearMe();
      } finally {
        if (active) setRestored(true);
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  const quiz = liveRoom?.quiz ?? null;

  const activeSession = session?.roomId ? session : null;
  const active = activeSession && room && room.pin === activeSession.pin ? room : null;
  const me = active?.players.find((p) => p.id === activeSession?.playerId) ?? null;

  if (!restored) return <div className="min-h-screen bg-background" />;

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="fixed right-4 top-4 z-40">
        <ThemePicker />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-5 py-10">
        {!active || !me ? (
          <JoinForm restoreError={restoreError} onJoined={setSession} />
        ) : roomError ? (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-center text-sm text-destructive"
          >
            {roomError}
          </p>
        ) : !quiz ? (
          <div className="glass flex items-center gap-2 rounded-full px-5 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat kuis…
          </div>
        ) : (
          <PlayerStage
            room={active}
            roomId={activeSession?.roomId ?? ""}
            quiz={quiz}
            me={me}
            playerId={activeSession?.playerId ?? ""}
          />
        )}
      </main>
    </div>
  );
}

/* ------------------------------- join form -------------------------------- */

function JoinForm({
  restoreError,
  onJoined,
}: {
  restoreError: string;
  onJoined: (me: SavedMe) => void;
}) {
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cleanPin = pin.replace(/\D/g, "").slice(0, 6);
    const cleanNick = nickname.trim().slice(0, 16);
    if (cleanPin.length !== 6) {
      setError("Game PIN harus 6 angka.");
      return;
    }
    if (!cleanNick) {
      setError("Isi nickname dulu ya.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const roomId = await joinSupabaseRoom(cleanPin, cleanNick);
      const playerId = await getCurrentPlayerId();
      const me = { playerId, nickname: cleanNick, pin: cleanPin, roomId };
      saveMe(me);
      onJoined(me);
    } catch (cause) {
      console.error("Failed to join Supabase room.", cause);
      const message = cause instanceof Error ? cause.message : "";
      if (message.includes("room-not-found"))
        setError(ERROR_TEXT["room-not-found"] ?? "Game PIN tidak ditemukan.");
      else if (message.includes("game-in-progress"))
        setError(ERROR_TEXT["game-in-progress"] ?? "Permainan sudah dimulai.");
      else if (message.includes("nickname-required")) setError("Isi nickname dulu ya.");
      else setError("Gagal bergabung. Pastikan PIN benar dan coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel anim-pop w-full max-w-sm rounded-3xl p-8 text-center">
      <div className="mb-5 flex justify-start">
        <Link
          to="/"
          className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Gabung Permainan</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Masukkan 6-digit Game PIN dari layar host
      </p>
      {restoreError && <p className="mt-3 text-xs text-muted-foreground">{restoreError}</p>}

      <input
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        inputMode="numeric"
        autoComplete="off"
        placeholder="······"
        aria-label="Game PIN"
        className="numeral mt-7 w-full rounded-2xl border border-input bg-glass px-4 py-4 text-center text-3xl tracking-[0.35em] text-foreground outline-none placeholder:tracking-[0.35em] placeholder:text-muted-foreground/40 focus:border-primary/60"
      />
      <input
        value={nickname}
        onChange={(e) => {
          setNickname(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        maxLength={16}
        placeholder="Nickname"
        aria-label="Nickname"
        className="mt-3 w-full rounded-2xl border border-input bg-glass px-4 py-3.5 text-center text-sm font-medium outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
      />

      {error && <p className="mt-3 text-xs leading-relaxed text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="press-3d mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-display text-base font-bold tracking-tight text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Masuk
      </button>
    </section>
  );
}

/* ------------------------------ player stage ------------------------------ */

function PlayerStage({
  room,
  roomId,
  quiz,
  me,
  playerId,
}: {
  room: RoomState;
  roomId: string;
  quiz: PublicQuiz;
  me: Player;
  playerId: string;
}) {
  const [pendingChoice, setPendingChoice] = useState<number | null>(null);
  const [answerError, setAnswerError] = useState("");
  const question = quiz.questions[room.questionIndex];
  const myAnswer = room.answers[playerId];
  const rank = rankPlayers(room).findIndex((p) => p.id === playerId) + 1;

  useEffect(() => {
    setPendingChoice(null);
    setAnswerError("");
  }, [room.questionIndex]);

  const answer = async (choice: number) => {
    if (pendingChoice !== null || myAnswer) return;
    setPendingChoice(choice);
    setAnswerError("");
    try {
      await submitSupabaseAnswer(roomId, choice);
    } catch (cause) {
      console.error("Failed to submit player answer.", cause);
      setPendingChoice(null);
      setAnswerError("Jawaban gagal dikirim. Coba pilih lagi sebelum waktu habis.");
    }
  };

  let stage = null;
  if (room.phase === "lobby") {
    stage = <PlayerLobby room={room} me={me} />;
  } else if (room.phase === "question" && question) {
    stage = (
      <PlayerQuestion
        question={question}
        lockedChoice={myAnswer?.choice ?? pendingChoice}
        onAnswer={(choice) => void answer(choice)}
        room={room}
        error={answerError}
      />
    );
  } else if (room.phase === "reveal" && question) {
    stage = (
      <PlayerReveal question={question} myChoice={myAnswer?.choice ?? null} gain={me.lastGain} />
    );
  } else if (room.phase === "leaderboard") {
    stage = (
      <section className="anim-pop flex w-full flex-col items-center text-center">
        <Crown className="h-7 w-7 text-accent" />
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Peringkat</h1>
        <p className="numeral mt-1 text-sm text-muted-foreground">
          Peringkatmu: {rank > 0 ? rank : "-"} · {formatPoints(me.score)} poin
        </p>
        <div className="mt-5 w-full max-w-sm">
          <Leaderboard players={rankPlayers(room)} meId={playerId} compact />
        </div>
      </section>
    );
  } else {
    stage = <PlayerPodium room={room} rank={rank} meId={playerId} />;
  }

  return stage;
}

function PlayerLobby({ room, me }: { room: RoomState; me: RoomState["players"][number] }) {
  return (
    <section className="flex w-full flex-col items-center text-center">
      <div className="lift-3d panel anim-pop flex items-center gap-3 rounded-2xl px-6 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20">
          <User className="h-4.5 w-4.5 text-primary" />
        </span>
        <div className="text-left">
          <p className="font-display text-base font-bold tracking-tight">{me.nickname}</p>
          <p className="text-xs text-muted-foreground">Kamu sudah bergabung</p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        Menunggu host memulai permainan…
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span className="numeral text-sm text-foreground">{room.players.length}</span> pemain di
        lobby
      </div>

      <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
        {room.players.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "lift-3d glass anim-pop flex items-center gap-2 rounded-2xl px-4 py-2.5",
              p.id === me.id && "border-primary/50 bg-primary/10",
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20">
              <User className="h-3.5 w-3.5 text-primary" />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight">{p.nickname}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerQuestion({
  question,
  lockedChoice,
  onAnswer,
  room,
  error,
}: {
  question: PublicQuiz["questions"][number];
  lockedChoice: number | null;
  onAnswer: (choice: number) => void;
  room: RoomState;
  error: string;
}) {
  if (lockedChoice !== null) {
    return (
      <section
        aria-live="polite"
        className="anim-pop flex w-full flex-col items-center gap-4 text-center"
      >
        <TimerRing startedAt={room.phaseStartedAt} durationMs={room.durationMs} size={120} />
        <p className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-4 py-1.5 text-xs font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Jawaban terkunci
        </p>
        <p className="text-sm text-muted-foreground">Menunggu pemain lain menjawab…</p>
      </section>
    );
  }

  return (
    <section className="w-full text-center">
      <div className="mb-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <TimerRing startedAt={room.phaseStartedAt} durationMs={room.durationMs} size={112} />
        <span className="numeral rounded-full border border-glass-border bg-glass px-3 py-1 text-sm text-muted-foreground">
          Soal {room.questionIndex + 1}
        </span>
      </div>
      <h1 className="anim-pop mt-5 font-display text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
        {question.text}
      </h1>
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {question.options.map((option, i) => {
          return (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={cn(
                "press-3d flex items-center gap-3 rounded-2xl px-5 py-5 text-left text-white/95 shadow-elevated",
                OPTION_BG[i],
              )}
            >
              <span className="numeral flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/25 text-sm">
                {LETTERS[i]}
              </span>
              <span className="font-display text-sm font-semibold tracking-tight sm:text-base">
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PlayerReveal({
  question,
  myChoice,
  gain,
}: {
  question: PublicQuiz["questions"][number];
  myChoice: number | null;
  gain: number;
}) {
  const correct = myChoice !== null && myChoice === question.correctIndex;

  return (
    <section className="relative flex w-full flex-col items-center text-center">
      <ConfettiBurst burst={correct ? 1 : 0} key={`burst-${question.id}-${correct}`} />
      <div
        className={cn(
          "anim-pop flex h-16 w-16 items-center justify-center rounded-3xl border",
          correct ? "border-success/50 bg-success/15" : "border-destructive/50 bg-destructive/10",
        )}
      >
        {correct ? (
          <CheckCircle2 className="h-8 w-8 text-success" />
        ) : (
          <XCircle className="h-8 w-8 text-destructive" />
        )}
      </div>
      <h1
        className="anim-pop mt-4 font-display text-2xl font-extrabold tracking-tight"
        style={{ animationDelay: "80ms" }}
      >
        {correct ? "Benar!" : myChoice === null ? "Waktu habis" : "Belum tepat"}
      </h1>
      {correct && gain > 0 && (
        <p
          className="numeral anim-pop mt-1 text-3xl text-success"
          style={{ animationDelay: "160ms" }}
        >
          +{formatPoints(gain)}
        </p>
      )}
      {!correct && question.correctIndex !== undefined && (
        <p className="mt-2 text-sm text-muted-foreground">
          Jawaban benar:{" "}
          <span className="font-semibold text-accent">
            {LETTERS[question.correctIndex]}. {question.options[question.correctIndex]}
          </span>
        </p>
      )}
      {myChoice !== null && !correct && (
        <p className="mt-1 text-xs text-muted-foreground">
          Jawabanmu: {LETTERS[myChoice]}. {question.options[myChoice]}
        </p>
      )}
    </section>
  );
}

function PlayerPodium({ room, rank, meId }: { room: RoomState; rank: number; meId: string }) {
  const navigate = useNavigate();
  const [canReturnHome, setCanReturnHome] = useState(false);
  const [showStandings, setShowStandings] = useState(false);

  useEffect(() => {
    const standingsTimeout = window.setTimeout(() => setShowStandings(true), 3000);
    const homeTimeout = window.setTimeout(() => setCanReturnHome(true), 10_600);
    return () => {
      window.clearTimeout(standingsTimeout);
      window.clearTimeout(homeTimeout);
    };
  }, []);

  return (
    <section className="flex w-full flex-col items-center text-center">
      <ConfettiBurst burst={rank <= 3 ? 1 : 0} key={`podium-${room.pin}`} />
      <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
        Permainan Selesai
      </h1>
      <p className="numeral mt-2 text-lg text-muted-foreground">
        {rank === 1 ? (
          <span className="inline-flex items-center gap-2">
            Juara 1 — selamat!
            <Trophy aria-label="Piala" className="h-5 w-5 text-accent" />
          </span>
        ) : (
          `Kamu finis di peringkat ${rank}`
        )}
      </p>
      <div className="mt-10 w-full">
        <Podium players={rankPlayers(room)} />
      </div>
      {showStandings && (
        <FinalStandings players={rankPlayers(room)} meId={meId} className="mt-10" />
      )}
      {canReturnHome ? (
        <button
          onClick={() => {
            clearMe();
            navigate({ to: "/" });
          }}
          className="press-3d mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground anim-pop"
        >
          <Home className="h-4 w-4" />
          Kembali ke menu utama
        </button>
      ) : (
        <p className="mt-8 text-xs text-muted-foreground">
          Tombol kembali tersedia setelah podium ditampilkan…
        </p>
      )}
    </section>
  );
}
