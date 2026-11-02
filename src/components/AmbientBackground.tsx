import { useEffect, useRef, useState } from "react";

import { loadUniversityLogos, type UniversityLogoPlacement } from "@/game/university-logos";

export function AmbientBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [logos, setLogos] = useState<UniversityLogoPlacement[]>([]);

  useEffect(() => {
    let active = true;
    void loadUniversityLogos()
      .then((loadedLogos) => {
        if (active) setLogos(loadedLogos);
      })
      .catch((cause: unknown) => {
        console.error("Failed to load university logos from Wikipedia.", cause);
      });
    return () => {
      active = false;
    };
  }, []);

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
      {logos.map((c) => (
        <div
          key={c.key}
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
          <img
            src={c.source}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setLogos((current) => current.filter((logo) => logo.key !== c.key))}
          />
        </div>
      ))}
    </div>
  );
}
