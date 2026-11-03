import { ArrowLeft, Check, Shirt, Sparkles } from "lucide-react";

import {
  AVATAR_BAGS,
  AVATAR_BAG_LABELS,
  AVATAR_CHARACTER_LABELS,
  AVATAR_CHARACTERS,
  AVATAR_COLOR_LABELS,
  AVATAR_COLORS,
  AVATAR_GLASSES,
  AVATAR_GLASSES_LABELS,
  AVATAR_HAIR,
  AVATAR_HAIR_LABELS,
  AVATAR_HATS,
  AVATAR_HAT_LABELS,
  AVATAR_PANTS,
  AVATAR_PANTS_LABELS,
  AVATAR_SHIRTS,
  AVATAR_SHIRT_LABELS,
  type AvatarConfig,
} from "@/game/player-avatar";
import { cn } from "@/lib/utils";

const COLORS: Record<AvatarConfig["color"], { coat: string; accent: string }> = {
  amber: { coat: "#f5b942", accent: "#9b541f" },
  rose: { coat: "#f28ca5", accent: "#973c61" },
  mint: { coat: "#6ed6b0", accent: "#27775c" },
  sky: { coat: "#73b9f4", accent: "#315e9d" },
  violet: { coat: "#b197f2", accent: "#6347a4" },
  lime: { coat: "#9fd45c", accent: "#527a2c" },
};

const SHIRT_COLORS: Record<AvatarConfig["shirt"], string> = {
  teal: "#2aa89b",
  coral: "#ef786c",
  indigo: "#5968ca",
  cream: "#f1dfb5",
  plum: "#9b5b9b",
};

const PANTS_COLORS: Record<AvatarConfig["pants"], string> = {
  navy: "#354b70",
  charcoal: "#48505b",
  olive: "#69784d",
  denim: "#557da2",
};

