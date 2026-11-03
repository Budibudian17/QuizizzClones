import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  LogOut,
  Play,
  RotateCcw,
  User,
  Users,
} from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { ThemePicker } from "@/components/ThemePicker";
import { TimerRing } from "@/components/TimerRing";
import { CountdownView } from "@/components/CountdownView";
import { GameAudioControls } from "@/components/GameAudioControls";
import { RoomVoiceChat } from "@/components/RoomVoiceChat";
import { ConfettiBurst } from "@/components/Confetti";
import { FinalLeaderboard, FinalStandings, Leaderboard, Podium } from "@/components/Results";
import { getRoom, MIN_PLAYERS_TO_START, rankPlayers } from "@/game/room";
import {
  endSupabaseRoom,
  ensureHostRoom,
  getHostQuiz,
  startSupabaseRoom,
  tickSupabaseRoom,
  useSupabaseRoom,
} from "@/game/supabase-room";
import { getHostUser, getOwnedQuiz } from "@/game/supabase-quizzes";
import type { Player, Quiz } from "@/game/types";
import { normalizeAvatar } from "@/game/player-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/host")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { quiz?: string } => {
    const quiz = typeof search["quiz"] === "string" ? search["quiz"] : undefined;
    return quiz ? { quiz } : {};
  },
  head: () => ({
    meta: [
      { title: "Layar Host — KampusQuiz" },
      {
        name: "description",
        content: "Layar host: Game PIN, lobby real-time, pertanyaan, hasil, dan podium juara.",
      },
      { property: "og:title", content: "Layar Host — KampusQuiz" },
      { property: "og:description", content: "Kendalikan sesi kuis multiplayer secara real-time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HostPage,
});

const LETTERS = ["A", "B", "C", "D"];
const OPTION_BG = ["bg-opt-1", "bg-opt-2", "bg-opt-3", "bg-opt-4"];

function HostPage() {
  const navigate = useNavigate();
  const { quiz: quizId } = Route.useSearch();
  const [roomId, setRoomId] = useState<string | null>(null);
  const { room: liveRoom, error: roomError } = useSupabaseRoom(roomId);
  const room = liveRoom?.state ?? null;
  const [loadedQuiz, setLoadedQuiz] = useState<Quiz | null>(null);
  const quiz = getHostQuiz(liveRoom) ?? loadedQuiz;
  const [authorized, setAuthorized] = useState(false);
  const [hostPeerId, setHostPeerId] = useState("");
  const [confetti, setConfetti] = useState(0);
  const [pageError, setPageError] = useState("");
  const roomPhase = room?.phase;

  useEffect(() => {
    if (!quizId) {
      navigate({ to: "/dashboard" });
      return;
    }
    let active = true;
    void getHostUser()
      .then(async (user) => {
        if (!user) {
          navigate({ to: "/", replace: true });
          return;
        }
        const found = await getOwnedQuiz(user.id, quizId);
        if (!found) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        const roomSession = await ensureHostRoom(found.id);
        if (!active) return;
        setAuthorized(true);
        setHostPeerId(user.id);
        setLoadedQuiz(found);
        setRoomId(roomSession.roomId);
      })
      .catch((cause: unknown) => {
        console.error("Failed to load host game.", cause);
        if (active)
          setPageError("Gagal membuka permainan. Periksa koneksi Supabase lalu coba lagi.");
      });
    return () => {
      active = false;
    };
  }, [quizId, navigate]);

  // The host advances the shared database room; connected clients receive Realtime updates.
  useEffect(() => {
    if (!roomId || !quiz || !roomPhase || roomPhase === "lobby" || roomPhase === "podium") return;
    let pending = false;
    const t = window.setInterval(() => {
      if (pending) return;
      pending = true;
      void tickSupabaseRoom(roomId)
        .catch((cause: unknown) => {
          console.error("Failed to advance game room.", cause);
          setPageError("Sinkronisasi permainan terganggu. Periksa koneksi lalu muat ulang.");
        })
        .finally(() => {
          pending = false;
        });
    }, 750);
    return () => window.clearInterval(t);
  }, [roomId, quiz, roomPhase]);

  useEffect(() => {
    if (room?.phase === "podium") setConfetti((c) => c + 1);
  }, [room?.phase]);

  if (!authorized || !quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-sm text-muted-foreground">
        {pageError || roomError || "Memuat permainan…"}
      </div>
    );
  }

  const question = quiz.questions[room?.questionIndex ?? 0];

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      {room && roomId && hostPeerId && (
        <>
          <GameAudioControls
            phase={room.phase}
            phaseStartedAt={room.phaseStartedAt}
            durationMs={room.durationMs}
          />
          <RoomVoiceChat roomId={roomId} peerId={hostPeerId} isHost />
        </>
      )}
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Dasbor
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="glass hidden max-w-56 truncate rounded-full px-4 py-2 font-display text-sm font-semibold tracking-tight sm:inline-block">
              {quiz.title}
            </span>
            <ThemePicker />
            <button
              onClick={() => {
                if (!roomId) return;
                void endSupabaseRoom(roomId)
                  .then(() => navigate({ to: "/dashboard" }))
                  .catch((cause: unknown) => {
                    console.error("Failed to end game room.", cause);
                    setPageError("Gagal mengakhiri permainan.");
                  });
              }}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Akhiri
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8">
          {!room || room.phase === "lobby" ? (
            <HostLobby
              pin={room?.pin}
              players={room?.players ?? []}
              minPlayers={MIN_PLAYERS_TO_START}
              onStart={() => {
                if (!roomId) return;
                void startSupabaseRoom(roomId).catch((cause: unknown) => {
                  console.error("Failed to start game.", cause);
                  setPageError(
                    "Permainan belum bisa dimulai. Pastikan minimal 2 pemain sudah bergabung lalu coba lagi.",
                  );
                });
              }}
            />
          ) : room.phase === "countdown" ? (
            <CountdownView startedAt={room.phaseStartedAt} durationMs={room.durationMs} />
          ) : room.phase === "question" && question ? (
            <HostQuestion question={question} room={room} total={quiz.questions.length} />
          ) : room.phase === "reveal" && question ? (
            <HostReveal question={question} room={room} />
          ) : room.phase === "leaderboard" ? (
            room.questionIndex === quiz.questions.length - 1 ? (
              <FinalLeaderboard players={rankPlayers(room)} />
            ) : (
              <section className="anim-pop flex w-full max-w-md flex-col items-center text-center">
                <Crown className="h-8 w-8 text-accent" />
                <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
                  Peringkat
                </h1>
                <div className="mt-6">
                  <Leaderboard players={rankPlayers(room)} />
                </div>
              </section>
            )
          ) : (
            <HostPodium
              room={room}
              quiz={quiz}
              confetti={confetti}
              onPlayAgain={() => {
                void ensureHostRoom(quiz.id)
                  .then((nextRoom) => setRoomId(nextRoom.roomId))
                  .catch((cause: unknown) => {
                    console.error("Failed to create a new room.", cause);
                    setPageError("Gagal membuat permainan baru.");
                  });
              }}
            />
          )}
        </main>
        {pageError && (
          <p role="alert" className="pb-4 text-center text-sm text-destructive">
            {pageError}
          </p>
        )}
        {roomError && (
          <p role="alert" className="pb-4 text-center text-sm text-destructive">
            {roomError}
          </p>
        )}
      </div>
    </div>
  );
}

