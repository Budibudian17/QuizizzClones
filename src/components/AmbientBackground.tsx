import { useEffect, useRef } from "react";

/** Campus logos drift subtly with cursor movement, eased with rAF. */
const LOGOS = [
  { src: "/img/ui.webp", top: "12%", left: "7%", size: 112, depth: 0.5, tilt: -6, delay: 0 },
  { src: "/img/nf.webp", top: "62%", left: "4%", size: 104, depth: 0.9, tilt: 10, delay: 1.6 },
  { src: "/img/itb.webp", top: "15%", left: "82%", size: 126, depth: 0.65, tilt: 7, delay: 0.8 },
  { src: "/img/binus.webp", top: "72%", left: "78%", size: 120, depth: 1.1, tilt: -12, delay: 2.4 },
  { src: "/img/ipb.webp", top: "42%", left: "88%", size: 84, depth: 0.35, tilt: 4, delay: 3.1 },
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
      {LOGOS.map((c, i) => (
        <div
          key={i}
          className="ambient-logo anim-float"
          style={
            {
              top: c.top,
              left: c.left,
              width: c.size,
              "--depth": c.depth,
              "--tilt": `${c.tilt}deg`,
              animationDelay: `${c.delay}s`,
            } as React.CSSProperties
          }
        >
          <img src={c.src} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
}