export function PlayerAvatar({ avatar, className }: { avatar: AvatarConfig; className?: string }) {
  const palette = COLORS[avatar.color];
  const robot = avatar.character === "robot";
  const bird = avatar.character === "bird";

  return (
    <svg
      viewBox="0 0 128 192"
      role="img"
      aria-label={`${AVATAR_CHARACTER_LABELS[avatar.character]}, ${AVATAR_HAT_LABELS[avatar.hat]}, ${AVATAR_GLASSES_LABELS[avatar.glasses]}, ${AVATAR_BAG_LABELS[avatar.bag]}`}
      className={cn("shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {avatar.bag === "backpack" && (
        <g>
          <path
            d="M37 87q-17 0-17 18v27h23V99Z"
            fill={palette.accent}
            stroke="#493a46"
            strokeWidth="3"
          />
          <path d="M27 105v18m0-7h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {avatar.bag === "sling" && (
        <>
          <path d="M41 79q-3 38 24 61" fill="none" stroke={palette.accent} strokeWidth="8" />
          <rect
            x="58"
            y="126"
            width="25"
            height="27"
            rx="8"
            fill={palette.accent}
            stroke="#493a46"
            strokeWidth="3"
          />
        </>
      )}

      <path
        d="M49 126h30l3 37H70l-6-21-7 21H45Z"
        fill={PANTS_COLORS[avatar.pants]}
        stroke="#493a46"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M45 160h15l-2 12H40q-4 0-3-4l2-4q2-3 6-4Zm25 0h13l5 8q2 4-2 4H68Z"
        fill="#f3e8d7"
        stroke="#493a46"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M48 166h12m10 0h13" stroke="#c5b6a2" strokeWidth="2" />

      <path
        d="M43 81q-9 2-13 12l-9 26q-2 6 4 8t9-4l13-23Zm42 0q9 2 13 12l9 26q2 6-4 8t-9-4L81 100Z"
        fill={palette.coat}
        stroke={palette.accent}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M29 121q-2 8 4 10t9-6m57-4q2 8-4 10t-9-6"
        fill={palette.coat}
        stroke={palette.accent}
        strokeWidth="3"
      />
      <path
        d="M43 78q21-11 42 0l8 49q-29 12-58 0Z"
        fill={SHIRT_COLORS[avatar.shirt]}
        stroke="#493a46"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="m53 79 11 13 12-13m-12 13v29"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        opacity=".8"
      />
      <circle cx="64" cy="104" r="2" fill="#fff" />
      <circle cx="64" cy="116" r="2" fill="#fff" />

      {avatar.character === "cat" && (
        <path
          d="m42 45-7-25 23 14m28 11 7-25-23 14"
          fill={palette.coat}
          stroke={palette.accent}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      )}
      {avatar.character === "fox" && (
        <path
          d="m41 47-11-34 30 18m27 16 11-34-30 18"
          fill={palette.coat}
          stroke={palette.accent}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      )}
      {avatar.character === "bear" && (
        <g fill={palette.coat} stroke={palette.accent} strokeWidth="4">
          <circle cx="42" cy="31" r="13" />
          <circle cx="86" cy="31" r="13" />
        </g>
      )}
      {avatar.character === "frog" && (
        <g fill={palette.coat} stroke={palette.accent} strokeWidth="3">
          <circle cx="46" cy="23" r="13" />
          <circle cx="82" cy="23" r="13" />
        </g>
      )}

      {avatar.hair === "long" && (
        <path
          d="M37 44q-12 14-7 45l12 6 2-33 42 1 4 32 10-7q4-30-10-47Z"
          fill="#49333a"
          stroke="#342931"
          strokeWidth="3"
        />
      )}
      {avatar.hair === "curly" && (
        <g fill="#49333a" stroke="#342931" strokeWidth="2">
          <circle cx="43" cy="31" r="10" />
          <circle cx="55" cy="24" r="11" />
          <circle cx="69" cy="23" r="12" />
          <circle cx="83" cy="30" r="10" />
          <circle cx="91" cy="39" r="8" />
        </g>
      )}
      <path
        d={
          robot
            ? "M39 40q0-9 9-9h32q9 0 9 9v32q0 12-12 12H51q-12 0-12-12Z"
            : bird
              ? "M39 48q0-29 25-29t25 29q0 31-25 31T39 48Z"
              : "M37 49q0-31 27-31t27 31q0 33-27 33T37 49Z"
        }
        fill={robot ? "#d9e2ec" : bird ? "#fff0bc" : palette.coat}
        stroke={robot ? "#64748b" : palette.accent}
        strokeWidth="4"
      />
      {avatar.hair === "short" && (
        <path
          d="M39 42q2-27 25-27t25 28q-8-15-17-16-12 14-33 15Z"
          fill="#49333a"
          stroke="#342931"
          strokeWidth="3"
        />
      )}
      {robot ? (
        <g fill="#28364a">
          <rect x="48" y="43" width="9" height="10" rx="3" />
          <rect x="71" y="43" width="9" height="10" rx="3" />
          <path d="M53 67h20" stroke="#28364a" strokeWidth="4" strokeLinecap="round" />
        </g>
      ) : (
        <>
          <g fill="#352b35">
            <ellipse cx="53" cy="48" rx="3" ry="4" />
            <ellipse cx="75" cy="48" rx="3" ry="4" />
          </g>
          <path
            d="m58 60 6 4 6-4"
            fill="none"
            stroke="#713f48"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
      {avatar.character === "fox" && (
        <path d="M49 66q15 12 30 0-4 15-15 15T49 66Z" fill="#fff1d2" />
      )}
      {avatar.character === "cat" && (
        <path d="m46 65 8 3m20-3-8 3" stroke="#fff0df" strokeWidth="3" strokeLinecap="round" />
      )}
      {bird && (
        <path
          d="m59 54 21 5-20 8"
          fill="#f28e42"
          stroke="#a95725"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {avatar.character === "frog" && (
        <g fill="#352b35">
          <circle cx="46" cy="24" r="4" />
          <circle cx="82" cy="24" r="4" />
        </g>
      )}

      {avatar.glasses === "round" && (
        <g fill="none" stroke="#26364a" strokeWidth="3">
          <circle cx="53" cy="49" r="9" />
          <circle cx="75" cy="49" r="9" />
          <path d="M62 49h4" />
        </g>
      )}
      {(avatar.glasses === "square" || avatar.glasses === "sunglasses") && (
        <g
          fill={avatar.glasses === "sunglasses" ? "#273248" : "none"}
          stroke="#26364a"
          strokeWidth="3"
        >
          <rect x="43" y="41" width="19" height="17" rx="4" />
          <rect x="66" y="41" width="19" height="17" rx="4" />
          <path d="M62 48h4" />
        </g>
      )}

      {avatar.hat === "cap" && (
        <g>
          <path d="M39 33q2-20 25-20t25 20Z" fill={palette.accent} />
          <path d="M64 32q22-3 34 8-11 5-34 2Z" fill={palette.accent} />
        </g>
      )}
      {avatar.hat === "beanie" && (
        <g>
          <path d="M39 34q1-23 25-23t25 23Z" fill={palette.accent} />
          <path d="M38 31h52v9H38Z" fill={palette.coat} />
          <circle cx="64" cy="10" r="5" fill="#fff" />
        </g>
      )}
      {avatar.hat === "crown" && (
        <path
          d="m42 34 4-22 18 14 18-14 5 22Z"
          fill="#ffd34e"
          stroke="#aa7417"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export function AvatarCustomizer({
  value,
  nickname,
  onChange,
  onSave,
  onCancel,
  saving = false,
  error = "",
}: {
  value: AvatarConfig;
  nickname: string;
  onChange: (value: AvatarConfig) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string;
}) {
  const update = <K extends keyof AvatarConfig>(key: K, next: AvatarConfig[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <section className="fixed inset-0 z-50 flex min-h-dvh w-full flex-col overflow-y-auto bg-background/95 px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke lobby
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="press-3d hidden items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 lg:inline-flex"
        >
          <Check className="h-4 w-4" />
          {saving ? "Menyimpan…" : "Simpan avatar"}
        </button>
      </header>

      <div className="mx-auto mt-5 grid w-full max-w-6xl flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <div className="order-2 min-h-0 rounded-3xl border border-glass-border bg-card/80 p-4 sm:p-5 lg:order-1 lg:overflow-y-auto">
          <h1 className="font-display text-xl font-extrabold">Studio avatar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Racik karakter kamu. Semua perubahan terlihat langsung di preview.
          </p>
          <div className="mt-4 grid gap-1">
            <ChoiceRow
              label="Karakter"
              selected={value.character}
              options={AVATAR_CHARACTERS.map((key) => ({
                value: key,
                label: AVATAR_CHARACTER_LABELS[key],
              }))}
              onChange={(next) => update("character", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Warna karakter"
              selected={value.color}
              options={AVATAR_COLORS.map((key) => ({
                value: key,
                label: AVATAR_COLOR_LABELS[key],
              }))}
              onChange={(next) => update("color", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Rambut"
              selected={value.hair}
              options={AVATAR_HAIR.map((key) => ({ value: key, label: AVATAR_HAIR_LABELS[key] }))}
              onChange={(next) => update("hair", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Baju"
              selected={value.shirt}
              options={AVATAR_SHIRTS.map((key) => ({
                value: key,
                label: AVATAR_SHIRT_LABELS[key],
              }))}
              onChange={(next) => update("shirt", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Celana"
              selected={value.pants}
              options={AVATAR_PANTS.map((key) => ({ value: key, label: AVATAR_PANTS_LABELS[key] }))}
              onChange={(next) => update("pants", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Topi"
              selected={value.hat}
              options={AVATAR_HATS.map((key) => ({ value: key, label: AVATAR_HAT_LABELS[key] }))}
              onChange={(next) => update("hat", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Kacamata"
              selected={value.glasses}
              options={AVATAR_GLASSES.map((key) => ({
                value: key,
                label: AVATAR_GLASSES_LABELS[key],
              }))}
              onChange={(next) => update("glasses", next)}
              disabled={saving}
            />
            <ChoiceRow
              label="Tas"
              selected={value.bag}
              options={AVATAR_BAGS.map((key) => ({ value: key, label: AVATAR_BAG_LABELS[key] }))}
              onChange={(next) => update("bag", next)}
              disabled={saving}
            />
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Pilihan avatar akan terlihat oleh semua pemain di lobby.
          </div>
        </div>

        <div className="order-1 flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-glass-border bg-[radial-gradient(ellipse_at_50%_68%,hsl(var(--primary)/.22),transparent_65%),linear-gradient(160deg,hsl(var(--card)),hsl(var(--background)))] p-4 lg:order-2 lg:min-h-[560px]">
          <div className="mb-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-muted-foreground">
              Preview karakter
            </p>
            <p className="mt-1 font-display text-lg font-bold">{nickname}</p>
          </div>
          <div className="flex h-[230px] w-full items-end justify-center sm:h-[280px] lg:h-[410px]">
            <PlayerAvatar
              avatar={value}
              className="h-full w-auto drop-shadow-[0_18px_22px_rgba(0,0,0,.28)]"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Shirt className="h-4 w-4" />
            Full-body avatar
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="press-3d mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 lg:hidden"
      >
        {saving ? "Menyimpan avatar…" : "Simpan dan kembali ke lobby"}
      </button>
    </section>
  );
}

function ChoiceRow<T extends string>({
  label,
  selected,
  options,
  onChange,
  disabled,
}: {
  label: string;
  selected: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="border-b border-glass-border py-3 last:border-0" disabled={disabled}>
      <legend className="mb-2 text-xs font-semibold text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected === option.value
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-input bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
