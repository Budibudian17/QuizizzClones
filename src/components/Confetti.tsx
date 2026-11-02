import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
};

const PALETTES = {
  gold: ["#ffc20e", "#d8893a", "#f4ead2", "#a9b879", "#d9654f"],
  ocean: ["#59a7ff", "#38c6c3", "#e7f2ff", "#c5a5ff", "#f2c14e"],
  forest: ["#83c98b", "#d4a84e", "#e8f0d7", "#d8893a", "#b8a5d6"],
} as const;
const BURST_MS = 1400;

/**
 * Confined 3D-feel confetti: a canvas-sized burst anchored to this component
 * only, so celebrations never spill over the rest of the UI. Re-fires each
 * time `burst` increments.
 */
export function ConfettiBurst({ burst }: { burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const activeTheme = document.documentElement.dataset["theme"];
    const palette =
      activeTheme === "ocean" || activeTheme === "forest" ? PALETTES[activeTheme] : PALETTES.gold;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const origin = { x: rect.width / 2, y: rect.height / 2 };
    const particles: Particle[] = [];
    for (let i = 0; i < 130; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 180 + Math.random() * 340;
      particles.push({
        x: origin.x + (Math.random() - 0.5) * 30,
        y: origin.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 180,
        size: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        color: palette[i % palette.length] ?? palette[0],
        life: 1,
      });
    }

    let raf = 0;
    const start = performance.now();
    let last = start;

    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const elapsed = t - start;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const fade = Math.max(0, 1 - elapsed / BURST_MS);

      for (const p of particles) {
        p.vy += 620 * dt; // gravity
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 0.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        // 3D feel: scale squash from rotation
        const depth = Math.cos(p.rot) * 0.5 + 0.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * 0.4);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, (-p.size * depth) / 2, p.size, p.size * depth);
        ctx.restore();
      }

      if (elapsed < BURST_MS) raf = window.requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, rect.width, rect.height);
    };
    raf = window.requestAnimationFrame(frame);

    return () => window.cancelAnimationFrame(raf);
  }, [burst]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
    />
  );
}
