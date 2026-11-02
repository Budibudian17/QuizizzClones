import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Clock3, LogOut, RotateCcw, XCircle } from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import { TimerRing } from "@/components/TimerRing";
import { getPublicQuiz } from "@/game/supabase-quizzes";
import {
  fetchTriviaQuiz,
  loadTriviaCategories,
  translateTriviaQuizToIndonesian,
  type TriviaCategory,
  type TriviaDifficulty,
  type TriviaLanguage,
} from "@/game/open-trivia";
import { summarizePractice } from "@/game/practice";
import { recordPlayerSoloResult } from "@/game/player-stats";
import { remainingMs, useNow } from "@/game/useRoom";
import { type Quiz } from "@/game/types";
import { cn } from "@/lib/utils";
import { createPlayerClient } from "@/utils/supabase/client";

export const Route = createFileRoute("/practice")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { quiz?: string; from?: "player-dashboard" } => {
    const quiz = typeof search["quiz"] === "string" ? search["quiz"] : undefined;
    const from = search["from"] === "player-dashboard" ? "player-dashboard" : undefined;
    return { ...(quiz && { quiz }), ...(from && { from }) };
  },
  head: () => ({
    meta: [
      { title: "Latihan Solo — KampusQuiz" },
      {
        name: "description",
        content: "Latihan kuis sendiri dengan batas waktu untuk menjawab semua soal.",
      },
    ],
  }),
  component: PracticePage,
});

