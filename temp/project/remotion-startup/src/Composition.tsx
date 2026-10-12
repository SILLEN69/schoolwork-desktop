import {
  AbsoluteFill,
  Composition,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const MyComposition = () => (
  <Composition
    id="SchoolWorkStartup"
    component={SchoolWorkStartup}
    durationInFrames={96}
    fps={45}
    width={3840}
    height={2160}
  />
);

const LIME = "#c8f174";
const CLOUD = "#f4f5ef";
const MIST = "#9aa39b";

const clampOpts = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// --- Atom geometry (viewBox 200x200, center 100,100) ---
type Orbit = { a: number; b: number; rot: number };
const ORBITS: Orbit[] = [
  { a: 80, b: 30, rot: -28 },
  { a: 80, b: 30, rot: 32 },
  { a: 80, b: 30, rot: 92 },
];

type Planet = {
  orbit: number;
  finalAngle: number;
  spin: number; // full rotations before locking in
  color: string;
  size: number;
  move: [number, number]; // motion window: start -> locked in place
};
const PLANETS: Planet[] = [
  { orbit: 0, finalAngle: 205, spin: 2.2, color: LIME, size: 11, move: [2, 38] },
  { orbit: 1, finalAngle: 25, spin: -2.6, color: CLOUD, size: 8, move: [4, 42] },
  { orbit: 2, finalAngle: 130, spin: 1.8, color: "#8fd3c7", size: 7, move: [6, 46] },
];

const pointOnOrbit = (o: Orbit, angleDeg: number) => {
  const t = (angleDeg * Math.PI) / 180;
  const r = (o.rot * Math.PI) / 180;
  const x = o.a * Math.cos(t);
  const y = o.b * Math.sin(t);
  return {
    x: 100 + x * Math.cos(r) - y * Math.sin(r),
    y: 100 + x * Math.sin(r) + y * Math.cos(r),
  };
};

// Deterministic starfield
const STARS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i * 137.508 * Math.PI) / 180;
  const radius = 180 + (i % 5) * 90;
  return {
    key: i,
    x: 640 + Math.cos(angle) * radius * 1.5,
    y: 360 + Math.sin(angle) * radius * 0.8,
    size: 1.5 + (i % 3),
    phase: i * 1.7,
  };
});

