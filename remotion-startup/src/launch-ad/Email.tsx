import { Interactive, useCurrentFrame } from "remotion";
import {
  C,
  Stage,
  Type,
  Chrome,
  Action,
  Pointer,
  Tick,
  tween,
  linear,
} from "./Design";
export function Email() {
  const f = useCurrentFrame(),
    sent = f >= 112;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 120, top: 70 }}>
        <Type size={96}>
          <Interactive.Span
            name="Email title 1"
            style={{ fontSize: 96, color: "#edf0e8" }}
          >
            SCHOOLWORK ACTS.
          </Interactive.Span>
        </Type>
      </div>
      <div
        style={{
          position: "absolute",
          left: 340,
          top: 252,
          transform: `translateY(${tween(f, 0, 18, 110, 0)}px) scale(${tween(f, 21, 65, 0.96, 1.04)})`,
          transformOrigin: "center center",
          opacity: linear(f, 0, 8, 0, 1),
        }}
      >
        <Chrome light title="Gmail" width={1240} height={730}>
          <div style={{ padding: "30px 46px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 24,
                fontWeight: 650,
              }}
            >
              New message
              <span style={{ fontWeight: 400, color: "#6b788a" }}>
                Saved to Drafts
              </span>
            </div>
            <div
              style={{
                fontSize: 25,
                padding: "22px 0 18px",
                borderBottom: "1px solid #dae1eb",
              }}
            >
              To{" "}
              <span
                style={{
                  marginLeft: 30,
                  background: "#e7edf5",
                  padding: "6px 15px",
                  borderRadius: 20,
                }}
              >
                Me
              </span>
            </div>
            <div
              style={{
                fontSize: 28,
                padding: "19px 0",
                borderBottom: "1px solid #dae1eb",
              }}
            >
              English lesson summary
            </div>
            <div
              style={{
                fontSize: 27,
                lineHeight: 1.6,
                paddingTop: 25,
                opacity: tween(f, 12, 35, 0, 1),
              }}
            >
              Here’s what matters from today’s lesson:
              <br />
              <span style={{ fontWeight: 650 }}>Ethos</span> — build trust and
              credibility.
              <br />
              <span style={{ fontWeight: 650 }}>Pathos</span> — connect through
              emotion.
              <br />
              <span style={{ fontWeight: 650 }}>Logos</span> — use evidence and
              clear reasoning.
              <br />
              <div style={{ marginTop: 18 }}>
                Assignment: 300-word persuasive paragraph.
                <br />
                Due Friday 16 October.
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 46,
                bottom: 31,
                transform: `scale(${f >= 102 && f < 110 ? 0.96 : 1})`,
              }}
            >
              <Action width={180} blue>
                Send ↑
              </Action>
            </div>
            {sent && (
              <div
                style={{
                  position: "absolute",
                  left: 255,
                  bottom: 25,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "#213326",
                  color: "#ecf5e7",
                  fontSize: 27,
                  padding: "18px 28px",
                  borderRadius: 13,
                  opacity: linear(f, 112, 120, 0, 1),
                  transform: `translateY(${tween(f, 112, 125, 15, 0)}px)`,
                }}
              >
                <Tick />
                Message sent
              </div>
            )}
            <Pointer
              points={[
                { frame: 0, x: 950, y: 440 },
                { frame: 48, x: 950, y: 440 },
                { frame: 81, x: 130, y: 606 },
                { frame: 175, x: 130, y: 606 },
              ]}
              clicks={[102]}
              bubbleTop={-65}
              bubble={
                f >= 45 && f < 112
                  ? "I’ll send your lesson summary."
                  : undefined
              }
            />
          </div>
        </Chrome>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 27,
          right: 130,
          fontSize: 23,
          color: C.muted,
          opacity: tween(f, 125, 138, 0, 1),
        }}
      >
        From your lesson. To your inbox.
      </div>
    </Stage>
  );
}
