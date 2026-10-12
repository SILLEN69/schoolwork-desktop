import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Easing,
  Folder,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {C, Logo, Tick, Window, clamp, ease} from '../showcase/Shared';

/* ---------- Brand stinger (5s) ---------- */
const Stinger: React.FC = () => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const portrait = height > width;
  const logoSize = portrait ? 250 : 210;
  const wordSize = portrait ? 112 : 94;
  const logoProgress = interpolate(f, [0, 24], [0, 1], {...clamp, easing: ease});
  const word = 'SchoolWork';
  const letterIn = (i: number) => 16 + i * 1.2;
  const tag = interpolate(f, [26, 38], [0, 1], {...clamp, easing: ease});
  const tagTrack = interpolate(f, [26, 38], [7, 3.6], clamp);
  const glow = (0.75 + 0.15 * Math.sin(f * 0.18)) * logoProgress;
  const exit = interpolate(f, [136, 149], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        color: C.text,
        fontFamily: 'Segoe UI, Arial, sans-serif',
        opacity: exit,
      }}
    >
      <style>{'*{box-sizing:border-box} body{margin:0}'}</style>
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at center, #25382266, transparent 62%)'}}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      <AbsoluteFill
        style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}
      >
        <Interactive.Div name="Atom logo" style={{position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              inset: -90,
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse, rgba(211,236,149,0.14) 0%, transparent 70%)',
              opacity: glow,
            }}
          />
          <div
            style={{
              transform: `scale(${0.92 + 0.08 * logoProgress})`,
              transformOrigin: 'center',
            }}
          >
            <Logo size={logoSize} progress={logoProgress} />
          </div>
        </Interactive.Div>
        <div style={{marginTop: 44, overflow: 'hidden'}}>
          <Interactive.Div
            name="SchoolWork wordmark"
            style={{
              fontSize: wordSize,
              lineHeight: 1,
              fontWeight: 680,
              letterSpacing: -4,
              whiteSpace: 'nowrap',
            }}
          >
            {word.split('').map((ch, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  color: i >= 6 ? C.lime : C.text,
                  opacity: interpolate(f, [letterIn(i), letterIn(i) + 8], [0, 1], {
                    ...clamp,
                    easing: ease,
                  }),
                  transform: `translateY(${interpolate(
                    f,
                    [letterIn(i), letterIn(i) + 8],
                    [24, 0],
                    {...clamp, easing: ease}
                  )}px)`,
                }}
              >
                {ch}
              </span>
            ))}
          </Interactive.Div>
        </div>
        <Interactive.Div
          name="Tagline"
          style={{
            marginTop: 26,
            fontSize: 22,
            letterSpacing: tagTrack,
            textTransform: 'uppercase',
            color: C.muted,
            opacity: tag,
          }}
        >
          Powering Education
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- Loading loop (2s seamless, square) ---------- */
const CYAN = '#A2ECFB';

const LOOP_ORBITS = [
  {a: 80, b: 30, rot: -28},
  {a: 80, b: 30, rot: 32},
  {a: 80, b: 30, rot: 92},
] as const;

const LOOP_STARS = [
  {orbit: 0, start: 205, dir: 1, size: 6},
  {orbit: 1, start: 25, dir: -1, size: 5},
  {orbit: 2, start: 130, dir: 1, size: 5.5},
] as const;

// Static orbit skeleton (like the app icon) stays visible underneath.
const BASE_OPACITY = 0.3;
// Fading comet trail behind each star: short segments stepping down in
// opacity and width so the tail dissolves into the orbit path.
const TRAIL_SEGS = 20;
const TRAIL_STEP = 0.03024; // fraction of the orbit covered by one segment
const trailOpacity = (k: number) => 0.8 * Math.pow(1 - k / TRAIL_SEGS, 1);
const trailWidth = (k: number) => 1.5 + 2.5 * (1 - k / TRAIL_SEGS);

