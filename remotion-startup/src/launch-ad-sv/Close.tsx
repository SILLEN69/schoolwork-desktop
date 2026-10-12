import { Interactive, interpolate, useCurrentFrame } from "remotion";
import { Stage, Logo, Type, tween, linear } from "./Design";
export function Close() {
  const f = useCurrentFrame();
  const frame = useCurrentFrame();
  const accent =
    f < 88 ? 1 : tween(f, 88, 91, 1, 1.025) - tween(f, 91, 104, 0, 0.025);
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 500px 400px at 50% 29%, #779fbc20, transparent 75%)",
          opacity: tween(f, 0, 28, 0, 1),
        }}
      />
      {/* The atom assembles once, then rests; the final sound hit has a bounded halo. */}
      <div
        style={{
          position: "absolute",
          left: 740,
          top: 56,
          width: 440,
          height: 440,
          border: "1px solid #a2ecfb",
          borderRadius: "50%",
          scale: tween(f, 88, 106, 0.77, 1.12),
          opacity: f < 88 ? 0 : linear(f, 88, 107, 0.24, 0),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 790,
          top: 106,
          translate: `0px ${tween(f, 0, 23, 44, 0)}px`,
          rotate: `${tween(f, 0, 27, -9, 0)}deg`,
          scale: tween(f, 0, 25, 0.9, 1) * accent,
          opacity: linear(f, 0, 8, 0, 1),
          filter: "drop-shadow(0 12px 35px #0005)",
        }}
      >
        <Interactive.Div
          name="Slutscen – logga"
          style={{ width: 340, height: 340 }}
        >
          <Logo size={340} progress={tween(f, 0, 32, 0, 1)} />
        </Interactive.Div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 482,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <Type size={124} delay={8}>
          <Interactive.Span
            name="Slutscen – SchoolWork"
            style={{ fontSize: 124, color: "#edf0e8" }}
          >
            SchoolWork
          </Interactive.Span>
        </Type>
        <Interactive.Div
          name="Slutscen – slogan"
          style={{
            fontSize: 41,
            color: "#a0aea3",
            marginTop: 12,
            translate: interpolate(frame, [18, 32], ["0px 12px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            opacity: interpolate(frame, [18, 32], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Mindre krångel. Mer gjort.
        </Interactive.Div>
        <Interactive.Div
          name="Slutscen – krav"
          style={{
            fontSize: 23,
            color: "#a0aea3",
            marginTop: 25,
            opacity: interpolate(frame, [34, 46], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Windows · TeachGPT-åtkomst krävs
        </Interactive.Div>
      </div>
      {/* Global 33.05 s to 33.7 s; the final nine picture frames are fully black. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "black",
          opacity: linear(f, 87.5, 107, 0, 1),
        }}
      />
    </Stage>
  );
}
