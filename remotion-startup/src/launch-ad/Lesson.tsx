import { useCurrentFrame } from "remotion";
import {
  C,
  Stage,
  Type,
  Chrome,
  Action,
  Pointer,
  Label,
  tween,
  linear,
} from "./Design";
export function Lesson() {
  const f = useCurrentFrame(),
    notes = tween(f, 48, 75, 0, 1);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 130, top: 65 }}>
        <Type size={88} delay={f < 61 ? 3 : 61}>
          {f < 61 ? "BE IN THE LESSON." : "KEEP WHAT MATTERS."}
        </Type>
      </div>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 245,
          transform: `translateX(${tween(f, 42, 85, 0, -20)}px) scale(${tween(f, 42, 85, 1, 1.04)})`,
          transformOrigin: "right center",
        }}
      >
        <Chrome title="SchoolWork · Follow a lesson" width={1530} height={735}>
          <div style={{ position: "absolute", left: 52, top: 35, width: 635 }}>
            <Label>ENGLISH · PERSUASIVE WRITING</Label>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 20,
                alignItems: "center",
              }}
            >
              <Action width={260}>
                {f < 15 ? "● Start recording" : "● Recording"}
              </Action>
              <span style={{ fontSize: 24, color: C.muted }}>
                {f < 15 ? "Ready" : "00:18"}
              </span>
            </div>
            <div
              style={{
                height: 125,
                marginTop: 27,
                display: "flex",
                alignItems: "center",
                gap: 7,
                opacity: linear(f, 16, 24, 0, 1),
              }}
            >
              {Array.from({ length: 54 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    borderRadius: 5,
                    background: i % 3 === 0 ? C.lime : "#638c52",
                    height: 18 + Math.abs(Math.sin(f * 0.1 + i * 0.9)) * 70,
                  }}
                />
              ))}
            </div>
            <Label>LIVE TRANSCRIPT</Label>
            {[
              "Ethos builds credibility.",
              "Pathos appeals to emotion.",
              "Logos uses logic.",
            ].map((t, i) => (
              <div
                key={t}
                style={{
                  fontSize: 30,
                  lineHeight: 1.5,
                  marginTop: 14,
                  opacity: tween(f, 25 + i * 8, 34 + i * 8, 0, 1),
                  transform: `translateY(${tween(f, 25 + i * 8, 34 + i * 8, 15, 0)}px)`,
                }}
              >
                <span style={{ color: C.lime }}>{t.split(" ")[0]}</span>
                {t.slice(t.indexOf(" "))}
              </div>
            ))}
          </div>
          <div
            style={{
              position: "absolute",
              left: 760,
              top: 35,
              right: 48,
              padding: 32,
              border: `1px solid ${C.line}`,
              borderRadius: 18,
              background: "#202821",
              opacity: notes,
              transform: `translateX(${(1 - notes) * 100}px)`,
            }}
          >
            <div style={{ fontSize: 24, color: C.lime, marginBottom: 24 }}>
              Notes · saved as you go
            </div>
            <div style={{ fontSize: 38, fontWeight: 600, marginBottom: 22 }}>
              The three appeals
            </div>
            {[
              ["Ethos", "Credibility & trust"],
              ["Pathos", "Emotion & connection"],
              ["Logos", "Evidence & logic"],
            ].map(([a, b], i) => (
              <div
                key={a}
                style={{
                  padding: "18px 0",
                  borderTop: `1px solid ${C.line}`,
                  opacity: tween(f, 52 + i * 6, 62 + i * 6, 0, 1),
                }}
              >
                <div style={{ fontSize: 30, color: C.lime }}>{a}</div>
                <div style={{ fontSize: 25, color: C.muted, marginTop: 5 }}>
                  {b}
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: 20,
                padding: 18,
                background: "#34432a",
                borderRadius: 13,
                fontSize: 25,
                opacity: tween(f, 85, 99, 0, 1),
              }}
            >
              Assignment · 300-word persuasive paragraph
            </div>
          </div>
          <Pointer
            points={[
              { frame: 0, x: 275, y: 170 },
              { frame: 9, x: 196, y: 99 },
              { frame: 25, x: 196, y: 99 },
              { frame: 46, x: 410, y: 340 },
              { frame: 116, x: 410, y: 340 },
            ]}
            clicks={[15]}
          />
        </Chrome>
      </div>
    </Stage>
  );
}