// Same convention as the startup atom: angle 0 = rightmost point of the
// (rotated) ellipse, increasing angle travels the SVG ellipse path.
const loopPoint = (o: {a: number; b: number; rot: number}, angleDeg: number) => {
  const t = (angleDeg * Math.PI) / 180;
  const r = (o.rot * Math.PI) / 180;
  const x = o.a * Math.cos(t);
  const y = o.b * Math.sin(t);
  return {
    x: 100 + x * Math.cos(r) - y * Math.sin(r),
    y: 100 + x * Math.sin(r) + y * Math.cos(r),
  };
};

const LoadingLoop: React.FC = () => {
  const f = useCurrentFrame();
  const glow = 0.55 + 0.25 * Math.sin((Math.PI * 2 * f) / 60 - Math.PI / 2);
  const stars = LOOP_STARS.map((s) => {
    const o = LOOP_ORBITS[s.orbit];
    // One full revolution per 60-frame loop, so the loop is seamless.
    const angle = s.start + (s.dir * 360 * f) / 60;
    const t = (((angle % 360) + 360) % 360) / 360;
    return {...s, ...loopPoint(o, angle), t};
  });
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, fontFamily: 'Segoe UI, Arial, sans-serif'}}>
      <style>{'*{box-sizing:border-box} body{margin:0}'}</style>
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at center, #25382255, transparent 60%)'}}
      />
      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
        <Interactive.Div
          name="Atom spinner"
          style={{
            position: 'relative'
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: -120,
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse, rgba(162,236,251,0.10) 0%, transparent 70%)',
              opacity: glow,
            }}
          />
          <svg viewBox="0 0 200 200" width={470} height={470}>
            {/* Stationary disc */}
            <circle cx="100" cy="100" r="100" fill="#2F3242" />

            {/* Static orbit paths, like the app icon */}
            {LOOP_ORBITS.map((o, i) => (
              <ellipse
                key={i}
                cx="100"
                cy="100"
                rx={o.a}
                ry={o.b}
                transform={`rotate(${o.rot} 100 100)`}
                fill="none"
                stroke={CYAN}
                strokeWidth={2.5}
                opacity={BASE_OPACITY}
              />
            ))}

            {/* Stars travelling their trajectories with a fading comet trail */}
            {stars.map((s, i) => {
              const o = LOOP_ORBITS[s.orbit];
              return (
                <g key={i}>
                  {Array.from({length: TRAIL_SEGS}, (_, k) => {
                    // Segment k sits k steps behind the star along its motion.
                    const p0 =
                      s.dir > 0 ? s.t - (k + 1) * TRAIL_STEP : s.t + k * TRAIL_STEP;
                    return (
                      <ellipse
                        key={k}
                        cx="100"
                        cy="100"
                        rx={o.a}
                        ry={o.b}
                        transform={`rotate(${o.rot} 100 100)`}
                        pathLength={1}
                        fill="none"
                        stroke={CYAN}
                        strokeWidth={trailWidth(k)}
                        strokeLinecap="round"
                        strokeDasharray={`${TRAIL_STEP} ${1 - TRAIL_STEP}`}
                        strokeDashoffset={-p0}
                        opacity={trailOpacity(k)}
                      />
                    );
                  })}
                  <circle cx={s.x} cy={s.y} r={s.size * 1.9} fill={CYAN} opacity={0.22} />
                  <circle cx={s.x} cy={s.y} r={s.size * 0.95} fill={CYAN} />
                </g>
              );
            })}

            {/* Stationary nucleus */}
            <circle cx="100" cy="100" r="15" fill={CYAN} opacity={0.22} />
            <circle cx="100" cy="100" r="8" fill={CYAN} />
          </svg>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- Lesson → action loop (6s, portrait) ---------- */
const LINES = [
  {w: 700, type: [12, 22]},
  {w: 620, type: [32, 42]},
  {w: 470, type: [52, 62]},
] as const;

