import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

/* Animated "model is working" atom indicator.
   Same geometry and motion as the SchoolWorkLoop render in remotion-startup:
   three stars orbit their own tilted ellipses with a fading comet trail,
   the disc and nucleus stay put, and the whole atom breathes gently.
   Pass animated={false} for a static version (used in the task toast). */

const LIME = "#c8f174";
const DISC = "#2F3242";

const ORBITS = [
  { a: 80, b: 30, rot: -28 },
  { a: 80, b: 30, rot: 32 },
  { a: 80, b: 30, rot: 92 },
] as const;

const STARS = [
  { orbit: 0, start: 205, dir: 1, size: 6 },
  { orbit: 1, start: 25, dir: -1, size: 5 },
  { orbit: 2, start: 130, dir: 1, size: 5.5 },
] as const;

const TRAIL_SEGS = 20;
const TRAIL_STEP = 0.03024; // fraction of the orbit covered by one segment
const PERIOD = 2; // seconds per revolution (matches the 60-frame render loop)
const BREATHE = 0.018; // the whole atom scales by ±1.8%

// Same convention as the render: angle 0 = rightmost point of the (rotated)
// ellipse, increasing angle travels the SVG ellipse path.
const pointOnOrbit = (o: { a: number; b: number; rot: number }, deg: number) => {
  const t = (deg * Math.PI) / 180;
  const r = (o.rot * Math.PI) / 180;
  const x = o.a * Math.cos(t);
  const y = o.b * Math.sin(t);
  return {
    x: 100 + x * Math.cos(r) - y * Math.sin(r),
    y: 100 + x * Math.sin(r) + y * Math.cos(r),
  };
};

export default function AtomWorking({
  size = 26,
  className = "",
  animated = true,
  onClick,
  title,
}: {
  size?: number;
  className?: string;
  /** Set false to render the atom at rest (no rAF loop). */
  animated?: boolean;
  onClick?: (e: MouseEvent<HTMLSpanElement>) => void;
  title?: string;
}) {
  const breatheRef = useRef<HTMLDivElement>(null);
  const starRefs = useRef<(SVGCircleElement | null)[]>([]);
  const haloRefs = useRef<(SVGCircleElement | null)[]>([]);
  const trailRefs = useRef<(SVGEllipseElement | null)[][]>([[], [], []]);

  useEffect(() => {
    if (!animated) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const s = (now - t0) / 1000;
      const f = (s / PERIOD) * 60; // frame-equivalent of the 30fps render
      // The whole atom (disc, orbits, stars) breathes together.
      if (breatheRef.current) {
        breatheRef.current.style.transform = `scale(${
          1 + BREATHE * Math.sin((Math.PI * 2 * s) / PERIOD)
        })`;
      }
      STARS.forEach((star, i) => {
        const o = ORBITS[star.orbit];
        const angle = star.start + (star.dir * 360 * f) / 60;
        const t = (((angle % 360) + 360) % 360) / 360;
        const p = pointOnOrbit(o, angle);
        starRefs.current[i]?.setAttribute("cx", p.x.toFixed(2));
        starRefs.current[i]?.setAttribute("cy", p.y.toFixed(2));
        haloRefs.current[i]?.setAttribute("cx", p.x.toFixed(2));
        haloRefs.current[i]?.setAttribute("cy", p.y.toFixed(2));
        const trails = trailRefs.current[i];
        for (let k = 0; k < TRAIL_SEGS; k++) {
          const el = trails[k];
          if (!el) continue;
          const p0 =
            star.dir > 0 ? t - (k + 1) * TRAIL_STEP : t + k * TRAIL_STEP;
          el.setAttribute("stroke-dashoffset", (-p0).toFixed(4));
        }
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated]);

  return (
    <span
      className={`atom-working ${className}`.trim()}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        flex: "none",
        cursor: onClick ? "pointer" : undefined,
      }}
      aria-label={title || "Working"}
      role={onClick ? "button" : "img"}
      title={title}
      onClick={onClick}
    >
      <div ref={breatheRef} style={{ width: "100%", height: "100%", willChange: "transform" }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
          <circle cx="100" cy="100" r="100" fill={DISC} />
          {ORBITS.map((o, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="100"
              rx={o.a}
              ry={o.b}
              transform={`rotate(${o.rot} 100 100)`}
              fill="none"
              stroke={LIME}
              strokeWidth={2.5}
              opacity={0.3}
            />
          ))}
          {STARS.map((star, i) => {
            const o = ORBITS[star.orbit];
            const p0 = pointOnOrbit(o, star.start);
            return (
              <g key={i}>
                {Array.from({ length: TRAIL_SEGS }, (_, k) => (
                  <ellipse
                    key={k}
                    ref={(el) => {
                      trailRefs.current[i][k] = el;
                    }}
                    cx="100"
                    cy="100"
                    rx={o.a}
                    ry={o.b}
                    transform={`rotate(${o.rot} 100 100)`}
                    pathLength={1}
                    fill="none"
                    stroke={LIME}
                    strokeWidth={1.5 + 2.5 * (1 - k / TRAIL_SEGS)}
                    strokeLinecap="round"
                    strokeDasharray={`${TRAIL_STEP} ${1 - TRAIL_STEP}`}
                    strokeDashoffset={0}
                    opacity={0.8 * (1 - k / TRAIL_SEGS)}
                  />
                ))}
                <circle
                  ref={(el) => {
                    haloRefs.current[i] = el;
                  }}
                  cx={p0.x}
                  cy={p0.y}
                  r={star.size * 1.9}
                  fill={LIME}
                  opacity={0.22}
                />
                <circle
                  ref={(el) => {
                    starRefs.current[i] = el;
                  }}
                  cx={p0.x}
                  cy={p0.y}
                  r={star.size * 0.95}
                  fill={LIME}
                />
              </g>
            );
          })}
          <circle cx="100" cy="100" r="15" fill={LIME} opacity={0.22} />
          <circle cx="100" cy="100" r="8" fill={LIME} />
        </svg>
      </div>
    </span>
  );
}
