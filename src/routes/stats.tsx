import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, LogOut, Medal, Target, Trophy } from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import {
  getPlayerGameResults,
  getPlayerSoloResults,
  type PlayerGameResult,
  type PlayerSoloResult,
} from "@/game/player-stats";
import { formatPoints } from "@/game/scoring";
import { createPlayerClient } from "@/utils/supabase/client";

export const Route = createFileRoute("/stats")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Statistik Pemain — KampusQuiz" },
      { name: "description", content: "Riwayat permainan dan statistik akun pemain KampusQuiz." },
    ],
  }),
  component: PlayerStatsPage,
});

function PlayerStatsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<PlayerGameResult[] | null>(null);
  const [soloResults, setSoloResults] = useState<PlayerSoloResult[] | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const { data, error: sessionError } = await createPlayerClient().auth.getSession();
        if (sessionError) throw sessionError;
        const user = data.session?.user;
        if (!user || user.is_anonymous === true) {
          if (active) setGuest(true);
          return;
        }

        const [history, soloHistory] = await Promise.all([
          getPlayerGameResults(),
          getPlayerSoloResults(),
        ]);
        if (!active) return;
        setEmail(user.email ?? "Akun pemain");
        setResults(history);
        setSoloResults(soloHistory);
      } catch (cause) {
        console.error("Failed to load player statistics.", cause);
        if (active) {
          const message = cause instanceof Error ? cause.message : "";
          setError(
            /player_game_results|record_player_game_result|player_solo_results|record_player_solo_result|schema cache/i.test(
              message,
            )
              ? "Fitur statistik belum siap di database. Terapkan migration statistik pemain dan solo practice di Supabase, lalu muat ulang."
              : message || "Statistik gagal dimuat. Periksa koneksi Supabase lalu coba lagi.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadStats();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const history = results ?? [];
    const soloHistory = soloResults ?? [];
    const wins = history.filter((result) => result.final_rank === 1).length;
    const podiums = history.filter((result) => result.final_rank <= 3).length;
    const multiplayerCorrect = history.reduce((total, result) => total + result.correct_answers, 0);
    const multiplayerQuestions = history.reduce(
      (total, result) => total + result.total_questions,
      0,
    );
    const soloCorrect = soloHistory.reduce((total, result) => total + result.correct_answers, 0);
    const soloAnswered = soloHistory.reduce(
      (total, result) => total + result.answered_questions,
      0,
    );
    return {
      multiplayerGames: history.length,
      soloGames: soloHistory.length,
      games: history.length + soloHistory.length,
      wins,
      podiums,
      winRate: history.length ? Math.round((wins / history.length) * 100) : 0,
      multiplayerAccuracy: multiplayerQuestions
        ? Math.round((multiplayerCorrect / multiplayerQuestions) * 100)
        : 0,
      soloAccuracy: soloAnswered ? Math.round((soloCorrect / soloAnswered) * 100) : 0,
    };
  }, [results, soloResults]);

  const signOut = async () => {
    const { error: signOutError } = await createPlayerClient().auth.signOut();
    if (signOutError) {
      console.error("Failed to sign out player account.", signOutError);
      setError("Gagal keluar dari akun. Coba lagi.");
      return;
    }
    navigate({ to: "/join", replace: true });
  };

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="fixed right-4 top-4 z-40">
        <ThemePicker />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-3 pr-14 sm:pr-0">
          <Link
            to="/player-dashboard"
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard pemain
          </Link>
          {!guest && !loading && (
            <button
              onClick={() => void signOut()}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          )}
        </header>

        <section className="mt-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                Statistik pemain
              </h1>
              {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
            </div>
          </div>
        </section>

        {loading ? (
          <p role="status" className="mt-8 text-sm text-muted-foreground">
            Memuat statistik…
          </p>
        ) : guest ? (
          <section className="panel mt-8 rounded-3xl p-6 text-center">
            <h2 className="font-display text-lg font-bold">Masuk dengan akun pemain</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Statistik lintas permainan hanya tersimpan untuk akun permanen, bukan sesi guest.
            </p>
            <Link
              to="/player-dashboard"
              className="press-3d mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Masuk atau daftar
            </Link>
          </section>
        ) : error ? (
          <p
            role="alert"
            className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Permainan" value={String(stats.games)} icon={<BarChart3 />} />
              <StatCard
                label="Multiplayer"
                value={String(stats.multiplayerGames)}
                icon={<BarChart3 />}
              />
              <StatCard label="Latihan solo" value={String(stats.soloGames)} icon={<Target />} />
              <StatCard label="Menang" value={String(stats.wins)} icon={<Trophy />} />
              <StatCard label="Podium" value={String(stats.podiums)} icon={<Medal />} />
              <StatCard label="Winrate MP" value={`${stats.winRate}%`} icon={<Target />} />
            </div>

            <section className="mt-8">
              <h2 className="font-display text-lg font-bold">Riwayat multiplayer</h2>
              {results?.length ? (
                <ol className="mt-4 space-y-3">
                  {results.map((result) => (
                    <li
                      key={result.room_id}
                      className="panel flex flex-wrap items-center gap-3 rounded-2xl p-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display font-bold text-primary">
                        #{result.final_rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold">
                          {result.quiz_title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(result.played_at))}
                          {" · "}
                          {result.correct_answers}/{result.total_questions} jawaban benar
                        </p>
                      </div>
                      <span className="numeral text-sm text-muted-foreground">
                        {formatPoints(result.final_score)} poin
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">
                  Belum ada permainan selesai yang tercatat. Hasil game berikutnya akan muncul di
                  sini.
                </p>
              )}
            </section>
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold">Statistik latihan solo</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Akurasi: {stats.soloAccuracy}% ·{" "}
                    {soloResults?.reduce((total, result) => total + result.correct_answers, 0) ?? 0}
                    /
                    {soloResults?.reduce((total, result) => total + result.total_questions, 0) ?? 0}{" "}
                    soal benar
                  </p>
                </div>
              </div>
              {soloResults?.length ? (
                <ol className="mt-4 space-y-3">
                  {soloResults.map((result) => (
                    <li
                      key={result.id}
                      className="panel flex flex-wrap items-center gap-3 rounded-2xl p-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                        <Target className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-semibold">
                          {result.quiz_title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(result.played_at))}
                          {" · "}
                          {result.correct_answers}/{result.total_questions} benar ·{" "}
                          {result.answered_questions} dijawab
                        </p>
                      </div>
                      <span className="numeral text-sm text-muted-foreground">
                        {result.answered_questions
                          ? Math.round((result.correct_answers / result.answered_questions) * 100)
                          : 0}
                        % akurasi
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">
                  Belum ada latihan solo selesai yang tersimpan di akun ini.
                </p>
              )}
            </section>
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold">Akurasi multiplayer</h2>
              <p className="panel mt-4 rounded-2xl p-5 text-sm text-muted-foreground">
                {stats.multiplayerAccuracy}% jawaban benar dari permainan multiplayer yang
                tersimpan.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="panel rounded-2xl p-4">
      <span className="text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <p className="numeral mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </article>
  );
}
