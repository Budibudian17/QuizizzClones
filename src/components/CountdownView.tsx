import { remainingMs, useNow } from "@/game/useRoom";

export function CountdownView({
  startedAt,
  durationMs,
}: {
  startedAt: number;
  durationMs: number;
}) {
  const now = useNow(100);
  const remaining = remainingMs(startedAt, durationMs, now);
  const count = Math.max(1, Math.ceil(remaining / 1000));
  const label = remaining === 0 ? "GO!" : count;

  return (
    <section
      role="status"
      aria-live="assertive"
      className="anim-pop flex w-full flex-col items-center text-center"
    >
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-accent">Bersiap!</p>
      <div
        key={count}
        className="anim-pop numeral mt-3 flex h-40 w-40 items-center justify-center rounded-full border-4 border-accent/50 bg-accent/10 text-7xl text-accent shadow-[0_0_60px_hsl(var(--accent)/.25)] sm:h-52 sm:w-52 sm:text-8xl"
      >
        {label}
      </div>
      <p className="mt-5 font-display text-lg font-bold">Permainan segera dimulai</p>
    </section>
  );
}
