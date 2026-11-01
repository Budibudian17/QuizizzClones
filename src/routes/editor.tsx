import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Plus, Save, Trash2 } from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { getHostUser, getOwnedQuiz, saveOwnedQuiz } from "@/game/supabase-quizzes";
import { makeId, type Quiz, type QuizQuestion } from "@/game/types";

export const Route = createFileRoute("/editor")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { quiz?: string } => {
    const quiz = typeof search["quiz"] === "string" ? search["quiz"] : undefined;
    return quiz ? { quiz } : {};
  },
  head: () => ({
    meta: [
      { title: "Editor Kuis — KampusQuiz" },
      {
        name: "description",
        content: "Buat dan sunting soal kuis: pilihan jawaban, kunci jawaban, dan timer per soal.",
      },
      { property: "og:title", content: "Editor Kuis — KampusQuiz" },
      {
        property: "og:description",
        content: "Buat dan sunting soal kuis dengan timer per pertanyaan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditorPage,
});

function blankQuestion(): QuizQuestion {
  return { id: makeId("q"), text: "", options: ["", "", "", ""], correctIndex: 0, timerSec: 20 };
}

function EditorPage() {
  const navigate = useNavigate();
  const { quiz: quizId } = Route.useSearch();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getHostUser()
      .then(async (user) => {
        if (!user) {
          navigate({ to: "/", replace: true });
          return;
        }
        const existing = quizId ? await getOwnedQuiz(user.id, quizId) : null;
        if (quizId && !existing) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        if (!active) return;
        setOwnerId(user.id);
        setQuiz(
          existing ??
            ({
              id: makeId("quiz"),
              title: "",
              description: "",
              questions: [blankQuestion()],
              updatedAt: Date.now(),
            } satisfies Quiz),
        );
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        console.error("Failed to load quiz editor.", cause);
        if (active) {
          setError("Gagal memuat editor. Periksa koneksi Supabase lalu coba lagi.");
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [quizId, navigate]);

  const problems = useMemo(() => {
    if (!quiz) return [] as string[];
    const issues: string[] = [];
    if (!quiz.title.trim()) issues.push("Judul kuis masih kosong.");
    if (quiz.questions.length === 0) issues.push("Tambahkan minimal satu soal.");
    quiz.questions.forEach((q, i) => {
      if (!q.text.trim()) issues.push(`Soal ${i + 1}: pertanyaan masih kosong.`);
      if (q.options.some((o) => !o.trim())) issues.push(`Soal ${i + 1}: ada opsi jawaban kosong.`);
    });
    return issues;
  }, [quiz]);

  if (!loaded || (!quiz && !error)) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const patchQuestion = (index: number, patch: Partial<QuizQuestion>) => {
    setQuiz((q) =>
      q
        ? {
            ...q,
            questions: q.questions.map((item, i) => (i === index ? { ...item, ...patch } : item)),
          }
        : q,
    );
  };

  const save = async () => {
    const clean: Quiz = {
      ...quiz,
      title: quiz.title.trim() || "Kuis tanpa judul",
      description: quiz.description.trim(),
      questions: quiz.questions.filter((q) => q.text.trim() && q.options.every((o) => o.trim())),
      updatedAt: Date.now(),
    };
    if (clean.questions.length === 0 || !ownerId) return;
    setSaving(true);
    setError("");
    try {
      await saveOwnedQuiz(ownerId, clean);
      navigate({ to: "/dashboard" });
    } catch (cause) {
      console.error("Failed to save quiz.", cause);
      setError("Kuis gagal disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Dasbor
          </Link>
          <button
            onClick={() => void save()}
            disabled={problems.length > 0 || saving}
            className="press-3d inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan…" : "Simpan kuis"}
          </button>
        </header>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="panel anim-pop mt-6 rounded-3xl p-6">
          <label className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Judul kuis
          </label>
          <input
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            placeholder="mis. Kuis Pengetahuan Umum"
            className="mt-2 w-full rounded-xl border border-input bg-glass px-4 py-3 font-display text-lg font-bold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
          />
          <label className="mt-4 block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Deskripsi
          </label>
          <textarea
            value={quiz.description}
            onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
            placeholder="Ceritakan singkat tentang kuis ini…"
            rows={2}
            className="mt-2 w-full resize-none rounded-xl border border-input bg-glass px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
          />
        </div>

        {problems.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3 text-xs text-warning">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 space-y-4">
          {quiz.questions.map((question, qi) => (
            <section
              key={question.id}
              className="panel anim-pop rounded-3xl p-6"
              style={{ animationDelay: `${qi * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="numeral rounded-full border border-glass-border bg-glass px-3 py-1 text-sm text-muted-foreground">
                  {qi + 1}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-full border border-glass-border bg-glass p-1">
                    <Clock3 className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    {([10, 20, 30] as const).map((sec) => (
                      <button
                        key={sec}
                        onClick={() => patchQuestion(qi, { timerSec: sec })}
                        className={`numeral rounded-full px-2.5 py-1 text-xs transition-colors ${
                          question.timerSec === sec
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                  <button
                    aria-label={`Hapus soal ${qi + 1}`}
                    onClick={() =>
                      setQuiz((q) =>
                        q ? { ...q, questions: q.questions.filter((_, i) => i !== qi) } : q,
                      )
                    }
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <input
                value={question.text}
                onChange={(e) => patchQuestion(qi, { text: e.target.value })}
                placeholder="Tulis pertanyaannya di sini…"
                className="mt-4 w-full rounded-xl border border-input bg-glass px-4 py-3 font-display text-base font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
              />

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, oi) => {
                  const correct = question.correctIndex === oi;
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors ${
                        correct ? "border-success/60 bg-success/10" : "border-input bg-glass"
                      }`}
                    >
                      <button
                        aria-label={`Tandai opsi ${oi + 1} sebagai jawaban benar`}
                        onClick={() => patchQuestion(qi, { correctIndex: oi })}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
                          correct
                            ? "border-success bg-success/20 text-success"
                            : "border-input text-muted-foreground hover:border-foreground/30"
                        }`}
                      >
                        {correct ? <Check className="h-3.5 w-3.5" /> : String.fromCharCode(65 + oi)}
                      </button>
                      <input
                        value={option}
                        onChange={(e) =>
                          patchQuestion(qi, {
                            options: question.options.map((o, i) =>
                              i === oi ? e.target.value : o,
                            ),
                          })
                        }
                        placeholder={`Opsi ${String.fromCharCode(65 + oi)}`}
                        className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <button
          onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}
          className="press-3d mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-input bg-glass py-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Tambah soal
        </button>

        <div className="h-8" />
      </div>
    </div>
  );
}
