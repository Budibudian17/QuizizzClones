import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const THEME_STORAGE_KEY = "quizverse.theme";

const THEMES = [
  { id: "gold", name: "Emas", color: "#ffc20e" },
  { id: "ocean", name: "Samudra", color: "#59a7ff" },
  { id: "forest", name: "Hutan", color: "#83c98b" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function ThemePicker({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeId>("gold");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(savedTheme)) {
        setTheme(savedTheme);
        document.documentElement.dataset["theme"] = savedTheme;
      } else {
        document.documentElement.dataset["theme"] = "gold";
      }
    } catch (error) {
      console.error("Failed to load saved color theme.", error);
      setStorageError(
        "Tema hanya berlaku sampai halaman ditutup karena penyimpanan browser tidak tersedia.",
      );
      document.documentElement.dataset["theme"] = "gold";
    }
  }, []);

  const chooseTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    document.documentElement.dataset["theme"] = nextTheme;
    setStorageError("");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error("Failed to save color theme.", error);
      setStorageError("Tema berubah, tetapi tidak dapat disimpan di browser ini.");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pilih tema warna"
          className={`glass inline-flex h-10 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 ${className}`}
        >
          <Palette className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Tema</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-2xl border-glass-border bg-card p-3">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pilih tema
        </p>
        <div className="space-y-1">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => chooseTheme(option.id)}
              aria-pressed={theme === option.id}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 rounded-full ring-2 ring-white/10"
                style={{ backgroundColor: option.color }}
              />
              <span className="flex-1">{option.name}</span>
              {theme === option.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
        {storageError && (
          <p role="status" className="mt-2 px-2 text-xs text-warning">
            {storageError}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
