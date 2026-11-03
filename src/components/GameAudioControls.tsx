import { useCallback, useEffect, useRef, useState } from "react";
import { Music2, Volume2, VolumeX } from "lucide-react";

import type { GamePhase } from "@/game/types";

const GAME_MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047];
const PODIUM_MELODY = [392, 523, 659, 784, 659, 784, 1047, 784, 587, 784, 988, 1175];
const GAME_CHORDS = [
  [262, 330, 392],
  [220, 262, 330],
  [174, 220, 262],
  [196, 247, 294],
];
const PODIUM_CHORDS = [
  [196, 247, 294],
  [220, 262, 330],
  [262, 330, 392],
  [294, 370, 440],
];

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
  const userDisabledAudio = useRef(false);

  const tone = useCallback((frequency: number, duration = 0.13, volume = 0.07) => {
    const audio = audioRef.current;
    if (!audio || audio.state !== "running") return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);

  const enableAudio = useCallback(async () => {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return;
      const audio = audioRef.current ?? new AudioContextConstructor();
      audioRef.current = audio;
      await audio.resume();
      setEnabled(true);
      setMusicEnabled(true);
      tone(784, 0.18, 0.14);
    } catch (cause) {
      console.error("Could not enable game audio.", cause);
    }
  }, [tone]);

  const toggleSound = useCallback(async () => {
    if (enabled) {
      userDisabledAudio.current = true;
      setEnabled(false);
      setMusicEnabled(false);
      return;
    }
    await enableAudio();
  }, [enabled, enableAudio]);

  useEffect(() => {
    if (enabled || userDisabledAudio.current) return;
    const handleFirstInteraction = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("[data-audio-control]")) return;
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
      void enableAudio();
    };
    window.addEventListener("pointerdown", handleFirstInteraction, true);
    window.addEventListener("keydown", handleFirstInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };
  }, [enabled, enableAudio]);

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
  }, [enabled, phase, phaseStartedAt, tone]);

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
  }, [durationMs, enabled, phase, phaseStartedAt, tone]);

  useEffect(() => {
    if (!enabled || !musicEnabled) return;
    let noteIndex = 0;
    const podium = phase === "podium";
    const melody = podium ? PODIUM_MELODY : GAME_MELODY;
    const chords = podium ? PODIUM_CHORDS : GAME_CHORDS;
    const beatMs = podium ? 520 : 390;
    const timer = window.setInterval(() => {
      if (noteIndex % 4 === 0) {
        const chord = chords[(noteIndex / 4) % chords.length]!;
        for (const frequency of chord) tone(frequency, podium ? 0.62 : 0.48, 0.045);
        tone(chord[0]! / 2, podium ? 0.7 : 0.52, 0.08);
      }
      tone(melody[noteIndex % melody.length]!, podium ? 0.34 : 0.27, 0.2);
      noteIndex += 1;
    }, beatMs);
    return () => window.clearInterval(timer);
  }, [enabled, musicEnabled, phase, tone]);

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
        data-audio-control
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
        data-audio-control
        onClick={() => void toggleSound()}
        aria-label={enabled ? "Matikan semua suara" : "Aktifkan suara game"}
        title={enabled ? "Matikan semua suara" : "Aktifkan suara game"}
        className="press-3d inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span className="hidden sm:inline">{enabled ? "Musik aktif" : "Aktifkan musik"}</span>
      </button>
    </div>
  );
}
