import { Interactive, useCurrentFrame } from "remotion";
import { C, Stage, Type, Action, Pointer, Tick, tween, linear } from "./Design";
export function Calendar() {
  const f = useCurrentFrame(),
    review = f >= 30,
    saved = f >= 80;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 120, top: 100 }}>
        <Type size={116} delay={saved ? 80 : 0}>
          {saved ? (
            <Interactive.Span
              key="Kalender – klart"
              name="Kalender – klart"
              style={{ fontSize: 116, color: "#edf0e8" }}
            >
              FIXAT.
            </Interactive.Span>
          ) : (
            <Interactive.Span
              key="Kalender – uppgift"
              name="Kalender – uppgift"
              style={{ fontSize: 116, color: "#edf0e8" }}
            >
              INLÄMNING?
            </Interactive.Span>
          )}
        </Type>
      </div>
      <div
        style={{
          position: "absolute",
          left: 490,
          top: 270,
          width: 1010,
          height: 625,
          borderRadius: 26,
          background: review ? "#f6f8fc" : C.panel,
          color: review ? "#243041" : C.text,
          padding: 48,
          boxShadow: "0 35px 100px #0006",
          transform: `translateY(${tween(f, 0, 17, 80, 0)}px) scale(${tween(f, 29, 48, 0.95, 1)})`,
          opacity: linear(f, 0, 8, 0, 1),
        }}
      >
        {!saved ? (
          <>
            <div
              style={{
                fontSize: 23,
                letterSpacing: 2,
                color: review ? "#5575a0" : C.lime,
              }}
            >
              {review
                ? "GOOGLE KALENDER · GRANSKA HÄNDELSE"
                : "FRÅN DIN LEKTION"}
            </div>
            <div style={{ fontSize: 48, fontWeight: 600, marginTop: 30 }}>
              Argumenterande text
            </div>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.5,
                marginTop: 21,
                color: review ? "#56667b" : C.muted,
              }}
            >
              Skriv 300 ord med ethos, pathos och logos.
            </div>
            <div style={{ display: "flex", gap: 28, marginTop: 44 }}>
              <div
                style={{
                  fontSize: 29,
                  padding: 22,
                  borderRadius: 15,
                  background: review ? "#e7eef8" : "#293225",
                }}
              >
                Fredag 16 oktober
              </div>
              <div
                style={{
                  fontSize: 29,
                  padding: 22,
                  borderRadius: 15,
                  background: review ? "#e7eef8" : "#293225",
                }}
              >
                16:00 – 16:30
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 48,
                bottom: 48,
                transform: `scale(${f >= 73 && f < 79 ? 0.96 : 1})`,
              }}
            >
              <Action width={300} blue={review}>
                {review ? "Bekräfta händelse" : "Lägg till i kalendern"}
              </Action>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                color: "#34724a",
                fontSize: 30,
              }}
            >
              <Tick />
              Händelsen har lagts till i Google Kalender
            </div>
            <div style={{ fontSize: 42, marginTop: 26 }}>Oktober 2026</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 10,
                marginTop: 30,
              }}
            >
              {["MÅN 12", "TIS 13", "ONS 14", "TOR 15", "FRE 16"].map(
                (d, i) => (
                  <div
                    key={d}
                    style={{
                      height: 285,
                      borderRadius: 12,
                      background: i === 4 ? "#edf3e7" : "#edf1f7",
                      padding: 14,
                      fontSize: 20,
                    }}
                  >
                    <div style={{ color: i === 4 ? "#447334" : "#657589" }}>
                      {d}
                    </div>
                    {i === 4 && (
                      <div
                        style={{
                          marginTop: 68,
                          background: "#cce6b5",
                          borderLeft: "5px solid #6b963d",
                          padding: 15,
                          borderRadius: 8,
                          fontSize: 22,
                          fontWeight: 600,
                        }}
                      >
                        16:00
                        <br />
                        Textuppgift
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          </>
        )}
        {!saved && (
          <Pointer
            points={[
              { frame: 0, x: 790, y: 410 },
              { frame: 18, x: 230, y: 555 },
              { frame: 30, x: 230, y: 555 },
              { frame: 53, x: 500, y: 390 },
              { frame: 65, x: 210, y: 555 },
              { frame: 116, x: 210, y: 555 },
            ]}
            clicks={[23, 73]}
          />
        )}
      </div>
    </Stage>
  );
}
