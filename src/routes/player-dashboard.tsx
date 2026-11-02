import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, Clock3, Gamepad2, LogOut, UserRound } from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import { createPlayerClient } from "@/utils/supabase/client";

export const Route = createFileRoute("/player-dashboard")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { reason?: "idle-timeout" } => ({
    ...(search["reason"] === "idle-timeout" && { reason: "idle-timeout" }),
  }),
  head: () => ({
    meta: [
      { title: "Dashboard Pemain — KampusQuiz" },
      {
        name: "description",
        content: "Dashboard pemain untuk bergabung ke game, melihat statistik, dan latihan solo.",
      },
    ],
  }),
  component: PlayerDashboardPage,
});

function PlayerDashboardPage() {
  const { reason } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const restorePlayer = async () => {
      try {
        const { data, error: sessionError } = await createPlayerClient().auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;
        const user = data.session?.user;
        if (user && user.is_anonymous !== true) setEmail(user.email ?? "Akun pemain");
      } catch (cause: unknown) {
        console.error("Failed to restore player dashboard session.", cause);
        if (active) setError("Sesi akun tidak dapat dipulihkan. Silakan masuk kembali.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void restorePlayer();
    return () => {
      active = false;
    };
  }, []);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
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
              email: formEmail.trim(),
              password,
              options: { emailRedirectTo: `${window.location.origin}/player-dashboard` },
            })
          : await client.auth.signInWithPassword({ email: formEmail.trim(), password });
      if (result.error) throw result.error;
      if (authMode === "sign-up" && !result.data.session) {
        setMessage("Cek email untuk konfirmasi akun, lalu buka kembali halaman dashboard pemain.");
        return;
      }
      if (result.data.user.is_anonymous === true)
        throw new Error("Dashboard pemain memerlukan akun permanen dengan email.");
      setEmail(result.data.user.email ?? formEmail.trim());
    } catch (cause: unknown) {
      console.error("Player dashboard authentication failed.", cause);
      setError(cause instanceof Error ? cause.message : "Gagal masuk atau mendaftar. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      const { error: signOutError } = await createPlayerClient().auth.signOut();
      if (signOutError) throw signOutError;
      setEmail("");
      setPassword("");
    } catch (cause: unknown) {
      console.error("Player dashboard sign-out failed.", cause);
      setError("Gagal keluar dari akun. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
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
            to="/"
            className="glass rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Beranda
          </Link>
          {email && (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          )}
        </header>

        {loading ? (
          <p role="status" className="mt-12 text-center text-sm text-muted-foreground">
            Memeriksa akun…
          </p>
        ) : email ? (
          <>
            <section className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Dashboard pemain
              </p>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Siap bermain?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Masuk sebagai <span className="font-medium text-foreground">{email}</span>
              </p>
            </section>

            <section className="mt-7 grid gap-4 sm:grid-cols-2">
              <Link
                to="/join"
                search={{ from: "player-dashboard" }}
                className="lift-3d panel anim-pop group flex min-h-48 flex-col rounded-3xl p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Gamepad2 className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold">Gabung game</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  Masukkan PIN dari host dan pilih nickname untuk masuk ke permainan.
                </p>
                <span className="mt-4 text-sm font-semibold text-primary">Masukkan Game PIN →</span>
              </Link>

              <Link
                to="/practice"
                search={{ from: "player-dashboard" }}
                className="lift-3d panel anim-pop group flex min-h-48 flex-col rounded-3xl p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <Clock3 className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-xl font-bold">Latihan solo</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  Pilih kuis dari katalog dan latihan dengan timer tanpa PIN.
                </p>
                <span className="mt-4 text-sm font-semibold text-accent">Pilih kuis →</span>
              </Link>

              <Link
                to="/stats"
                className="lift-3d panel anim-pop flex items-center gap-4 rounded-3xl p-6 sm:col-span-2"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-display text-lg font-bold">Statistik permainan</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Lihat winrate, podium, akurasi, dan riwayat game.
                  </span>
                </span>
              </Link>
            </section>
          </>
        ) : (
          <section className="panel anim-pop mx-auto mt-12 w-full max-w-sm rounded-3xl p-6 sm:p-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <UserRound className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-center font-display text-2xl font-extrabold tracking-tight">
              Akun pemain
            </h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              Masuk atau daftar dulu untuk membuka dashboard pemain, statistik, dan latihan solo.
            </p>
            {reason === "idle-timeout" && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm text-warning"
              >
                Kamu otomatis keluar karena akun tidak aktif selama 2 jam. Silakan masuk lagi untuk
                melanjutkan.
              </p>
            )}
            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {authMode === "sign-up" ? "Daftar akun" : "Masuk"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
                  setError("");
                  setMessage("");
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
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
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
                disabled={busy}
                className="press-3d w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Memproses…" : authMode === "sign-up" ? "Daftar akun" : "Masuk"}
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="mt-3 text-sm text-success">
                {message}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
