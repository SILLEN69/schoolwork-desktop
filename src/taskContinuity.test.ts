import { describe, it, expect } from "vitest";
import {
  actionSummary,
  isStatusQuestion,
  repairToolHistory,
} from "./taskContinuity";
describe("task continuity", () => {
  it("closes interrupted native tool turns without claiming execution", () => {
    const h = repairToolHistory([
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "a" }, { id: "b" }],
      },
      { role: "tool", tool_call_id: "a", content: "real result" },
      { role: "user", content: "what did you do?" },
    ]);
    expect(h[1].content).toBe("real result");
    expect(h[2].tool_call_id).toBe("b");
    expect(h[2].content).toContain("unknown");
    expect(h[3].role).toBe("user");
    expect(repairToolHistory(h)).toEqual(h);
  });
  it("converts orphan results into observations and preserves images", () => {
    const image = {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
      ],
    };
    const h = repairToolHistory([
      { role: "tool", content: "observation" },
      image,
    ]);
    expect(h[0].role).toBe("user");
    expect(h[1]).toEqual(image);
  });
  it("answers only status questions without arbitrary work", () => {
    expect(isStatusQuestion("what have you done?")).toBe(true);
    expect(isStatusQuestion("vad har du gjort?")).toBe(true);
    expect(isStatusQuestion("status")).toBe(true);
    expect(isStatusQuestion("status then delete a file")).toBe(false);
  });
  it("summarizes success failure and uncertainty separately", () => {
    expect(
      actionSummary([
        { name: "click", status: "succeeded" },
        { name: "click", status: "failed" },
        { name: "click", status: "running" },
      ]),
    ).toBe("click: 1 succeeded, 1 failed, 1 unknown outcome");
  });
});
