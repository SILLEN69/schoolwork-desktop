import { useEffect, useMemo, useRef, useState } from "react";
import "./atom-game.css";

/* Star catch — the little game hidden in the working atom.
   Same atom as the indicator: three stars ride their tilted orbits;
   click a star to catch it before the 30 seconds are up. No fail state —
   it is a fidget game, not a test. */

const LIME = "#c8f174";
const DISC = "#2F3242";
const ORBITS = [
  { a: 80, b: 30, rot: -28 },
  { a: 80, b: 30, rot: 32 },
  { a: 80, b: 30, rot: 92 },
] as const;
const STARS = [
  { orbit: 0, start: 205, dir: 1, size: 8 },
  { orbit: 1, start: 25, dir: -1, size: 7 },
  { orbit: 2, start: 130, dir: 1, size: 7.5 },
] as const;
const GAME_PERIOD = 5; // seconds per revolution (slower than the 2s indicator)
const ROUND_SECONDS = 30;
const COOLDOWN = 1.8; // seconds a caught star stays gone
const BEST_KEY = "schoolwork-starcatch-best";

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

export default function AtomGame({
  open,
  swedish,
  origin,
  onClose,
}: {
  open: boolean;
  swedish: boolean;
  /** Screen position the panel expands from (the clicked atom). */
  origin: { x: number; y: number } | null;
  onClose: () => void;
}) {
  const t = (en: string, sv: string) => (swedish ? sv : en);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0));
  const [record, setRecord] = useState(false);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [expanded, setExpanded] = useState(false);
  const scoreRef = useRef(0);
  const bestRef = useRef(best);
  bestRef.current = best;
  const startAt = useRef(0);
  const cooldownUntil = useRef<number[]>([-9, -9, -9]);
  const popTime = useRef<number[]>([-9, -9, -9]);
  const popPos = useRef<{ x: number; y: number }[]>([
    { x: 100, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 100 },
  ]);
  const starRefs = useRef<(SVGGElement | null)[]>([]);
  const ringRefs = useRef<(SVGCircleElement | null)[]>([]);
  const timerRef = useRef<HTMLDivElement>(null);

  const field = useMemo(
    () =>
      Array.from({ length: 70 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() < 0.8 ? 2 : 3,
        delay: -(Math.random() * 4),
      })),
    [],
  );

  const startRound = () => {
    scoreRef.current = 0;
    setScore(0);
    setRecord(false);
    cooldownUntil.current = [-9, -9, -9];
    popTime.current = [-9, -9, -9];
    startAt.current = performance.now();
    setPhase("playing");
  };

  useEffect(() => {
    if (!open) return;
    startRound();
    setExpanded(false);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setExpanded(true)),
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes the game.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Main animation loop: star positions, pop rings, timer bar, round end.
  useEffect(() => {
    if (!open || phase !== "playing") return;
    let raf = 0;
    const tick = (now: number) => {
      const s = (now - startAt.current) / 1000;
      const remaining = Math.max(0, ROUND_SECONDS - s);
      if (timerRef.current)
        timerRef.current.style.width = `${(remaining / ROUND_SECONDS) * 100}%`;
      STARS.forEach((star, i) => {
        const o = ORBITS[star.orbit];
        const g = starRefs.current[i];
        if (g) {
          const angle = star.start + (star.dir * 360 * s) / GAME_PERIOD;
          const p = pointOnOrbit(o, angle);
          g.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
          const hidden = s < cooldownUntil.current[i];
          g.style.opacity = hidden ? "0" : "1";
          g.style.pointerEvents = hidden ? "none" : "auto";
        }
        const ring = ringRefs.current[i];
        if (ring) {
          const dt = s - popTime.current[i];
          if (dt >= 0 && dt < 0.45) {
            const k = dt / 0.45;
            ring.setAttribute("cx", String(popPos.current[i].x));
            ring.setAttribute("cy", String(popPos.current[i].y));
            ring.setAttribute("r", String(9 + 30 * k));
            ring.setAttribute("opacity", String(1 - k));
          } else {
            ring.setAttribute("opacity", "0");
          }
        }
      });
      if (remaining <= 0) {
        const final = scoreRef.current;
        const isRecord = final > bestRef.current;
        if (isRecord) {
          bestRef.current = final;
          setBest(final);
          try {
            localStorage.setItem(BEST_KEY, String(final));
          } catch {
            /* best score is a nice-to-have, never break the round */
          }
        }
        setRecord(isRecord);
        setPhase("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, phase]);

  const pop = (i: number) => {
    if (phase !== "playing") return;
    const s = (performance.now() - startAt.current) / 1000;
    if (s < cooldownUntil.current[i]) return;
    const star = STARS[i];
    const o = ORBITS[star.orbit];
    const angle = star.start + (star.dir * 360 * s) / GAME_PERIOD;
    popPos.current[i] = pointOnOrbit(o, angle);
    popTime.current[i] = s;
    cooldownUntil.current[i] = s + COOLDOWN;
    scoreRef.current += 1;
    setScore(scoreRef.current);
  };

  if (!open) return null;
  return (
    <div className="atom-game-backdrop">
      <div
        className={"atom-game" + (expanded ? " atom-game-open" : "")}
        style={{
          transformOrigin: origin
            ? `${origin.x}px ${origin.y}px`
            : "50% 100%",
        }}
        role="dialog"
        aria-label={t("Star catch", "Stjärnfångst")}
      >
        {field.map((f, i) => (
          <span
            key={i}
            className="atom-star-dot"
            style={{
              left: `${f.left}%`,
              top: `${f.top}%`,
              width: f.size,
              height: f.size,
              animationDelay: `${f.delay}s`,
            }}
          />
        ))}
        <div className="atom-game-head">
          <div>
            <h2>{t("Star catch", "Stjärnfångst")}</h2>
            <p>
              {t(
                "Click the stars while they orbit — catch as many as you can.",
                "Klicka på stjärnorna medan de kretsar — fånga så många du hinner.",
              )}
            </p>
          </div>
          <button
            className="atom-game-close"
            aria-label={t("Close", "Stäng")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="atom-game-score">
          <span>
            <b>{score}</b> {t("caught", "fångade")}
          </span>
          <span>
            {t("Best", "Bästa")} <b>{Math.max(best, score)}</b>
          </span>
        </div>
        <svg viewBox="0 0 200 200" className="atom-game-atom" aria-hidden="true">
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
                <circle
                  ref={(el) => {
                    ringRefs.current[i] = el;
                  }}
                  cx="100"
                  cy="100"
                  r="9"
                  fill="none"
                  stroke={LIME}
                  strokeWidth={2}
                  opacity="0"
                />
                <g
                  className="star-g"
                  ref={(el) => {
                    starRefs.current[i] = el;
                  }}
                  transform={`translate(${p0.x.toFixed(2)} ${p0.y.toFixed(2)})`}
                  style={{ transition: "opacity 150ms ease" }}
                  onClick={() => pop(i)}
                >
                  <circle r={star.size * 1.9} fill={LIME} opacity={0.25} />
                  <circle r={star.size} fill={LIME} />
                  <circle r={19} fill="none" style={{ pointerEvents: "all" }} />
                </g>
              </g>
            );
          })}
          <circle cx="100" cy="100" r="15" fill={LIME} opacity={0.22} />
          <circle cx="100" cy="100" r="8" fill={LIME} />
        </svg>
        <div className="atom-game-timer">
          <div ref={timerRef} />
        </div>
        {phase === "done" && (
          <div className="atom-game-over">
            <h3>{t("Time's up!", "Tiden är slut!")}</h3>
            <p>
              <b>{score}</b> {t("stars caught", "stjärnor fångade")}
              {record ? ` · ${t("new best!", "nytt rekord!")}` : ""}
            </p>
            <div>
              <button className="primary" onClick={startRound}>
                {t("Play again", "Spela igen")}
              </button>
              <button onClick={onClose}>{t("Back to work", "Tillbaka till arbetet")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
