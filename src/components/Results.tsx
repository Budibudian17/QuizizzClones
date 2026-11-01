import { cn } from "@/lib/utils";
import { getPlayersBelowPodium } from "@/game/results";
import { formatPoints } from "@/game/scoring";
import type { Player } from "@/game/types";

/** Top-5 ranking shown between questions. */
export function Leaderboard({
  players,
  meId,
  compact = false,
}: {
  players: Player[];
  meId?: string;
  compact?: boolean;
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
            {p.lastGain > 0 && (
              <p className="text-xs font-medium text-success">+{formatPoints(p.lastGain)}</p>
            )}
          </div>
          <span className="numeral text-lg">{formatPoints(p.score)}</span>
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
}: {
  players: Player[];
  meId?: string;
  className?: string;
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
            <span className="numeral text-lg">{formatPoints(player.score)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Final 3D podium: 1st / 2nd / 3rd cards rising under a spotlight. */
export function Podium({ players }: { players: Player[] }) {
  const first = players[0];
  const second = players[1];
  const third = players[2];

  const columns = [
    { player: second, rank: 2, height: "h-28", delay: 0.7 },
    { player: first, rank: 1, height: "h-44", delay: 1.4 },
    { player: third, rank: 3, height: "h-20", delay: 0 },
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
                  className="anim-pop text-center"
                  style={{ animationDelay: `${delay + 0.55}s` }}
                >
                  <p className="truncate font-display text-sm font-semibold tracking-tight sm:text-base">
                    {player.nickname}
                  </p>
                  <p className="numeral text-lg text-muted-foreground">
                    {formatPoints(player.score)}
                  </p>
                </div>
                <div
                  className={cn(
                    "anim-rise relative flex w-full items-start justify-center rounded-t-2xl border border-glass-border pt-3",
                    height,
                    rank === 1 ? "podium-shimmer border-accent/40 bg-accent/15" : "bg-glass",
                  )}
                  style={{ animationDelay: `${delay + 0.15}s` }}
                >
                  <span
                    className={cn(
                      "numeral text-2xl",
                      rank === 1 ? "text-accent" : "text-muted-foreground",
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