const TIME_LIMITS = [60, 120, 180, 300] as const;
const LETTERS = ["A", "B", "C", "D"];
const OPTION_BG = ["bg-opt-1", "bg-opt-2", "bg-opt-3", "bg-opt-4"];

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function PracticePage() {
  const { quiz: quizId, from } = Route.useSearch();
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categories, setCategories] = useState<TriviaCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<TriviaLanguage>("id");
  const [questionAmount, setQuestionAmount] = useState("10");
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    let active = true;
    const restorePlayerAccount = async () => {
      try {
        const { data, error: sessionError } = await createPlayerClient().auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        const user = data.session?.user;
        if (user && user.is_anonymous !== true) {
          setAccountEmail(user.email ?? "Akun pemain");
          setAuthStatus("signed-in");
        } else {
          setAuthStatus("signed-out");
        }
      } catch (cause: unknown) {
        console.error("Failed to restore player account for solo practice.", cause);
        if (active) {
          setAuthStatus("signed-out");
          setAuthError("Sesi akun tidak dapat diperiksa. Silakan masuk kembali.");
        }
      }
    };
    void restorePlayerAccount();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (authStatus !== "signed-in") {
      setLoading(false);
      setQuiz(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    const loadQuizzes = async () => {
      try {
        if (quizId) {
          const found = await getPublicQuiz(quizId);
          if (!active) return;
          if (!found) {
            setError("Kuis tidak ditemukan atau belum dipublikasikan untuk latihan solo.");
          } else {
            setQuiz(
              found.questions.some((question) => question.source === "opentdb") &&
                !found.description.includes("MyMemory")
                ? await translateTriviaQuizToIndonesian(found)
                : found,
            );
          }
        } else {
          const loadedCategories = await loadTriviaCategories();
          if (active) setCategories(loadedCategories);
        }
      } catch (cause: unknown) {
        console.error("Failed to load solo practice options.", cause);
        if (active) setError("Gagal memuat pilihan latihan. Periksa koneksi lalu coba lagi.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQuizzes();

    return () => {
      active = false;
    };
  }, [authStatus, quizId]);

  const startApiPractice = async () => {
    setFetchingQuestions(true);
    setApiError("");
    try {
      const generatedQuiz = await fetchTriviaQuiz({
        amount: Number(questionAmount),
        ...(selectedCategory && { categoryId: Number(selectedCategory) }),
        ...(selectedDifficulty && {
          difficulty: selectedDifficulty as TriviaDifficulty,
        }),
        language: selectedLanguage,
      });
      setQuiz(generatedQuiz);
    } catch (cause: unknown) {
      console.error("Failed to fetch Open Trivia DB questions.", cause);
      setApiError(
        cause instanceof Error ? cause.message : "Gagal mengambil soal. Silakan coba lagi.",
      );
    } finally {
      setFetchingQuestions(false);
    }
  };

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const client = createPlayerClient();
      if (authMode === "sign-up") {
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (sessionData.session) {
          const { error: signOutError } = await client.auth.signOut();
          if (signOutError) throw signOutError;
        }
      }
      const result =
        authMode === "sign-up"
          ? await client.auth.signUp({
              email: email.trim(),
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/practice${
                  from === "player-dashboard" ? "?from=player-dashboard" : ""
                }`,
              },
            })
          : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (authMode === "sign-up" && !result.data.session) {
        setAuthMessage("Cek email untuk konfirmasi akun, lalu buka tautannya untuk mulai latihan.");
        return;
      }
      if (result.data.user.is_anonymous === true)
        throw new Error("Latihan solo hanya tersedia untuk akun pemain dengan email.");
      setAccountEmail(result.data.user.email ?? email.trim());
      setAuthStatus("signed-in");
      setAuthMessage("");
    } catch (cause: unknown) {
      console.error("Player account authentication for solo practice failed.", cause);
      setAuthError(
        cause instanceof Error ? cause.message : "Gagal masuk atau mendaftar. Silakan coba lagi.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error: signOutError } = await createPlayerClient().auth.signOut();
      if (signOutError) throw signOutError;
      setAccountEmail("");
      setAuthStatus("signed-out");
    } catch (cause: unknown) {
      console.error("Failed to sign out of solo practice.", cause);
      setAuthError("Gagal keluar dari akun. Silakan coba lagi.");
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="fixed right-4 top-4 z-40">
        <ThemePicker />
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-3 pr-14 sm:pr-0">
          <Link
            to={from === "player-dashboard" ? "/player-dashboard" : "/"}
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {from === "player-dashboard" ? "Dashboard pemain" : "Beranda"}
          </Link>
        </header>

        {authStatus === "checking" ? (
          <p role="status" className="mt-12 text-center text-sm text-muted-foreground">
            Memeriksa akun…
          </p>
        ) : authStatus === "signed-out" ? (
          <section className="panel anim-pop mx-auto mt-12 w-full max-w-sm rounded-3xl p-6 sm:p-8">
            <h1 className="text-center font-display text-2xl font-extrabold tracking-tight">
              Masuk untuk latihan
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              Gunakan akun pemain atau daftar dengan email. Latihan solo tidak bisa memakai mode
              guest.
            </p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {authMode === "sign-up" ? "Daftar akun pemain" : "Masuk akun pemain"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
                  setAuthError("");
                  setAuthMessage("");
                }}
                className="text-sm font-medium text-accent hover:underline"
              >
                {authMode === "sign-up" ? "Sudah punya akun?" : "Daftar"}
              </button>
            </div>
            <form onSubmit={authenticate} className="mt-4 space-y-3">
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                aria-label="Email akun pemain"
                className="w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary/60"
              />
              <input
                type="password"
                autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                minLength={authMode === "sign-up" ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                aria-label="Password akun pemain"
                className="w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary/60"
              />
              <button
                type="submit"
                disabled={authBusy}
                className="press-3d w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {authBusy ? "Memproses…" : authMode === "sign-up" ? "Daftar" : "Masuk"}
              </button>
            </form>
            {authError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {authError}
              </p>
            )}
            {authMessage && (
              <p role="status" className="mt-3 text-sm text-success">
                {authMessage}
              </p>
            )}
          </section>
        ) : authStatus === "signed-in" && loading ? (
          <p role="status" className="mt-12 text-center text-sm text-muted-foreground">
            Memuat pilihan latihan…
          </p>
        ) : authStatus === "signed-in" && error ? (
          <section className="panel mt-12 rounded-3xl p-6 text-center">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press-3d mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Coba lagi
            </button>
          </section>
        ) : authStatus === "signed-in" && quiz ? (
          <PracticeGame
            key={quiz.id}
            quiz={quiz}
            {...(from && { from })}
            {...(quiz.questions.some((question) => question.source === "opentdb") && {
              onNewQuestions: () => setQuiz(null),
            })}
          />
        ) : authStatus === "signed-in" ? (
          <section className="panel anim-pop mx-auto mt-10 w-full max-w-xl rounded-3xl p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Latihan solo · Open Trivia DB
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
              Latihan soal acak
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pilih bahasa, kategori, dan tingkat kesulitan, lalu kerjakan soal dalam batas waktu.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-semibold">Bahasa soal</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["id", "Bahasa Indonesia"],
                      ["en", "English"],
                    ] as const
                  ).map(([language, label]) => (
                    <button
                      key={language}
                      type="button"
                      aria-pressed={selectedLanguage === language}
                      onClick={() => setSelectedLanguage(language)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                        selectedLanguage === language
                          ? "border-primary/60 bg-primary/15 text-primary"
                          : "border-glass-border bg-glass text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="text-sm font-semibold">
                Kategori
                <select
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                >
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Kesulitan
                <select
                  value={selectedDifficulty}
                  onChange={(event) => setSelectedDifficulty(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                >
                  <option value="">Acak</option>
                  <option value="easy">Mudah</option>
                  <option value="medium">Menengah</option>
                  <option value="hard">Sulit</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Jumlah soal
                <select
                  value={questionAmount}
                  onChange={(event) => setQuestionAmount(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                >
                  {[5, 10, 20, 50].map((amount) => (
                    <option key={amount} value={amount}>
                      {amount} soal
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {apiError && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {apiError}
              </p>
            )}
            <button
              type="button"
              onClick={() => void startApiPractice()}
              disabled={fetchingQuestions || categories.length === 0}
              className="press-3d mt-6 w-full rounded-xl bg-primary px-5 py-3 font-display font-bold text-primary-foreground disabled:opacity-50"
            >
              {fetchingQuestions ? "Mengambil soal…" : "Ambil soal & mulai latihan"}
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              Soal disediakan oleh{" "}
              <a
                href="https://opentdb.com/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline underline-offset-2"
              >
                Open Trivia Database
              </a>{" "}
              di bawah lisensi CC BY-SA 4.0.
              {selectedLanguage === "id" && (
                <>
                  {" "}
                  Terjemahan otomatis memakai{" "}
                  <a
                    href="https://mymemory.translated.net/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent underline underline-offset-2"
                  >
                    MyMemory
                  </a>
                  , jika kuota habis, teks asli tetap digunakan.
                </>
              )}
            </p>
          </section>
        ) : null}
        {authStatus === "signed-in" && (
          <button
            type="button"
            disabled={authBusy}
            onClick={() => void signOut()}
            className="glass mt-6 inline-flex self-center items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Keluar{accountEmail ? ` (${accountEmail})` : ""}
          </button>
        )}
      </main>
    </div>
  );
}

function PracticeGame({
  quiz,
  from,
  onNewQuestions,
}: {
  quiz: Quiz;
  from?: "player-dashboard";
  onNewQuestions?: () => void;
}) {
  const [timeLimit, setTimeLimit] = useState<number>(120);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | null>>(() =>
    quiz.questions.map(() => null),
  );
  const [resultSaveStatus, setResultSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [resultSaveError, setResultSaveError] = useState("");
  const [saveRetry, setSaveRetry] = useState(0);
  const savedSession = useRef<number | null>(null);
  const resultId = useRef<string | null>(null);
  const now = useNow(100);
  const durationMs = timeLimit * 1000;
  const timeLeft = startedAt === null ? durationMs : remainingMs(startedAt, durationMs, now);
  const currentQuestion = quiz.questions[questionIndex];
  const selectedChoice = answers[questionIndex] ?? null;
  const summary = useMemo(
    () => summarizePractice(quiz.questions, answers),
    [answers, quiz.questions],
  );
  const completedAll = questionIndex >= quiz.questions.length;
  const finished = startedAt !== null && (timeLeft <= 0 || completedAll);
  const timeExpired = timeLeft <= 0 && !completedAll;

  useEffect(() => {
    if (!finished || startedAt === null || savedSession.current === startedAt) return;
    savedSession.current = startedAt;
    resultId.current ??= crypto.randomUUID();
    let active = true;
    setResultSaveStatus("saving");
    setResultSaveError("");
    void recordPlayerSoloResult({
      resultId: resultId.current,
      quizTitle: quiz.title,
      totalQuestions: quiz.questions.length,
      answeredQuestions: summary.answered,
      correctAnswers: summary.correct,
    })
      .then(() => {
        if (active) setResultSaveStatus("saved");
      })
      .catch((cause: unknown) => {
        console.error("Failed to save solo practice statistics.", cause);
        if (active) {
          setResultSaveStatus("failed");
          setResultSaveError(
            cause instanceof Error &&
              /record_player_solo_result|player_solo_results|schema cache/i.test(cause.message)
              ? "Statistik solo belum siap di database. Terapkan migration solo_practice_stats di Supabase."
              : "Hasil latihan gagal disimpan. Periksa koneksi lalu coba lagi.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [
    finished,
    quiz.questions.length,
    quiz.title,
    saveRetry,
    startedAt,
    summary.answered,
    summary.correct,
  ]);

  const chooseAnswer = (choice: number) => {
    if (startedAt === null || selectedChoice !== null || Date.now() >= startedAt + durationMs)
      return;
    setAnswers((current) =>
      current.map((answer, index) => (index === questionIndex ? choice : answer)),
    );
  };

  const advance = () => {
    if (startedAt === null || Date.now() >= startedAt + durationMs) return;
    setQuestionIndex((index) => index + 1);
  };

  const restart = () => {
    setAnswers(quiz.questions.map(() => null));
    setQuestionIndex(0);
    savedSession.current = null;
    resultId.current = null;
    setResultSaveStatus("idle");
    setStartedAt(Date.now());
  };

  const retryResultSave = () => {
    savedSession.current = null;
    setResultSaveStatus("idle");
    setSaveRetry((retry) => retry + 1);
  };

  if (startedAt === null) {
    return (
      <section className="panel anim-pop mx-auto mt-12 w-full max-w-xl rounded-3xl p-6 text-center sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Clock3 className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Mode latihan solo
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {quiz.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Jawab semua {quiz.questions.length} soal sebelum waktu habis. Timer terus berjalan di
          seluruh sesi, bukan diulang per soal.
        </p>
        {quiz.translationStatus && (
          <p className="mt-3 text-xs text-muted-foreground">
            {quiz.translationStatus === "complete"
              ? "Soal sudah diterjemahkan otomatis ke bahasa Indonesia."
              : "Sebagian soal masih dalam bahasa asli karena batas layanan terjemahan gratis."}
          </p>
        )}

        <fieldset className="mt-7">
          <legend className="mb-3 text-sm font-semibold">Pilih batas waktu</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TIME_LIMITS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                aria-pressed={timeLimit === seconds}
                onClick={() => setTimeLimit(seconds)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                  timeLimit === seconds
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-glass-border bg-glass text-muted-foreground hover:text-foreground",
                )}
              >
                {formatTime(seconds)}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          onClick={() => setStartedAt(Date.now())}
          className="press-3d mt-6 w-full rounded-xl bg-primary px-5 py-3 font-display font-bold text-primary-foreground"
        >
          Mulai latihan
        </button>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="panel anim-pop mx-auto mt-8 w-full max-w-xl rounded-3xl p-6 text-center sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          {timeExpired ? <Clock3 className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {timeExpired ? "Waktu habis" : "Semua soal selesai"}
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          {summary.correct} dari {quiz.questions.length} benar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kamu menjawab {summary.answered} soal · Akurasi {summary.accuracy}%
        </p>
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {resultSaveStatus === "saving"
            ? "Menyimpan statistik latihan…"
            : resultSaveStatus === "saved"
              ? "Statistik latihan tersimpan di akunmu."
              : ""}
        </p>
        {resultSaveStatus === "failed" && (
          <div className="mt-3">
            <p role="alert" className="text-xs text-destructive">
              {resultSaveError}
            </p>
            <button
              type="button"
              onClick={retryResultSave}
              className="mt-2 text-sm font-medium text-accent hover:underline"
            >
              Coba simpan lagi
            </button>
          </div>
        )}
        {quiz.questions.some((question) => question.source === "opentdb") && (
          <p className="mt-2 text-xs text-muted-foreground">
            Soal dari Open Trivia Database · CC BY-SA 4.0
          </p>
        )}
        {quiz.translationStatus && (
          <p className="mt-1 text-xs text-muted-foreground">
            {quiz.translationStatus === "complete"
              ? "Terjemahan Indonesia otomatis oleh MyMemory."
              : "Sebagian teks tetap bahasa asli karena batas layanan terjemahan gratis."}
          </p>
        )}
        {timeExpired && (
          <p className="mt-1 text-xs text-muted-foreground">
            {quiz.questions.length - summary.answered} soal belum terjawab.
          </p>
        )}
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={restart}
            className="press-3d inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Coba lagi
          </button>
          <Link
            to={from === "player-dashboard" ? "/player-dashboard" : "/"}
            className="press-3d inline-flex items-center justify-center rounded-xl border border-input bg-glass px-4 py-3 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </div>
        {onNewQuestions && (
          <button
            type="button"
            onClick={onNewQuestions}
            className="mt-4 text-sm font-medium text-accent hover:underline"
          >
            Pilih kategori atau ambil soal baru
          </button>
        )}
      </section>
    );
  }

  if (!currentQuestion) return null;
  const correctIndex = currentQuestion.correctIndex;

  return (
    <section className="mx-auto mt-6 w-full max-w-2xl">
      <div className="panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
        <div>
          <p className="font-display text-sm font-bold">{quiz.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Soal {questionIndex + 1} dari {quiz.questions.length}
          </p>
        </div>
        {quiz.questions.some((question) => question.source === "opentdb") && (
          <p className="mt-2 text-right text-xs text-muted-foreground">
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
        <div className="flex items-center gap-3">
          <span className="numeral text-xs text-muted-foreground">{summary.correct} benar</span>
          <TimerRing startedAt={startedAt} durationMs={durationMs} size={76} />
        </div>
      </div>

      <div className="panel anim-pop mt-4 rounded-3xl p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Latihan
        </p>
        <h1 className="mt-3 font-display text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
          {currentQuestion.text}
        </h1>
        {quiz.translationStatus === "partial" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Sebagian soal atau opsi belum diterjemahkan dan ditampilkan dalam bahasa asli.
          </p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = selectedChoice !== null && index === correctIndex;
            const isWrongChoice = selectedChoice === index && !isCorrect;
            return (
              <button
                key={index}
                type="button"
                disabled={selectedChoice !== null}
                onClick={() => chooseAnswer(index)}
                className={cn(
                  "press-3d flex min-h-16 items-center gap-3 rounded-2xl px-4 py-4 text-left text-white/95 shadow-elevated disabled:cursor-default",
                  selectedChoice === null
                    ? OPTION_BG[index]
                    : isCorrect
                      ? "bg-success"
                      : isWrongChoice
                        ? "bg-destructive"
                        : "bg-muted text-muted-foreground",
                )}
              >
                <span className="numeral flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/25 text-sm">
                  {LETTERS[index]}
                </span>
                <span className="flex-1 font-display text-sm font-semibold sm:text-base">
                  {option}
                </span>
                {isCorrect && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                {isWrongChoice && <XCircle className="h-5 w-5 shrink-0" />}
              </button>
            );
          })}
        </div>
        {selectedChoice !== null && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              className={cn(
                "text-sm font-semibold",
                selectedChoice === correctIndex ? "text-success" : "text-destructive",
              )}
            >
              {selectedChoice === correctIndex
                ? "Benar!"
                : `Belum tepat. Jawaban benar: ${LETTERS[correctIndex]}. ${currentQuestion.options[correctIndex]}`}
            </p>
            <button
              type="button"
              onClick={advance}
              className="press-3d rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {questionIndex === quiz.questions.length - 1 ? "Lihat hasil" : "Soal berikutnya"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
