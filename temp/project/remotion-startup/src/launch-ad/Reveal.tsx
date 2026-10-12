import { Interactive, useCurrentFrame } from "remotion";
import {
  C,
  Stage,
  Type,
  Chrome,
  Sidebar,
  Pointer,
  Chip,
  tween,
  linear,
  Logo,
} from "./Design";
export function Reveal() {
  const f = useCurrentFrame();
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 78,
          display: "flex",
          gap: 28,
          alignItems: "center",
        }}
      >
        <Logo size={86} />
        <div style={{ opacity: linear(f, 0, 10, 0, 1) }}>
          <Type size={82}>
            <Interactive.Span
              name="Reveal title 1"
              style={{ fontSize: 82, color: "#edf0e8" }}
            >{"Meet SchoolWork!  "}</Interactive.Span>
          </Type>
          <div style={{ fontSize: 30, color: C.muted }}>
            Your AI work assistant.
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 280,
          top: 286,
          transform: `perspective(1800px) translateY(${tween(f, 0, 24, 90, 0)}px) rotateX(${tween(f, 0, 28, 7, 0)}deg) scale(${tween(f, 89, 116, 1, 1.055)})`,
          transformOrigin: "20% 60%",
          opacity: linear(f, 0, 10, 0, 1),
        }}
      >
        <Chrome>
          <Sidebar selected={f >= 87 ? "Follow a lesson" : "My workspace"} />
          <div style={{ position: "absolute", left: 340, top: 90, right: 65 }}>
            <div style={{ fontSize: 49, fontWeight: 600 }}>
              What would you like to get done?
            </div>
            <div style={{ color: C.muted, fontSize: 25, marginTop: 16 }}>
              One request. Real work.
            </div>
            <div
              style={{
                marginTop: 62,
                padding: 27,
                border: `1px solid ${C.line}`,
                borderRadius: 20,
                height: 170,
              }}
            >
              <div style={{ color: C.muted, fontSize: 26 }}>
                Describe the outcome you want…
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 32 }}>
                <Chip>Workspace</Chip>
                <Chip>Qwen3.8</Chip>
              </div>
            </div>
            <div style={{ display: "flex", gap: 17, marginTop: 25 }}>
              <Chip>Build something</Chip>
              <Chip>Research a topic</Chip>
              <Chip>Follow a lesson</Chip>
            </div>
          </div>
          <Pointer
            points={[
              { frame: 25, x: 970, y: 420 },
              { frame: 57, x: 970, y: 420 },
              { frame: 79, x: 133, y: 408 },
              { frame: 116, x: 133, y: 408 },
            ]}
            clicks={[87]}
          />
        </Chrome>
      </div>
    </Stage>
  );
}
