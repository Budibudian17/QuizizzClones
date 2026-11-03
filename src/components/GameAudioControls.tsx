import { useEffect, useRef, useState } from "react";
import { Music2, Volume2, VolumeX } from "lucide-react";

import type { GamePhase } from "@/game/types";

const NOTES = [392, 494, 587, 494, 440, 523, 659, 523, 392, 494, 587, 784];

export function GameAudioControls({
  phase,
  phaseStartedAt,
  durationMs,
}: {
  phase: GamePhase;
  phaseStartedAt: number;
  durationMs: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const previousPhase = useRef<GamePhase>(phase);
  const previousStartedAt = useRef(phaseStartedAt);
  const lastTick = useRef("");

  const tone = (frequency: number, duration = 0.13, volume = 0.07) => {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running") return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const enableAudio = async () => {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      const audio = audioRef.current ?? new AudioContextConstructor();
      audioRef.current = audio;
      await audio.resume();
      setEnabled(true);
      setMusicEnabled(true);
      tone(660, 0.11, 0.08);
    } catch (cause) {
      console.error("Could not enable game audio.", cause);
    }
  };

  const toggleSound = async () => {
    if (enabled) {
      setEnabled(false);
      setMusicEnabled(false);
      return;
    }
    await enableAudio();
  };

  useEffect(() => {
    if (!enabled) return;
    const previous = previousPhase.current;
    const questionRestarted = phase === "question" && phaseStartedAt !== previousStartedAt.current;
    if (phase !== previous || questionRestarted) {
      if (phase === "countdown") tone(740, 0.24, 0.1);
      else if (phase === "question") {
        tone(587, 0.13, 0.075);
        window.setTimeout(() => tone(784, 0.16, 0.075), 110);
      } else if (phase === "reveal") tone(494, 0.18, 0.07);
      else if (phase === "leaderboard") tone(659, 0.2, 0.07);
      else if (phase === "podium") {
        tone(523, 0.22, 0.08);
        window.setTimeout(() => tone(659, 0.22, 0.08), 150);
        window.setTimeout(() => tone(784, 0.32, 0.08), 300);
      }
      previousPhase.current = phase;
      previousStartedAt.current = phaseStartedAt;
    }
  }, [enabled, phase, phaseStartedAt]);

  useEffect(() => {
    if (!enabled || (phase !== "countdown" && phase !== "question")) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, durationMs - (Date.now() - phaseStartedAt));
      const seconds = Math.ceil(remaining / 1000);
      if (seconds < 1 || seconds > 3) return;
      const tickKey = `${phase}:${phaseStartedAt}:${seconds}`;
      if (lastTick.current === tickKey) return;
      lastTick.current = tickKey;
      tone(phase === "countdown" ? 620 + (4 - seconds) * 90 : 520, 0.11, 0.06);
    }, 70);
    return () => window.clearInterval(timer);
  }, [durationMs, enabled, phase, phaseStartedAt]);

  useEffect(() => {
    if (!enabled || !musicEnabled || phase === "lobby" || phase === "podium") return;
    let noteIndex = 0;
    const timer = window.setInterval(() => {
      tone(NOTES[noteIndex % NOTES.length]!, 0.24, 0.018);
      noteIndex += 1;
    }, 340);
    return () => window.clearInterval(timer);
  }, [enabled, musicEnabled, phase]);

  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio) void audio.close();
    },
    [],
  );

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMusicEnabled((current) => !current)}
        disabled={!enabled}
        aria-label={musicEnabled ? "Matikan musik tema" : "Nyalakan musik tema"}
        title={musicEnabled ? "Matikan musik tema" : "Nyalakan musik tema"}
        className="glass inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Music2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => void toggleSound()}
        aria-label={enabled ? "Matikan semua suara" : "Aktifkan suara game"}
        title={enabled ? "Matikan semua suara" : "Aktifkan suara game"}
        className="press-3d inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="hidden sm:inline">{enabled ? "Suara aktif" : "Aktifkan suara"}</span>
      </button>
    </div>
  );
}
