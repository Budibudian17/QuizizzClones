import { remainingMs, useNow } from "@/game/useRoom";
import { cn } from "@/lib/utils";

/**
 * Holographic circular countdown: the ring shrinks smoothly as time decays
 * and pulses gently once fewer than 5 seconds remain.
 */
export function TimerRing({
  startedAt,
  durationMs,
  size = 168,
}: {
  startedAt: number;
  durationMs: number;
  size?: number;
}) {
  const now = useNow(100);
  const remaining = remainingMs(startedAt, durationMs, now);
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, remaining / durationMs)) : 0;
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining > 0 && remaining <= 5000;

  const r = 44;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={cn("relative", urgent && "anim-pulse-ring")}
      style={{ width: size, height: size, transform: `scale(${0.78 + 0.22 * ratio})` }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-glass-border"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn(
            "transition-[stroke-dashoffset] duration-100 ease-linear",
            urgent ? "stroke-destructive" : "stroke-accent",
          )}
          style={{ filter: "drop-shadow(0 0 6px color-mix(in oklab, currentColor 60%, transparent))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("numeral text-4xl", urgent && "text-destructive")}>
          {seconds}
        </span>
        <span className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          detik
        </span>
      </div>
    </div>
  );
}