function HostPodium({
  room,
  quiz,
  confetti,
  onPlayAgain,
}: {
  room: NonNullable<ReturnType<typeof getRoom>>;
  quiz: Quiz;
  confetti: number;
  onPlayAgain: () => void;
}) {
  const [showStandings, setShowStandings] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowStandings(true), 3000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section className="flex w-full flex-col items-center text-center">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Papan Juara
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Permainan selesai — terima kasih sudah bermain!
      </p>
      <div className="relative mt-10 flex w-full justify-center">
        <ConfettiBurst burst={confetti} />
        <Podium players={rankPlayers(room)} />
      </div>
      {showStandings && <FinalStandings players={rankPlayers(room)} className="mt-10 anim-pop" />}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={onPlayAgain}
          className="press-3d inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <RotateCcw className="h-4 w-4" />
          Main lagi
        </button>
        <Link
          to="/dashboard"
          className="press-3d inline-flex items-center gap-2 rounded-xl border border-input bg-glass px-5 py-2.5 text-sm font-medium"
        >
          Kembali ke dasbor
        </Link>
      </div>
    </section>
  );
}

/* --------------------------------- lobby ---------------------------------- */

function HostLobby({
  pin,
  players,
  minPlayers,
  onStart,
}: {
  pin: string | undefined;
  players: Player[];
  minPlayers: number;
  onStart: () => void;
}) {
  const [copyMessage, setCopyMessage] = useState("");

  const copyPin = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopyMessage("PIN berhasil disalin.");
    } catch {
      setCopyMessage("Gagal menyalin PIN. Silakan salin secara manual.");
    }
  };

  return (
    <section className="flex w-full max-w-lg flex-col items-center text-center">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Game PIN
      </p>
      <h1 className="numeral mt-2 text-7xl leading-none text-foreground sm:text-8xl">
        {pin ?? "······"}
      </h1>
      <button
        onClick={copyPin}
        disabled={!pin}
        className="press-3d glass mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        <Copy className="h-4 w-4" />
        Salin PIN
      </button>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted-foreground">
        {copyMessage}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Bagikan PIN ini. Pemain bisa bergabung dari halaman Join sebelum permainan dimulai.
      </p>

      <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          <span className="numeral text-base text-foreground">{players.length}</span> pemain
          tergabung
        </span>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onStart}
          disabled={players.length < minPlayers}
          className="press-3d inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 font-display text-base font-bold tracking-tight text-primary-foreground shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Play className="h-4 w-4" fill="currentColor" />
          Mulai permainan
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {players.length < minPlayers
          ? `Minimal ${minPlayers} pemain bergabung untuk memulai (${players.length}/${minPlayers}).`
          : `Sudah cukup pemain. Host bisa memulai permainan sekarang.`}
      </p>

      <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {players.map((p, i) => (
          <div
            key={p.id}
            className="lift-3d glass anim-pop flex flex-col items-center rounded-2xl px-3 py-3"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <PlayerAvatar avatar={normalizeAvatar(p.avatar)} className="h-28 w-[4.65rem]" />
            <span className="mt-2 max-w-full truncate font-display text-sm font-semibold tracking-tight">
              {p.nickname}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- question -------------------------------- */

function HostQuestion({
  question,
  room,
  total,
}: {
  question: Quiz["questions"][number];
  room: NonNullable<ReturnType<typeof getRoom>>;
  total: number;
}) {
  const answered = Object.keys(room.answers).length;
  return (
    <section className="grid w-full gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="anim-pop">
        <div className="flex items-center gap-3">
          <span className="numeral rounded-full border border-glass-border bg-glass px-3 py-1 text-sm text-muted-foreground">
            Soal {room.questionIndex + 1}/{total}
          </span>
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="numeral text-foreground">{answered}</span>
            <span>jawaban masuk</span>
          </span>
        </div>
        <h1 className="mt-5 max-w-2xl font-display text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
          {question.text}
        </h1>
        {question.source === "opentdb" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Sumber soal:{" "}
            <a
              href="https://opentdb.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              Open Trivia Database (CC BY-SA 4.0)
            </a>
          </p>
        )}
        <div className="mt-6 grid max-w-2xl gap-2.5 sm:grid-cols-2">
          {question.options.map((option, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-white/95",
                OPTION_BG[i],
              )}
            >
              <span className="numeral flex h-7 w-7 items-center justify-center rounded-lg bg-black/20 text-sm">
                {LETTERS[i]}
              </span>
              <span className="text-sm font-medium">{option}</span>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Status jawaban · {answered}/{room.players.length}
          </h2>
          <ul className="mt-2 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
            {room.players.map((player) => {
              const hasAnswered = Boolean(room.answers[player.id]);
              return (
                <li
                  key={player.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                    hasAnswered ? "border-success/30 bg-success/5" : "border-glass-border bg-glass",
                  )}
                >
                  {hasAnswered ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{player.nickname}</span>
                  <span
                    className={cn(
                      "text-xs",
                      hasAnswered ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {hasAnswered ? "Menjawab" : "Menunggu"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4">
        <TimerRing startedAt={room.phaseStartedAt} durationMs={room.durationMs} size={190} />
        <p className="text-xs text-muted-foreground">Timer berjalan untuk semua pemain</p>
      </div>
    </section>
  );
}

/* --------------------------------- reveal --------------------------------- */

function HostReveal({
  question,
  room,
}: {
  question: Quiz["questions"][number];
  room: NonNullable<ReturnType<typeof getRoom>>;
}) {
  const count = (i: number) => Object.values(room.answers).filter((a) => a.choice === i).length;
  const total = Math.max(
    1,
    question.options.reduce((acc, _, i) => acc + count(i), 0),
  );

  return (
    <section className="anim-pop w-full max-w-2xl">
      <div className="flex items-center gap-2 text-accent">
        <Check className="h-5 w-5" strokeWidth={2.5} />
        <h1 className="font-display text-xl font-bold tracking-tight">Jawaban benar</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{question.text}</p>
      <div className="mt-6 space-y-2.5">
        {question.options.map((option, i) => {
          const correct = question.correctIndex === i;
          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3",
                correct ? "border-accent/60 bg-accent/10" : "border-glass-border bg-glass",
              )}
            >
              <span
                className={cn(
                  "numeral flex h-7 w-7 items-center justify-center rounded-lg text-sm",
                  correct ? "bg-accent/20 text-accent" : "bg-glass text-muted-foreground",
                )}
              >
                {LETTERS[i]}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm font-medium",
                  correct && "text-accent",
                )}
              >
                {option}
              </span>
              <span className="numeral text-sm text-muted-foreground">{count(i)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 space-y-2">
        {question.options.map((option, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-4 text-right text-xs text-muted-foreground">{LETTERS[i]}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-glass">
              <div
                className={cn(
                  "anim-bar h-full rounded-full",
                  question.correctIndex === i ? "bg-accent" : "bg-primary/60",
                )}
                style={{ width: `${(count(i) / total) * 100}%`, animationDelay: `${i * 90}ms` }}
              />
            </div>
            <span className="numeral w-10 text-xs text-muted-foreground">
              {Math.round((count(i) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
