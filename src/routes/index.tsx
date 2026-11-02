import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Gamepad2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  UserRound,
  UserPlus,
} from "lucide-react";

import { AmbientBackground } from "@/components/AmbientBackground";
import { ThemePicker } from "@/components/ThemePicker";
import { createClient, createPlayerClient } from "@/utils/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KampusQuiz — Pilih Peran" },
      {
        name: "description",
        content: "Gabung permainan kuis atau kelola kuis sebagai host di KampusQuiz.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [playerAccountEmail, setPlayerAccountEmail] = useState<string | null>(null);
  const [checkingPlayerAccount, setCheckingPlayerAccount] = useState(true);

  useEffect(() => {
    let active = true;
    const restorePlayerAccount = async () => {
      try {
        const { data, error } = await createPlayerClient().auth.getSession();
        if (error) throw error;
        const user = data.session?.user;
        if (active && user && user.is_anonymous !== true)
          setPlayerAccountEmail(user.email ?? "Akun pemain");
      } catch (cause: unknown) {
        console.error("Failed to check player account on home page.", cause);
      } finally {
        if (active) setCheckingPlayerAccount(false);
      }
    };
    void restorePlayerAccount();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.slice(1));
    const callbackError =
      url.searchParams.get("error_description") ?? hashParams.get("error_description");
    const isAuthCallback =
      url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      hashParams.has("access_token") ||
      hashParams.has("error");

    if (!isAuthCallback) return;

    if (callbackError) {
      setAuthError(`Verifikasi email gagal: ${callbackError}`);
      return;
    }

    let active = true;
    setAuthBusy(true);
    setAuthMessage("Sedang memverifikasi email dan menyiapkan akun host…");

    const completeSignIn = async () => {
      try {
        const { data, error } = await createClient().auth.getUser();
        if (error) throw error;
        if (!active) return;

        if (data.user && data.user.is_anonymous !== true) {
          navigate({ to: "/dashboard" });
        } else {
          setAuthMessage("Belum ada sesi host. Jika baru mengonfirmasi email, silakan masuk.");
        }
      } catch (error) {
        if (!active) return;
        console.error("Email verification callback failed.", error);
        setAuthError(
          error instanceof Error
            ? `Akun belum dapat diverifikasi: ${error.message}`
            : "Akun belum dapat diverifikasi. Coba masuk kembali.",
        );
        setAuthMessage("");
      } finally {
        if (active) setAuthBusy(false);
      }
    };

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [navigate]);

  const openHostDashboard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const supabase = createClient();
      const result =
        authMode === "sign-up"
          ? await supabase.auth.signUp({ email: email.trim(), password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) throw result.error;
      if (authMode === "sign-up" && !result.data.session) {
        setAuthMessage("Cek emailmu untuk mengonfirmasi akun, lalu masuk sebagai host.");
        return;
      }
      navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Host authentication failed.", error);
      setAuthError(error instanceof Error ? error.message : "Gagal masuk. Coba lagi.");
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
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div className="flex items-center gap-3">
          <img src="/img/logo.webp" alt="Quizverse" className="h-auto w-48" />
        </div>

        <h1 className="mt-10 text-center font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Mau bermain atau membuat kuis?
        </h1>
        <p className="mt-3 max-w-lg text-center text-sm leading-relaxed text-muted-foreground">
          Gabung permainan sebagai guest, masuk ke akun pemain, atau kelola kuis sebagai host.
        </p>

        <div className="mt-9 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/join"
            search={{ mode: "guest" }}
            className="lift-3d panel anim-pop flex min-h-56 flex-col items-start rounded-3xl p-6 text-left"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Gamepad2 className="h-6 w-6" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-tight">
              Gabung sebagai guest
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Masukkan Game PIN dari host. Tidak perlu membuat akun pemain.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Saya pemain
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <Link
            to="/player-dashboard"
            className="lift-3d panel anim-pop group flex min-h-56 flex-col items-start rounded-3xl p-6 text-left"
            style={{ animationDelay: "60ms" }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <UserRound className="h-6 w-6" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-tight">
              {playerAccountEmail ? "Masuk ke akun Anda" : "Dashboard pemain"}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {checkingPlayerAccount
                ? "Memeriksa sesi akun…"
                : playerAccountEmail
                  ? `Akun ${playerAccountEmail} tersimpan. Lanjut ke dashboard untuk gabung game dan lihat statistik.`
                  : "Masuk atau daftar akun untuk menggabung game, melihat statistik, dan latihan solo."}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              {playerAccountEmail ? "Buka dashboard akun" : "Masuk / daftar"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <section
            className="lift-3d panel anim-pop flex min-h-56 flex-col items-start rounded-3xl p-6 text-left"
            style={{ animationDelay: "100ms" }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Pencil className="h-5 w-5" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold tracking-tight">Dashboard host</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              Buat atau edit kuis, lalu luncurkan permainan dan bagikan PIN ke pemain.
            </p>
            <form onSubmit={openHostDashboard} className="mt-5 w-full">
              <label
                htmlFor="host-email"
                className="mb-2 block text-xs font-medium text-muted-foreground"
              >
                Email host
              </label>
              <input
                id="host-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setAuthError("");
                  setAuthMessage("");
                }}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-input bg-glass px-3 py-2 text-sm outline-none focus:border-primary/60"
              />
              <label
                htmlFor="host-password"
                className="mb-2 mt-3 block text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <div className="flex gap-2">
                <input
                  id="host-password"
                  type="password"
                  autoComplete={authMode === "sign-up" ? "new-password" : "current-password"}
                  minLength={authMode === "sign-up" ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  className="min-w-0 flex-1 rounded-xl border border-input bg-glass px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
                <button
                  type="submit"
                  disabled={authBusy}
                  className="press-3d inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {authMode === "sign-up" ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  {authBusy ? "Memproses…" : authMode === "sign-up" ? "Daftar" : "Masuk"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((mode) => (mode === "sign-in" ? "sign-up" : "sign-in"));
                  setAuthError("");
                  setAuthMessage("");
                }}
                className="mt-3 text-xs font-medium text-accent hover:underline"
              >
                {authMode === "sign-up"
                  ? "Sudah punya akun? Masuk"
                  : "Belum punya akun host? Daftar"}
              </button>
              {authError && (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {authError}
                </p>
              )}
              {authMessage && (
                <p
                  role="status"
                  className={`mt-2 inline-flex items-center gap-2 text-xs ${authBusy ? "text-primary" : "text-success"}`}
                >
                  {authBusy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  {authMessage}
                </p>
              )}
            </form>
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Pemain bisa bergabung tanpa membuat akun, sistem membuat sesi pemain sementara.
        </p>
      </main>
    </div>
  );
}
