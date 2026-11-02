import { useEffect, useState } from "react";
import { Crown, Medal, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { getPlayersBelowPodium } from "@/game/results";
import { formatPoints } from "@/game/scoring";
import type { Player } from "@/game/types";

/** Top-5 ranking shown between questions. */
export function Leaderboard({
  players,
  meId,
  compact = false,
  hideOtherScores = false,
}: {
  players: Player[];
  meId?: string;
  compact?: boolean;
  hideOtherScores?: boolean;
}) {
  const top = players.slice(0, 5);
  return (
    <div className={cn("flex w-full flex-col gap-2", compact ? "max-w-sm" : "max-w-md")}>
      {top.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada pemain</p>
      )}
      {top.map((p, i) => (
        <div
          key={p.id}
          className={cn(
            "anim-pop flex items-center gap-4 rounded-2xl border px-4 py-3",
            p.id === meId ? "border-primary/50 bg-primary/10" : "border-glass-border bg-glass",
          )}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <span className="numeral w-7 text-center text-lg text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold tracking-tight">
              {p.nickname}
            </p>
            {(!hideOtherScores || p.id === meId) && p.lastGain > 0 && (
              <p className="text-xs font-medium text-success">+{formatPoints(p.lastGain)}</p>
            )}
          </div>
          {(!hideOtherScores || p.id === meId) && (
            <span className="numeral text-lg">{formatPoints(p.score)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Final rankings below the animated top-three podium. */
export function FinalStandings({
  players,
  meId,
  className,
  hideOtherScores = false,
}: {
  players: Player[];
  meId?: string;
  className?: string;
  hideOtherScores?: boolean;
}) {
  const remaining = getPlayersBelowPodium(players);
  if (remaining.length === 0) return null;

  return (
    <section className={cn("w-full max-w-md text-left", className)}>
      <h2 className="mb-3 text-center font-display text-lg font-bold tracking-tight">
        Peringkat lainnya
      </h2>
      <div className="flex flex-col gap-2">
        {remaining.map((player, index) => (
          <div
            key={player.id}
            className={cn(
              "anim-pop flex items-center gap-4 rounded-2xl border px-4 py-3",
              player.id === meId
                ? "border-primary/50 bg-primary/10"
                : "border-glass-border bg-glass",
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span className="numeral w-7 text-center text-lg text-muted-foreground">
              {index + 4}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold tracking-tight">
              {player.nickname}
            </span>
            {(!hideOtherScores || player.id === meId) && (
              <span className="numeral text-lg">{formatPoints(player.score)}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalLeaderboard({
  players,
  meId,
  hideOtherScores = false,
}: {
  players: Player[];
  meId?: string;
  hideOtherScores?: boolean;
}) {
  const [showRanks, setShowRanks] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowRanks(true), 2600);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!showRanks) {
    return (
      <section
        role="status"
        className="anim-pop flex w-full max-w-md flex-col items-center text-center"
      >
        <Sparkles className="h-10 w-10 animate-pulse text-accent" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Ronde terakhir selesai
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Siap melihat peringkat akhir?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Semua jawaban sudah dihitung. Hasilnya segera ditampilkan…
        </p>
        <div className="mt-6 flex items-end gap-2" aria-hidden="true">
          <span className="h-8 w-8 animate-pulse rounded-t-lg bg-accent/30" />
          <span className="h-12 w-8 animate-pulse rounded-t-lg bg-accent/60 [animation-delay:150ms]" />
          <span className="h-6 w-8 animate-pulse rounded-t-lg bg-accent/30 [animation-delay:300ms]" />
        </div>
      </section>
    );
  }

  return (
    <section className="anim-pop flex w-full flex-col items-center text-center">
      <Crown className="h-7 w-7 text-accent" />
      <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight">Peringkat akhir</h1>
      <div className="mt-5 w-full max-w-sm">
        <Leaderboard
          players={players}
          {...(meId !== undefined && { meId })}
          compact
          hideOtherScores={hideOtherScores}
        />
      </div>
    </section>
  );
}

/** Final 3D podium: 1st / 2nd / 3rd cards rising under a spotlight. */
export function Podium({
  players,
  meId,
  hideOtherScores = false,
}: {
  players: Player[];
  meId?: string;
  hideOtherScores?: boolean;
}) {
  const first = players[0];
  const second = players[1];
  const third = players[2];

  const columns = [
    { player: second, rank: 2, height: "h-32", delay: 0.7 },
    { player: first, rank: 1, height: "h-48", delay: 1.4 },
    { player: third, rank: 3, height: "h-24", delay: 0 },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      {first && (
        <div
          aria-hidden
          className="anim-spotlight absolute -inset-x-10 -top-28 bottom-0"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 100%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%)",
          }}
        />
      )}
      <div className="relative grid grid-cols-3 items-end gap-3">
        {columns.map(({ player, rank, height, delay }) => (
          <div key={rank} className="flex flex-col items-center justify-end gap-3">
            {player ? (
              <>
                <div
                  className={cn(
                    "anim-pop max-w-full rounded-2xl border px-2.5 py-2 text-center shadow-elevated",
                    rank === 1
                      ? "border-accent/40 bg-accent/10"
                      : rank === 2
                        ? "border-foreground/15 bg-foreground/5"
                        : "border-warning/25 bg-warning/5",
                  )}
                  style={{ animationDelay: `${delay + 0.55}s` }}
                >
                  {rank === 1 ? (
                    <Crown className="mx-auto mb-1 h-5 w-5 text-accent" />
                  ) : (
                    <Medal
                      className={cn(
                        "mx-auto mb-1 h-4 w-4",
                        rank === 2 ? "text-foreground/70" : "text-warning",
                      )}
                    />
                  )}
                  <p className="truncate font-display text-sm font-semibold tracking-tight sm:text-base">
                    {player.nickname}
                  </p>
                  {(!hideOtherScores || player.id === meId) && (
                    <p className="numeral text-base text-muted-foreground">
                      {formatPoints(player.score)} poin
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "anim-rise relative flex w-full items-start justify-center rounded-t-2xl border border-glass-border pt-3",
                    height,
                    rank === 1
                      ? "podium-shimmer border-accent/50 bg-accent/20"
                      : rank === 2
                        ? "border-foreground/20 bg-foreground/10"
                        : "border-warning/30 bg-warning/10",
                  )}
                  style={{ animationDelay: `${delay + 0.15}s` }}
                >
                  <span
                    className={cn(
                      "numeral text-2xl",
                      rank === 1
                        ? "text-accent"
                        : rank === 2
                          ? "text-foreground/80"
                          : "text-warning",
                    )}
                  >
                    {rank}
                  </span>
                </div>
              </>
            ) : (
              <div className={cn("w-full rounded-t-2xl bg-glass/40", height)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
