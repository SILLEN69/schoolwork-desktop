import { Interactive, useCurrentFrame } from "remotion";
import { C, Stage, Type, Logo, tween, linear } from "./Design";

export function Hook() {
  const f = useCurrentFrame();
  return (
    <Stage>
      {/* This mark stays in the same position across the cut into Reveal. */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 78,
          display: "flex",
          alignItems: "center",
          gap: 25,
          opacity: linear(f, 0, 10, 0, 1),
        }}
      >
        <Logo size={86} progress={tween(f, 0, 23, 0, 1)} />
        <div
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: -0.7,
            opacity: linear(f, 62, 76, 1, 0),
          }}
        >
          SchoolWork
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 276,
          right: 140,
          translate: `0px ${tween(f, 62, 77, 0, -48)}px`,
          opacity: linear(f, 63, 77, 1, 0),
        }}
      >
        <Type size={159}>
          <Interactive.Span
            name="Hook title 1"
            style={{ fontSize: 159, color: "#edf0e8" }}
          >
            LESS BUSYWORK.
          </Interactive.Span>
        </Type>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 37,
            marginTop: 8,
          }}
        >
          <Type size={181} delay={15}>
            <Interactive.Span
              name="Hook title 2"
              style={{ fontSize: 181, color: "#edf0e8" }}
            >
              MORE
            </Interactive.Span>
          </Type>
          <Type size={181} delay={23} color={C.lime}>
            <Interactive.Span
              name="Hook title 3"
              style={{ fontSize: 181, color: "#d3ec95" }}
            >
              DONE.
            </Interactive.Span>
          </Type>
        </div>
        <div
          style={{
            marginTop: 34,
            width: tween(f, 33, 55, 0, 175),
            height: 3,
            background: C.lime,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            fontSize: 32,
            color: C.muted,
            marginTop: 27,
            translate: `0px ${tween(f, 35, 49, 12, 0)}px`,
            opacity: tween(f, 35, 49, 0, 1),
          }}
        >
          Meet your next way to work.
        </div>
      </div>
    </Stage>
  );
}
