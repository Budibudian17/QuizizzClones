import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, MonitorPlay, Pencil, Play, Plus, Trash2, Trophy, Users } from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import { deleteOwnedQuiz, getHostUser, loadOwnedQuizzes } from "@/game/supabase-quizzes";
import type { Quiz } from "@/game/types";
import { createClient } from "@/utils/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KampusQuiz — Dasbor Kuis" },
      {
        name: "description",
        content:
          "Dasbor host KampusQuiz: kelola kuis, buat soal, dan luncurkan sesi kuis multiplayer real-time.",
      },
      { property: "og:title", content: "KampusQuiz — Dasbor Kuis" },
      {
        property: "og:description",
        content: "Kelola kuis dan luncurkan sesi kuis multiplayer real-time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getHostUser()
      .then(async (user) => {
        if (!active) return;
        if (!user) {
          navigate({ to: "/", replace: true });
          return;
        }
        setOwnerId(user.id);
        const ownedQuizzes = await loadOwnedQuizzes(user.id);
        if (!active) return;
        setQuizzes(ownedQuizzes);
        setAuthorized(true);
      })
      .catch((cause: unknown) => {
        console.error("Failed to load host dashboard.", cause);
        if (active) setError("Gagal memuat kuis. Periksa koneksi Supabase lalu coba lagi.");
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const signOut = async () => {
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      console.error("Host sign-out failed.", signOutError);
      setError("Gagal keluar. Silakan coba lagi.");
      return;
    }
    navigate({ to: "/", replace: true });
  };

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-sm text-muted-foreground">
        {error || "Memuat dashboard…"}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/img/logo.webp" alt="Quizverse" className="h-auto w-36" />
          </div>
          <div className="flex items-center gap-2">
            <ThemePicker />
            <button
              onClick={() => void signOut()}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col pt-12">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Dasbor Kuis
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Kelola kuis, atur soal, dan luncurkan sesi multiplayer, pemain bergabung lewat 6-digit
            Game PIN dari tab atau perangkat lain.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Kuis tersimpan
            </h2>
            <Link
              to="/editor"
              search={{}}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground press-3d"
            >
              <Plus className="h-4 w-4" />
              Kuis baru
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(quizzes ?? []).map((quiz, i) => (
              <article
                key={quiz.id}
                className="lift-3d panel anim-pop relative flex flex-col rounded-3xl p-6"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="rounded-full border border-glass-border bg-glass px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {quiz.questions.length} soal
                    </span>
                    <h3 className="mt-3 font-display text-xl font-bold tracking-tight">
                      {quiz.title}
                    </h3>
                  </div>
                  <button
                    aria-label={`Hapus kuis ${quiz.title}`}
                    onClick={() => {
                      if (!ownerId) return;
                      void deleteOwnedQuiz(ownerId, quiz.id)
                        .then(() =>
                          setQuizzes((current) =>
                            current ? current.filter((item) => item.id !== quiz.id) : current,
                          ),
                        )
                        .catch((cause: unknown) => {
                          console.error("Failed to delete quiz.", cause);
                          setError("Kuis gagal dihapus. Coba lagi.");
                        });
                    }}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {quiz.description}
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <Link
                    to="/host"
                    search={{ quiz: quiz.id }}
                    className="press-3d inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Play className="h-4 w-4" fill="currentColor" />
                    Luncurkan
                  </Link>
                  <Link
                    to="/editor"
                    search={{ quiz: quiz.id }}
                    className="press-3d inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-glass px-4 py-2.5 text-sm font-medium text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </article>
            ))}
          </div>
          {quizzes?.length === 0 && (
            <section className="panel mt-4 rounded-3xl px-6 py-10 text-center">
              <h3 className="font-display text-lg font-bold">Belum ada kuis tersimpan</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Buat kuis baru untuk mulai menyimpan soal ke akun host ini.
              </p>
              <Link
                to="/editor"
                search={{}}
                className="press-3d mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Buat kuis pertama
              </Link>
            </section>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}

          <section className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: MonitorPlay,
                title: "1 · Luncurkan",
                body: "Buka kuis dari dasbor — Game PIN 6 digit langsung tersedia di lobby host.",
              },
              {
                icon: Users,
                title: "2 · Pemain bergabung",
                body: "Buka halaman Join di tab atau perangkat lain, masukkan PIN dan nickname.",
              },
              {
                icon: Trophy,
                title: "3 · Bermain & menang",
                body: "Jawab cepat untuk bonus skor, podium juara menutup permainan.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="glass rounded-2xl p-5">
                <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
                <h3 className="mt-3 font-display text-sm font-bold tracking-tight">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="pt-10 text-center text-xs text-muted-foreground">
          KampusQuiz · kuis dan permainan tersimpan di Supabase
        </footer>
      </div>
    </div>
  );
}
