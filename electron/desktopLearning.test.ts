import { describe, it, expect } from "vitest";
import { DesktopLearning } from "./desktopLearning";
function setup() {
  const map = new Map<string, string>();
  return new DesktopLearning({
    getMetadata: (k) => map.get(k),
    setMetadata: (k, v) => {
      map.set(k, v);
    },
  });
}
const observed = { ok: true, data: { window: { appId: "C:/App.exe" } } };
describe("desktop recovery memory", () => {
  it("requires same-app successful primitive plus subsequent observation", () => {
    const l = setup();
    l.observe("t", "list_displays", {
      ok: true,
      data: [{ left: -1920, width: 1920 }],
    });
    l.observe("t", "capture_screen", observed);
    l.observe("t", "click", {
      ok: false,
      summary: "focus lost secret typed text",
    });
    expect(l.list()).toEqual([]);
    l.observe("t", "focus_window", observed);
    l.observe("t", "capture_screen", observed);
    expect(l.list()).toEqual([]);
    l.observe("t", "click", observed);
    expect(l.list()).toEqual([]);
    l.observe("t", "inspect_window", observed);
    expect(l.list()).toHaveLength(1);
    expect(l.list()[0].environment).toContain("-1920");
    expect(JSON.stringify(l.list())).not.toContain("secret typed text");
    expect(l.list()[0].recovery).toContain("focus_window");
    l.forget();
    expect(l.list()).toEqual([]);
  });
  it("does not transfer a recovery between apps or task owners", () => {
    const l = setup();
    l.observe("a", "capture_screen", observed);
    l.observe("a", "click", { ok: false, summary: "stale" });
    l.observe("b", "click", observed);
    l.observe("b", "capture_screen", observed);
    l.observe("a", "click", {
      ok: true,
      data: { window: { appId: "C:/Different.exe" } },
    });
    l.observe("a", "capture_screen", observed);
    expect(l.list()).toEqual([]);
  });
});