const LessonToAction: React.FC = () => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 8], [0, 1], {...clamp, easing: ease});
  const fadeOut = interpolate(f, [166, 179], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
  const loopFade = Math.min(fadeIn, fadeOut);
  const pillIn = interpolate(f, [74, 82], [0, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  const pillPulse = 1 + 0.012 * Math.sin(f * 0.25);
  return (
    <AbsoluteFill
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: 'Segoe UI, Arial, sans-serif',
        overflow: 'hidden',
        opacity: loopFade,
      }}
    >
      <style>{'*{box-sizing:border-box} body{margin:0}'}</style>
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at 72% 68%, #25382288, transparent 63%)'}}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 105,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 30,
          fontWeight: 600,
        }}
      >
        <Logo size={46} />SchoolWork
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 255,
          color: C.muted,
          fontSize: 22,
          letterSpacing: 4,
        }}
      >
        SCHOOLWORK
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 300,
          fontSize: 88,
          letterSpacing: -3.4,
          lineHeight: 1.08,
          fontWeight: 600,
          whiteSpace: 'pre-line',
        }}
      >
        One lesson in.
        <br />
        <span style={{color: C.lime}}>Three tasks out.</span>
      </div>
      <div style={{position: 'absolute', left: 90, top: 690}}>
        <Window title="Lesson studio">
          <div style={{fontSize: 24, color: C.muted, letterSpacing: 2, marginBottom: 34}}>
            ENGLISH / LESSON STUDIO
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 30}}>
            {LINES.map((line, i) => {
              const t = interpolate(f, [...line.type], [0, 1], {...clamp, easing: ease});
              const c0 = line.type[1] + 4;
              const pop = interpolate(
                f,
                [c0, c0 + 5],
                [0, 1],
                {...clamp, easing: Easing.out(Easing.back(2.4))}
              );
              const done = pop > 0.5;
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 22}}>
                  <div
                    style={{
                      width: line.w,
                      height: 40,
                      borderRadius: 20,
                      background: done ? '#33402f' : '#242d27',
                      transform: `scaleX(${t})`,
                      transformOrigin: 'left center',
                      opacity: 0.4 + 0.6 * t,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 20,
                        background: `linear-gradient(90deg, transparent ${t * 92}%, ${C.lime}22 ${
                          t * 92
                        }%)`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      background: C.lime,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `scale(${pop})`,
                      color: '#1c2a16',
                      opacity: pop > 0 ? 1 : 0,
                    }}
                  >
                    <Tick size={30} />
                  </div>
                </div>
              );
            })}
          </div>
          <Interactive.Div
            name="Tasks added pill"
            style={{
              marginTop: 46,
              display: 'flex',
              justifyContent: 'center',
              transform: `scale(${pillIn > 0 ? pillIn * pillPulse : 0})`,
              opacity: Math.min(1, pillIn * 2),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: C.lime,
                color: '#192518',
                fontSize: 30,
                fontWeight: 650,
                padding: '20px 38px',
                borderRadius: 16,
                boxShadow: '0 18px 44px #0006',
              }}
            >
              <Tick size={28} />3 tasks added
            </div>
          </Interactive.Div>
        </Window>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 165,
          color: C.muted,
          fontSize: 22,
          letterSpacing: 2,
        }}
      >
        LESSON → ACTION
      </div>
    </AbsoluteFill>
  );
};

export function Bumpers() {
  return (
    <Folder name="Bumpers">
      <Composition
        id="SchoolWorkStingerLandscape"
        component={Stinger}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
      />
      <Composition
        id="SchoolWorkStingerPortrait"
        component={Stinger}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={150}
      />
      <Composition
        id="SchoolWorkLoop"
        component={LoadingLoop}
        width={1080}
        height={1080}
        fps={30}
        durationInFrames={60}
      />
      <Composition
        id="LessonToAction"
        component={LessonToAction}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={180}
      />
    </Folder>
  );
}
