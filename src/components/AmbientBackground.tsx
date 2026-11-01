import { useEffect, useRef } from "react";

/**
 * Minimalist ambient layer: perspective grid + floating glass cards that
 * drift subtly with cursor movement (parallax by depth, eased with rAF).
 */
const CARDS = [
  { top: "12%", left: "6%", size: 150, depth: 0.5, tilt: -6, delay: 0 },
  { top: "58%", left: "3%", size: 100, depth: 0.9, tilt: 10, delay: 1.6 },
  { top: "16%", left: "82%", size: 190, depth: 0.65, tilt: 7, delay: 0.8 },
  { top: "70%", left: "78%", size: 120, depth: 1.1, tilt: -12, delay: 2.4 },
  { top: "34%", left: "46%", size: 80, depth: 0.35, tilt: 4, delay: 3.1 },
];

export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const loop = () => {
      current.x += (target.x - current.x) * 0.045;
      current.y += (target.y - current.y) * 0.045;
      el.style.setProperty("--mx", current.x.toFixed(4));
      el.style.setProperty("--my", current.y.toFixed(4));
      raf = window.requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = window.requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="ambient" aria-hidden>
      <div className="ambient-grid" />
      {CARDS.map((c, i) => (
        <div
          key={i}
          className="ambient-card anim-float"
          style={
            {
              top: c.top,
              left: c.left,
              width: c.size,
              height: c.size * 0.72,
              "--depth": c.depth,
              "--tilt": `${c.tilt}deg`,
              animationDelay: `${c.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