const SchoolWorkStartup: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Orbits draw in, staggered
  const orbitDraw = (i: number) =>
    interpolate(frame, [2 + i * 3, 14 + i * 3], [0, 1], {
      easing: Easing.out(Easing.cubic),
      ...clampOpts,
    });

  // Whole atom eases from a slight tilt into place
  const settleT = interpolate(frame, [0, 46], [0, 1], clampOpts);
  const groupRot = (1 - Easing.out(Easing.cubic)(settleT)) * 12;

  // Nucleus
  const nucleus = interpolate(frame, [4, 12], [0, 1], {
    easing: Easing.out(Easing.back(2.2)),
    ...clampOpts,
  });

  // Planets: orbit fast, decelerate, lock into final angle
  const planets = PLANETS.map((p) => {
    const [m0, m1] = p.move;
    const t = interpolate(frame, [m0, m1], [0, 1], clampOpts);
    const angle = p.finalAngle + (1 - Easing.out(Easing.cubic)(t)) * p.spin * 360;
    const pos = pointOnOrbit(ORBITS[p.orbit], angle);
    const final = pointOnOrbit(ORBITS[p.orbit], p.finalAngle);
    const pop = interpolate(frame, [m1 - 4, m1, m1 + 4], [1, 1.3, 1], clampOpts);
    const fade = interpolate(frame, [2, 8], [0, 1], clampOpts);
    const ringT = interpolate(frame, [m1, m1 + 12], [0, 1], clampOpts);
    return { ...p, ...pos, final, pop, fade, ringT };
  });

  // Wordmark beside the logo
  const word = "SchoolWork";
  const letterIn = (i: number) => 46 + i * 1.4;
  const letterOpacity = (i: number) =>
    interpolate(frame, [letterIn(i), letterIn(i) + 8], [0, 1], {
      easing: Easing.out(Easing.cubic),
      ...clampOpts,
    });
  const letterX = (i: number) =>
    interpolate(frame, [letterIn(i), letterIn(i) + 8], [-16, 0], {
      easing: Easing.out(Easing.cubic),
      ...clampOpts,
    });

  const tagline = interpolate(frame, [58, 68], [0, 1], clampOpts);
  const taglineTrack = interpolate(frame, [58, 68], [6, 3.4], clampOpts);
  const caption = interpolate(frame, [70, 80, 84, 95], [0, 0.7, 0.7, 0], clampOpts);

  // Ambient glow
  const glowPulse = 0.5 + 0.08 * Math.sin(frame * 0.2);
  const glowIn = interpolate(frame, [0, 10], [0, 1], clampOpts);

  // Exit
  const exit = interpolate(frame, [84, 95], [1, 0], clampOpts);
  const exitScale = interpolate(frame, [84, 95], [1, 1.04], clampOpts);

  return (
    <div style={{position:"absolute",inset:0,backgroundColor:"#0f1213"}}>
    <AbsoluteFill
      style={{
        width: 1280,
        height: 720,
        left: (width - 1280) / 2,
        top: (height - 720) / 2,
        transform: `scale(${Math.min(width / 1280, height / 720)})`,
        transformOrigin: "center",
        backgroundColor: "#0f1213",
        color: CLOUD,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: 'Inter, "Segoe UI", sans-serif',
        opacity: exit,
        scale: exitScale,
      }}
    >
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Starfield */}
      {STARS.map((s) => (
        <div
          key={s.key}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            backgroundColor: CLOUD,
            opacity: (0.08 + 0.07 * Math.sin(frame * 0.12 + s.phase)) * glowIn,
          }}
        />
      ))}

      {/* Soft glow behind the atom */}
      <Interactive.Div
        name="Soft glow"
        style={{
          position: "absolute",
          width: 560,
          height: 420,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(200,241,116,0.22) 0%, rgba(200,241,116,0.05) 45%, transparent 72%)",
          scale: 0.9 + 0.1 * settleT,
          opacity: glowPulse * glowIn,
        }}
      />

      {/* Atom + wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 34,
        }}
      >
        <Interactive.Div
          name="Atom logo"
          style={{
            position: "relative",
            width: 150,
            height: 150,
            rotate: `${groupRot}deg`,
          }}
        >
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            {ORBITS.map((o, i) => (
              <ellipse
                key={i}
                cx="100"
                cy="100"
                rx={o.a}
                ry={o.b}
                transform={`rotate(${o.rot} 100 100)`}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - orbitDraw(i)}
                fill="none"
                stroke={MIST}
                strokeWidth={2.5}
                opacity={0.85}
              />
            ))}

            {/* Nucleus */}
            <circle cx="100" cy="100" r={16} fill={LIME} opacity={0.22 * nucleus} />
            <circle cx="100" cy="100" r={9} fill={LIME} opacity={nucleus} />

            {/* Lock-in rings */}
            {planets.map((p, i) =>
              p.ringT > 0 && p.ringT < 1 ? (
                <circle
                  key={`ring-${i}`}
                  cx={p.final.x}
                  cy={p.final.y}
                  r={5 + p.ringT * 16}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={1.5}
                  opacity={(1 - p.ringT) * 0.55}
                />
              ) : null
            )}

            {/* Planets */}
            {planets.map((p, i) => (
              <g key={i} opacity={p.fade}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.size * 0.95 * p.pop}
                  fill={p.color}
                  opacity={0.22}
                />
                <circle cx={p.x} cy={p.y} r={(p.size / 2) * p.pop} fill={p.color} />
              </g>
            ))}
          </svg>
        </Interactive.Div>

        <div style={{ overflow: "hidden", paddingRight: 8 }}>
          <Interactive.Div
            name="SchoolWork wordmark"
            style={{
              fontSize: 66,
              lineHeight: 1,
              fontWeight: 680,
              letterSpacing: -3.2,
              whiteSpace: "nowrap",
            }}
          >
            {word.split("").map((ch, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  color: i >= 6 ? LIME : CLOUD,
                  opacity: letterOpacity(i),
                  translate: `${letterX(i)}px 0`,
                }}
              >
                {ch}
              </span>
            ))}
          </Interactive.Div>
          <Interactive.Div
            name="Tagline"
            style={{
              marginTop: 14,
              fontSize: 16,
              letterSpacing: taglineTrack,
              textTransform: "uppercase",
              color: "#a6ad9c",
              opacity: tagline,
            }}
          >
            Powering Education
          </Interactive.Div>
        </div>
      </div>

      {/* Closing caption */}
      <Interactive.Div
        name="Closing caption"
        style={{
          position: "absolute",
          bottom: 54,
          fontSize: 13,
          letterSpacing: 1.1,
          color: "#71786e",
          opacity: caption,
        }}
      >
        YOUR WORKSPACE, READY
      </Interactive.Div>
    </AbsoluteFill>
    </div>
  );
};
