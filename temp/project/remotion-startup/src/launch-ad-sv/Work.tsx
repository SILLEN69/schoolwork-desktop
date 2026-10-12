import { Interactive, useCurrentFrame } from "remotion";
import { C, Stage, Type, Chrome, Tick, Pointer, tween, linear } from "./Design";
export function Work() {
  const f = useCurrentFrame(),
    preview = f >= 109;
  return (
    <Stage>
      <div style={{ position: "absolute", left: 120, top: 60 }}>
        <Type size={111} delay={f < 37 ? 0 : f < 71 ? 37 : f < 109 ? 71 : 109}>
          {f < 37 ? (
            <Interactive.Span
              key="Arbetsläge – läser"
              name="Arbetsläge – läser"
              style={{ fontSize: 111, color: "#edf0e8" }}
            >
              LÄSER.
            </Interactive.Span>
          ) : f < 71 ? (
            <Interactive.Span
              key="Arbetsläge – bygger"
              name="Arbetsläge – bygger"
              style={{ fontSize: 111, color: "#edf0e8" }}
            >
              BYGGER.
            </Interactive.Span>
          ) : f < 109 ? (
            <Interactive.Span
              key="Arbetsläge – testar"
              name="Arbetsläge – testar"
              style={{ fontSize: 111, color: "#edf0e8" }}
            >
              TESTAR.
            </Interactive.Span>
          ) : (
            <Interactive.Span
              key="Arbetsläge – klar"
              name="Arbetsläge – klar"
              style={{ fontSize: 111, color: "#edf0e8" }}
            >
              KLAR ATT ANVÄNDA.
            </Interactive.Span>
          )}
        </Type>
      </div>
      <div
        style={{
          position: "absolute",
          left: 95,
          top: 240,
          transform: `translateY(${tween(f, 0, 17, 70, 0)}px) scale(${tween(f, 152, 217, 1, 1.02)})`,
          opacity: linear(f, 0, 8, 0, 1),
        }}
      >
        <Chrome title="SchoolWork · Arbetsläge" width={1730} height={746}>
          {!preview ? (
            <>
              <div
                style={{
                  position: "absolute",
                  left: 35,
                  top: 32,
                  width: 355,
                  borderRight: `1px solid ${C.line}`,
                  height: 610,
                  paddingRight: 26,
                }}
              >
                <div style={{ fontSize: 24, color: C.muted, marginBottom: 30 }}>
                  PROJEKTFILER
                </div>
                {["index.html", "styles.css", "script.js"].map((t, i) => (
                  <div
                    key={t}
                    style={{
                      padding: "22px 17px",
                      fontSize: 27,
                      borderRadius: 12,
                      background: f > 38 + i * 12 ? "#2b3925" : "transparent",
                      marginBottom: 10,
                      opacity: tween(f, 5 + i * 7, 17 + i * 7, 0, 1),
                    }}
                  >
                    <span style={{ color: C.lime, marginRight: 14 }}>◇</span>
                    {t}
                    <span style={{ float: "right", color: C.lime }}>
                      {f > 50 + i * 12 ? "✓" : ""}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{ position: "absolute", left: 440, top: 36, width: 715 }}
              >
                <div
                  style={{
                    background: "#2c352f",
                    padding: 25,
                    borderRadius: 18,
                    fontSize: 29,
                  }}
                >
                  Bygg en repetitionssida från den här lektionen.
                </div>
                <div
                  style={{
                    marginTop: 35,
                    fontSize: 27,
                    lineHeight: 1.6,
                    color: C.muted,
                    opacity: tween(f, 12, 24, 0, 1),
                  }}
                >
                  Jag gör en repetitionssida av lektionen,
                  <br />
                  och testar frågorna och layouten.
                </div>
                <div
                  style={{
                    marginTop: 30,
                    padding: 24,
                    borderRadius: 15,
                    background: "#101612",
                    fontFamily: "Consolas, monospace",
                    fontSize: 24,
                    lineHeight: 1.6,
                    opacity: tween(f, 38, 48, 0, 1),
                  }}
                >
                  <span style={{ color: "#7dac80" }}>
                    &lt;section class="repetition"&gt;
                  </span>
                  <br /> &lt;h1&gt;Argumenterande text&lt;/h1&gt;
                  <br /> &lt;div class="argument"&gt;
                  <br /> Ethos · Pathos · Logos
                  <br /> &lt;/div&gt;
                </div>
              </div>
              <div
                style={{ position: "absolute", left: 1210, right: 35, top: 34 }}
              >
                <div style={{ fontSize: 23, color: C.muted, marginBottom: 28 }}>
                  AKTIVITET
                </div>
                {[
                  "Läser lektionsanteckningar",
                  "Redigerar tre projektfiler",
                  "Kör npm test",
                  "Testar quizets funktion",
                ].map((t, i) => (
                  <div
                    key={t}
                    style={{
                      margin: "23px 0",
                      fontSize: 25,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      opacity: tween(f, 18 + i * 22, 28 + i * 22, 0, 1),
                    }}
                  >
                    <span style={{ color: C.lime }}>
                      <Tick size={25} />
                    </span>
                    {t}
                  </div>
                ))}
                <div
                  style={{
                    fontFamily: "Consolas, monospace",
                    fontSize: 23,
                    padding: 22,
                    background: "#101612",
                    borderRadius: 12,
                    lineHeight: 1.8,
                    opacity: tween(f, 81, 92, 0, 1),
                  }}
                >
                  › npm test
                  <br />
                  <span style={{ color: C.lime }}>3 tester godkända ✓</span>
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 24,
                borderRadius: 16,
                background: "#eaf0df",
                color: "#213320",
                padding: "34px 55px",
                transform: `scale(${tween(f, 109, 127, 0.92, 1)})`,
                opacity: linear(f, 109, 120, 0, 1),
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 24,
                  color: "#5a714d",
                }}
              >
                <span>REPETITIONSSTUDIO</span>
                <span>Engelska · Din lektion</span>
              </div>
              <div
                style={{
                  fontSize: 61,
                  fontWeight: 650,
                  marginTop: 25,
                  letterSpacing: -2,
                }}
              >
                Gör dina argument starkare.
              </div>
              <div style={{ display: "flex", gap: 21, marginTop: 29 }}>
                {[
                  ["Ethos", "Bygg förtroende."],
                  ["Pathos", "Väck känslor."],
                  ["Logos", "Visa beläggen."],
                ].map(([a, b]) => (
                  <div
                    key={a}
                    style={{
                      flex: 1,
                      padding: 25,
                      background: "#f8faef",
                      borderRadius: 17,
                      border: "1px solid #d1dbc3",
                    }}
                  >
                    <div style={{ fontSize: 36, fontWeight: 650 }}>{a}</div>
                    <div
                      style={{ fontSize: 25, color: "#667b58", marginTop: 7 }}
                    >
                      {b}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 29,
                  padding: 24,
                  borderRadius: 17,
                  background: "#dbe6c8",
                }}
              >
                <div style={{ fontSize: 29, fontWeight: 600 }}>
                  Snabbfråga: vilket verktyg använder belägg?
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
                  {["Ethos", "Pathos", "Logos"].map((a) => (
                    <div
                      key={a}
                      style={{
                        padding: "15px 36px",
                        fontSize: 27,
                        borderRadius: 12,
                        background:
                          f >= 159 && a === "Logos" ? "#597d3a" : "#f8faef",
                        color: f >= 159 && a === "Logos" ? "white" : "#24361f",
                      }}
                    >
                      {a}
                    </div>
                  ))}
                  {f >= 165 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 25,
                        color: "#43612e",
                      }}
                    >
                      <Tick />
                      Rätt!
                    </div>
                  )}
                </div>
              </div>
              <Pointer
                points={[
                  { frame: 109, x: 1360, y: 450 },
                  { frame: 145, x: 480, y: 470 },
                  { frame: 217, x: 480, y: 470 },
                ]}
                clicks={[159]}
              />
            </div>
          )}
        </Chrome>
      </div>
    </Stage>
  );
}
