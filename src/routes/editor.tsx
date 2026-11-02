import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Clock3,
  ClipboardPaste,
  FileUp,
  Globe2,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseQuizText } from "@/game/quiz-import";
import { generateQuizFromMaterial, type GeneratedMaterialQuestion } from "@/game/ai-quiz";
import { extractQuizMaterialText } from "@/game/quiz-material";
import {
  fetchTriviaQuiz,
  loadTriviaCategories,
  type TriviaCategory,
  type TriviaDifficulty,
} from "@/game/open-trivia";
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
  const [showImport, setShowImport] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [showApiImport, setShowApiImport] = useState(false);
  const [showMaterialImport, setShowMaterialImport] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialInstructions, setMaterialInstructions] = useState("");
  const [materialQuestionCount, setMaterialQuestionCount] = useState("10");
  const [materialBusy, setMaterialBusy] = useState(false);
  const [materialError, setMaterialError] = useState("");
  const [generatedMaterialQuestions, setGeneratedMaterialQuestions] = useState<
    GeneratedMaterialQuestion[]
  >([]);
  const [apiCategories, setApiCategories] = useState<TriviaCategory[]>([]);
  const [apiCategory, setApiCategory] = useState("");
  const [apiDifficulty, setApiDifficulty] = useState("");
  const [apiAmount, setApiAmount] = useState("10");
  const [apiBusy, setApiBusy] = useState(false);
  const [apiLoadingCategories, setApiLoadingCategories] = useState(false);
  const [apiError, setApiError] = useState("");
  const [importText, setImportText] = useState("");
  const parsedImport = useMemo(() => parseQuizText(importText), [importText]);
  const generateMaterialQuestions = useServerFn(generateQuizFromMaterial);

  const generateQuestionsFromFile = async () => {
    if (!materialFile) return;
    setMaterialBusy(true);
    setMaterialError("");
    setGeneratedMaterialQuestions([]);
    try {
      const material = await extractQuizMaterialText(materialFile);
      const questions = await generateMaterialQuestions({
        data: {
          material,
          questionCount: Number(materialQuestionCount),
          instructions: materialInstructions,
        },
      });
      setGeneratedMaterialQuestions(questions);
    } catch (cause: unknown) {
      console.error("Failed to generate quiz questions from uploaded material.", cause);
      setMaterialError(
        cause instanceof Error ? cause.message : "Gagal membuat soal dari file materi.",
      );
    } finally {
      setMaterialBusy(false);
    }
  };

  const updateGeneratedQuestion = (
    questionIndex: number,
    patch: Partial<GeneratedMaterialQuestion>,
  ) => {
    setGeneratedMaterialQuestions((current) =>
      current.map((question, index) =>
        index === questionIndex ? { ...question, ...patch } : question,
      ),
    );
  };

  const addGeneratedQuestions = () => {
    if (!quiz || !materialFile || generatedMaterialQuestions.length === 0) return;
    if (
      generatedMaterialQuestions.some(
        (question) => !question.text.trim() || question.options.some((option) => !option.trim()),
      )
    ) {
      setMaterialError("Lengkapi teks pertanyaan dan semua pilihan sebelum menambahkan.");
      return;
    }

    const isEmptyStarter =
      quiz.questions.length === 1 &&
      !quiz.questions[0]!.text.trim() &&
      quiz.questions[0]!.options.every((option) => !option.trim());
    const imported = generatedMaterialQuestions.map((question) => ({
      ...question,
      id: makeId("q"),
      timerSec: 20 as const,
    }));
    const fileTitle = materialFile.name.replace(/\.(pptx|pdf)$/i, "").trim();

    setQuiz({
      ...quiz,
      title: quiz.title.trim() || fileTitle || "Kuis dari materi",
      description:
        quiz.description.trim() ||
        `Soal dibuat dengan Gemini dari materi: ${materialFile.name}. Periksa kembali sebelum bermain.`,
      questions: isEmptyStarter ? imported : [...quiz.questions, ...imported],
    });
    setGeneratedMaterialQuestions([]);
    setMaterialFile(null);
    setMaterialInstructions("");
    setMaterialError("");
    setShowMaterialImport(false);
  };

  useEffect(() => {
    if (!showApiImport || apiCategories.length > 0) return;
    let active = true;
    setApiLoadingCategories(true);
    void loadTriviaCategories()
      .then((categories) => {
        if (active) setApiCategories(categories);
      })
      .catch((cause: unknown) => {
        console.error("Failed to load Open Trivia DB categories for quiz editor.", cause);
        if (active) setApiError("Gagal memuat kategori API. Periksa koneksi lalu coba lagi.");
      })
      .finally(() => {
        if (active) setApiLoadingCategories(false);
      });
    return () => {
      active = false;
    };
  }, [showApiImport, apiCategories.length]);

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

  const importQuestions = () => {
    if (parsedImport.questions.length === 0 || parsedImport.errors.length > 0) return;
    const isEmptyStarter =
      quiz.questions.length === 1 &&
      !quiz.questions[0]!.text.trim() &&
      quiz.questions[0]!.options.every((option) => !option.trim());
    const imported = parsedImport.questions.map((question) => ({
      ...question,
      id: makeId("q"),
    }));

    setQuiz({
      ...quiz,
      questions: isEmptyStarter ? imported : [...quiz.questions, ...imported],
    });
    setImportText("");
    setShowImport(false);
  };

  const importApiQuestions = async () => {
    setApiBusy(true);
    setApiError("");
    try {
      const generatedQuiz = await fetchTriviaQuiz({
        amount: Number(apiAmount),
        ...(apiCategory && { categoryId: Number(apiCategory) }),
        ...(apiDifficulty && { difficulty: apiDifficulty as TriviaDifficulty }),
      });
      const descriptionWithoutOldAttribution = quiz.description
        .trim()
        .replace(/\n*\s*Soal dari Open Trivia Database \(CC BY-SA 4\.0\).*$/s, "")
        .trim();
      setQuiz({
        ...quiz,
        title: quiz.title.trim() || generatedQuiz.title,
        description: [
          descriptionWithoutOldAttribution,
          "Soal dari Open Trivia Database (CC BY-SA 4.0): https://opentdb.com/",
          "Terjemahan otomatis oleh MyMemory: https://mymemory.translated.net/",
        ]
          .filter(Boolean)
          .join("\n\n"),
        questions: generatedQuiz.questions,
      });
      setShowApiImport(false);
    } catch (cause: unknown) {
      console.error("Failed to import Open Trivia DB questions into quiz.", cause);
      setApiError(cause instanceof Error ? cause.message : "Gagal mengambil soal dari API.");
    } finally {
      setApiBusy(false);
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
          <div className="flex items-center gap-2">
            <ThemePicker />
            <button
              onClick={() => void save()}
              disabled={problems.length > 0 || saving}
              className="press-3d inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:px-5"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">{saving ? "Menyimpan…" : "Simpan kuis"}</span>
            </button>
          </div>
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Soal ({quiz.questions.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setApiError("");
                setShowApiImport(true);
              }}
              className="press-3d inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              <Globe2 className="h-4 w-4" />
              Ambil dari API
            </button>
            <button
              type="button"
              onClick={() => {
                setMaterialError("");
                setShowMaterialImport(true);
              }}
              className="press-3d inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
            >
              <Sparkles className="h-4 w-4" />
              Buat soal dari file
            </button>
            <button
              type="button"
              onClick={() => setShowImportGuide((open) => !open)}
              aria-expanded={showImportGuide}
              className="press-3d inline-flex items-center gap-2 rounded-xl border border-input bg-glass px-3 py-2 text-sm font-semibold text-foreground"
            >
              <CircleHelp className="h-4 w-4" />
              Guide
            </button>
            <button
              type="button"
              onClick={() => setShowImport((open) => !open)}
              aria-expanded={showImport}
              className="press-3d inline-flex items-center gap-2 rounded-xl border border-input bg-glass px-4 py-2 text-sm font-semibold text-foreground"
            >
              <ClipboardPaste className="h-4 w-4" />
              {showImport ? "Tutup tempel soal" : "Tempel soal dari AI"}
            </button>
          </div>
          {quiz.translationStatus && (
            <p className="mt-2 text-xs text-muted-foreground">
              {quiz.translationStatus === "complete"
                ? "Soal API diterjemahkan otomatis oleh MyMemory."
                : "Sebagian soal API tidak diterjemahkan karena batas layanan gratis."}
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Buat soal sendiri lewat kolom di bawah, atau ambil soal dari API. Soal API akan
            mengganti daftar soal yang ada dan tetap bisa diedit sebelum multiplayer dimulai.
          </p>
        </div>

        <Dialog
          open={showApiImport}
          onOpenChange={(open) => {
            setShowApiImport(open);
            if (!open) setApiError("");
          }}
        >
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-glass-border bg-card p-5 sm:p-6">
            <DialogHeader className="pr-7">
              <DialogTitle className="font-display">Pilih soal dari Open Trivia DB</DialogTitle>
              <DialogDescription>
                Soal API akan mengganti daftar soal di editor. Setelah diambil, host tetap bisa
                mengedit pertanyaan dan kunci jawaban.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Kategori
                <select
                  value={apiCategory}
                  onChange={(event) => setApiCategory(event.target.value)}
                  disabled={apiLoadingCategories}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                >
                  <option value="">Semua kategori</option>
                  {apiCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Kesulitan
                <select
                  value={apiDifficulty}
                  onChange={(event) => setApiDifficulty(event.target.value)}
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
                  value={apiAmount}
                  onChange={(event) => setApiAmount(event.target.value)}
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              Open Trivia DB umumnya menyediakan soal berbahasa Inggris. Soal dan adaptasinya
              dilisensikan CC BY-SA 4.0; atribusi akan dicantumkan di deskripsi kuis.
            </p>
            {apiError && (
              <p role="alert" className="text-sm text-destructive">
                {apiError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowApiImport(false)}
                className="rounded-xl border border-input bg-glass px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void importApiQuestions()}
                disabled={apiBusy || apiLoadingCategories || apiCategories.length === 0}
                className="press-3d inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                <Globe2 className="h-4 w-4" />
                {apiLoadingCategories
                  ? "Memuat kategori…"
                  : apiBusy
                    ? "Mengambil soal…"
                    : "Ganti dengan soal API"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={showMaterialImport}
          onOpenChange={(open) => {
            setShowMaterialImport(open);
            if (!open && !materialBusy) setMaterialError("");
          }}
        >
          <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-glass-border bg-card p-5 sm:p-6">
            <DialogHeader className="pr-7">
              <DialogTitle className="font-display">Buat soal dari materi</DialogTitle>
              <DialogDescription>
                Unggah PPTX atau PDF. Teks materi akan diproses dengan Gemini untuk membuat pilihan
                ganda; soal dan kunci jawabannya bisa kamu periksa sebelum ditambahkan.
              </DialogDescription>
            </DialogHeader>

            <label className="block text-sm font-semibold">
              File materi
              <input
                type="file"
                accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(event) => {
                  setMaterialFile(event.target.files?.[0] ?? null);
                  setGeneratedMaterialQuestions([]);
                  setMaterialError("");
                }}
                disabled={materialBusy}
                className="mt-2 block w-full cursor-pointer rounded-xl border border-input bg-background/60 px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/15 file:px-3 file:py-2 file:font-semibold file:text-primary"
              />
            </label>
            {materialFile && (
              <p className="text-xs text-muted-foreground">
                {materialFile.name} · {(materialFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Jumlah soal
                <select
                  value={materialQuestionCount}
                  onChange={(event) => setMaterialQuestionCount(event.target.value)}
                  disabled={materialBusy}
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                >
                  {[5, 10, 15, 20].map((amount) => (
                    <option key={amount} value={amount}>
                      {amount} soal
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Fokus tambahan <span className="font-normal text-muted-foreground">(opsional)</span>
                <input
                  value={materialInstructions}
                  onChange={(event) => setMaterialInstructions(event.target.value)}
                  maxLength={500}
                  disabled={materialBusy}
                  placeholder="mis. fokus pada bab 2"
                  className="mt-2 w-full rounded-xl border border-input bg-background/60 px-3 py-3 text-sm font-normal"
                />
              </label>
            </div>

            <p className="rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              File dibaca di browser; hanya teks hasil ekstraksi yang dikirim ke Gemini. Maksimal 15
              MB, 100 halaman/slide, dan 50.000 karakter. Teks di dalam gambar atau PDF hasil scan
              tidak terbaca. Jangan unggah materi rahasia atau data pribadi.
            </p>

            {materialError && (
              <p role="alert" className="text-sm text-destructive">
                {materialError}
              </p>
            )}

            {generatedMaterialQuestions.length > 0 && (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">
                    Periksa hasil ({generatedMaterialQuestions.length})
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pilih radio pada jawaban yang benar. Semua soal masih bisa diedit.
                  </p>
                </div>
                <div className="max-h-[38dvh] space-y-3 overflow-y-auto pr-1">
                  {generatedMaterialQuestions.map((question, questionIndex) => (
                    <article
                      key={questionIndex}
                      className="rounded-xl border border-glass-border bg-glass p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Soal {questionIndex + 1}
                        </span>
                        <button
                          type="button"
                          aria-label={`Hapus soal ${questionIndex + 1}`}
                          onClick={() =>
                            setGeneratedMaterialQuestions((current) =>
                              current.filter((_, index) => index !== questionIndex),
                            )
                          }
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        aria-label={`Pertanyaan ${questionIndex + 1}`}
                        value={question.text}
                        onChange={(event) =>
                          updateGeneratedQuestion(questionIndex, { text: event.target.value })
                        }
                        rows={2}
                        className="w-full resize-y rounded-lg border border-input bg-background/60 px-3 py-2 text-sm"
                      />
                      <div className="mt-2 space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={optionIndex}
                            className="flex items-start gap-2 rounded-lg border border-input bg-background/40 p-2"
                          >
                            <input
                              type="radio"
                              name={`generated-correct-${questionIndex}`}
                              checked={question.correctIndex === optionIndex}
                              onChange={() =>
                                updateGeneratedQuestion(questionIndex, {
                                  correctIndex: optionIndex,
                                })
                              }
                              aria-label={`Tandai pilihan ${String.fromCharCode(65 + optionIndex)} sebagai jawaban benar`}
                              className="mt-2 accent-primary"
                            />
                            <span className="pt-1 text-xs font-semibold text-muted-foreground">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <input
                              aria-label={`Pilihan ${String.fromCharCode(65 + optionIndex)} soal ${questionIndex + 1}`}
                              value={option}
                              onChange={(event) =>
                                updateGeneratedQuestion(questionIndex, {
                                  options: question.options.map((currentOption, index) =>
                                    index === optionIndex ? event.target.value : currentOption,
                                  ),
                                })
                              }
                              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowMaterialImport(false)}
                disabled={materialBusy}
                className="rounded-xl border border-input bg-glass px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Batal
              </button>
              {generatedMaterialQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={addGeneratedQuestions}
                  className="press-3d inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                  Tambahkan ke editor
                </button>
              )}
              <button
                type="button"
                onClick={() => void generateQuestionsFromFile()}
                disabled={!materialFile || materialBusy}
                className="press-3d inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
              >
                {materialBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {materialBusy ? "Membaca materi dan membuat soal…" : "Buat soal dengan Gemini"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showImportGuide} onOpenChange={setShowImportGuide}>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-glass-border bg-card p-5 sm:p-6">
            <DialogHeader className="pr-7">
              <DialogTitle className="font-display">Guide format soal</DialogTitle>
              <DialogDescription>
                Minta AI membuat soal bernomor, empat pilihan A–D, dan kunci jawaban untuk setiap
                soal.
              </DialogDescription>
            </DialogHeader>
            <pre className="overflow-x-auto rounded-xl border border-glass-border bg-black/15 p-3 text-xs leading-relaxed text-muted-foreground">
              {`1. Contoh pertanyaan?
A. Pilihan pertama
B. Pilihan kedua
C. Pilihan ketiga
D. Pilihan keempat
Jawaban: B

2. Pertanyaan berikutnya?
A. Pilihan pertama
B. Pilihan kedua
C. Pilihan ketiga
D. Pilihan keempat
Kunci jawaban: D`}
            </pre>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                Awali setiap soal dengan nomor; setiap soal wajib punya pilihan A, B, C, dan D.
              </li>
              <li>Tulis kunci dengan format “Jawaban: B” atau “Kunci jawaban: B”.</li>
              <li>Timer awal otomatis 20 detik dan bisa diubah setelah soal masuk.</li>
            </ul>
          </DialogContent>
        </Dialog>

        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-glass-border bg-card p-5 sm:p-6">
            <DialogHeader className="pr-7">
              <DialogTitle className="font-display">Tempel soal dari AI</DialogTitle>
              <DialogDescription>
                Tempel teks soal bernomor di bawah ini. Pastikan semua soal punya pilihan A–D dan
                kunci jawaban.
              </DialogDescription>
            </DialogHeader>
            <textarea
              aria-label="Tempel teks soal"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Tempel semua soal di sini…"
              rows={8}
              className="min-h-36 w-full resize-y rounded-xl border border-input bg-glass px-4 py-3 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/60 sm:min-h-48"
            />
            {importText.trim() && (
              <div aria-live="polite" className="mt-3 space-y-2">
                {parsedImport.errors.length > 0 ? (
                  <ul role="alert" className="space-y-1 text-sm text-destructive">
                    {parsedImport.errors.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p className="text-sm font-medium text-success">
                      {parsedImport.questions.length} soal siap ditambahkan.
                    </p>
                    <ol className="max-h-36 list-inside list-decimal space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {parsedImport.questions.map((question) => (
                        <li key={`${question.text}-${question.correctIndex}`}>
                          {question.text} — kunci {String.fromCharCode(65 + question.correctIndex)}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowImport(false);
                  setImportText("");
                }}
                className="rounded-xl border border-input bg-glass px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={importQuestions}
                disabled={parsedImport.questions.length === 0 || parsedImport.errors.length > 0}
                className="press-3d inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                <ClipboardPaste className="h-4 w-4" />
                Tambahkan soal
              </button>
            </div>
          </DialogContent>
        </Dialog>

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
