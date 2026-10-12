import { Interactive, useCurrentFrame } from "remotion";
import { C, Stage, Type, Pointer, Chip, tween, linear } from "./Design";
const prompt = "Summarise this English lesson and email it to me.";
export function Ask() {
  const f = useCurrentFrame(),
    chars = Math.floor(linear(f, 18, 63, 0, prompt.length));
  return (
    <Stage>
      <div style={{ position: "absolute", left: 135, top: 90 }}>
        <Type size={154}>
          <Interactive.Span
            name="Ask title 1"
            style={{ fontSize: 154, color: "#edf0e8" }}
          >
            YOU ASK.
          </Interactive.Span>
        </Type>
      </div>
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 300,
          width: 1500,
          transform: `translateY(${tween(f, 0, 17, 160, 0)}px)`,
        }}
      >
        <div
          style={{
            height: 240,
            padding: 32,
            overflow: "hidden",
            opacity: linear(f, 0, 16, 0.7, 1),
            color: C.muted,
            fontSize: 29,
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          <div style={{ fontSize: 22, color: C.lime, marginBottom: 15 }}>
            YOUR LESSON · ENGLISH
          </div>
          <div
            style={{
              height: 152,
              overflow: "hidden",
              position: "relative",
              maskImage:
                "linear-gradient(transparent,black 15%,black 85%,transparent)",
            }}
          >
            <div
              style={{ transform: `translateY(${tween(f, 4, 22, 0, -55)}px)` }}
            >
              Ethos builds credibility. Pathos connects through emotion.
              <br />
              <br />
              Logos makes an argument with evidence and clear reasoning.
              <br />
              <br />
              Assignment: persuasive paragraph · Friday 16 October.
            </div>
          </div>
        </div>
        <div
          style={{
            height: 272,
            border: `2px solid ${C.lime}`,
            borderRadius: 25,
            padding: 40,
            background: "#1d2420",
            marginTop: 30,
            boxShadow: "0 0 45px #8caf3120",
          }}
        >
          <div
            style={{
              fontSize: 43,
              minHeight: 100,
              lineHeight: 1.4,
              color: chars ? C.text : C.muted,
            }}
          >
            {chars ? prompt.slice(0, chars) : "What should SchoolWork do?"}
            {f >= 18 && f < 66 && <span style={{ color: C.lime }}>▏</span>}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
            <Chip>Lesson context</Chip>
            <Chip>Computer use</Chip>
            <div
              style={{
                marginLeft: "auto",
                width: 78,
                height: 68,
                borderRadius: 14,
                background: C.lime,
                color: "#203017",
                fontSize: 41,
                textAlign: "center",
                lineHeight: "68px",
                transform: `scale(${f >= 73 && f < 79 ? 0.93 : 1})`,
              }}
            >
              ↑
            </div>
          </div>
        </div>
        <Pointer
          points={[
            { frame: 0, x: 960, y: 380 },
            { frame: 49, x: 960, y: 380 },
            { frame: 67, x: 1416, y: 469 },
            { frame: 87, x: 1416, y: 469 },
          ]}
          clicks={[73]}
        />
      </div>
    </Stage>
  );
}
