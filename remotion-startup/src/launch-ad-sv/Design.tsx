import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, clamp, ease, Logo } from "../showcase/Shared";
export { C, Logo, Pointer, Tick } from "../showcase/Shared";
export const tween = (
  frame: number,
  start: number,
  end: number,
  from: number,
  to: number,
) => interpolate(frame, [start, end], [from, to], { ...clamp, easing: ease });
export const linear = (
  frame: number,
  start: number,
  end: number,
  from: number,
  to: number,
) => interpolate(frame, [start, end], [from, to], clamp);
export function Stage({ children }: { children: React.ReactNode }) {
  // Keep the scene shell outside Studio's text-content editing schema.
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: C.bg,
        color: C.text,
        fontFamily: "Segoe UI, Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <style>{"*{box-sizing:border-box}"}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 16% 10%, #647d9620, transparent 54%), radial-gradient(ellipse at 75% 90%, #46623725, transparent 63%)",
        }}
      />
      {children}
    </div>
  );
}
export function Type({
  children,
  delay = 0,
  size = 100,
  color = C.text,
}: {
  children: React.ReactNode;
  delay?: number;
  size?: number;
  color?: string;
}) {
  const f = useCurrentFrame();
  return (
    <div style={{ overflow: "hidden", paddingBottom: 12, paddingRight: 8 }}>
      <div
        style={{
          fontSize: size,
          color,
          fontWeight: 650,
          letterSpacing: -size * 0.043,
          lineHeight: 1.04,
          translate: `0px ${tween(f, delay, delay + 17, 110, 0)}%`,
          opacity: linear(f, delay, delay + 7, 0, 1),
        }}
      >
        {children}
      </div>
    </div>
  );
}
export function Chrome({
  children,
  title = "SchoolWork",
  light = false,
  width = 1360,
  height = 740,
}: {
  children: React.ReactNode;
  title?: string;
  light?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        background: light ? "#f5f7fb" : C.panel,
        color: light ? "#223042" : C.text,
        border: `1px solid ${light ? "#dce2eb" : C.line}`,
        borderRadius: 22,
        boxShadow: "0 40px 120px #0007",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 58,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${light ? "#dce2eb" : C.line}`,
          background: light ? "#e9eef5" : "#151b17",
          fontSize: 22,
        }}
      >
        {light ? (
          <span style={{ fontWeight: 750, color: "#4285f4" }}>
            {title === "Gmail" ? "M" : "31"}
          </span>
        ) : (
          <Logo size={29} />
        )}
        <span>{title}</span>
        <span
          style={{
            marginLeft: "auto",
            letterSpacing: 23,
            color: light ? "#637286" : C.muted,
          }}
        >
          — □ ×
        </span>
      </div>
      <div style={{ position: "relative", height: height - 58 }}>
        {children}
      </div>
    </div>
  );
}
export function Chip({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${active ? "#adc771" : C.line}`,
        borderRadius: 11,
        padding: "12px 18px",
        background: active ? "#303f25" : "#202723",
        color: active ? C.lime : C.muted,
        fontSize: 22,
      }}
    >
      {children}
    </div>
  );
}
export function Action({
  children,
  width = 260,
  blue = false,
}: {
  children: React.ReactNode;
  width?: number;
  blue?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height: 64,
        borderRadius: 12,
        background: blue ? "#a8c7fa" : C.lime,
        color: "#172416",
        fontWeight: 650,
        fontSize: 25,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}
export function Sidebar({ selected = "Min arbetsyta" }: { selected?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 268,
        padding: "32px 22px",
        borderRight: `1px solid ${C.line}`,
        background: "#151b17",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontWeight: 650,
          fontSize: 27,
          marginBottom: 32,
        }}
      >
        <Logo size={42} />
        SchoolWork
      </div>
      <Action width={222}>＋ Ny uppgift</Action>
      <div
        style={{
          fontSize: 17,
          letterSpacing: 2,
          color: C.muted,
          margin: "36px 10px 18px",
        }}
      >
        ARBETSYTA
      </div>
      {[
        "Min arbetsyta",
        "Senaste uppgifter",
        "Följ en lektion",
        "Minnesvalv",
      ].map((t) => (
        <div
          key={t}
          style={{
            fontSize: 22,
            padding: "17px 13px",
            marginBottom: 7,
            borderRadius: 12,
            background: selected === t ? "#2c3726" : "transparent",
            color: selected === t ? C.lime : C.muted,
          }}
        >
          {t}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          color: C.muted,
          fontSize: 19,
        }}
      >
        ⚙ Inställningar
      </div>
    </div>
  );
}
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 20,
        letterSpacing: 3,
        color: C.muted,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}
