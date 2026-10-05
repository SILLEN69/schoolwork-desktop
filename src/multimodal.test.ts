import { describe, expect, it } from "vitest";
import {
  contextWeight,
  hasImageInput,
  imageMessage,
  withoutImageData,
} from "./multimodal";
import { capabilitiesSchema, effectiveCapabilities } from "./capabilities";

describe("image request lifecycle", () => {
  it('intersects all-app and selected access without expanding older selected tasks', () => {
    const all = capabilitiesSchema.parse({ allApps: true, allowedApps: ['B'] });
    const selected = capabilitiesSchema.parse({ allApps: false, allowedApps: ['A'] });
    expect(effectiveCapabilities(all, selected)).toMatchObject({ allApps: false, allowedApps: ['A'] });
    expect(effectiveCapabilities(selected, all)).toMatchObject({ allApps: false, allowedApps: ['A'] });
    expect(effectiveCapabilities(all, all).allApps).toBe(true);
  });
  it("builds multimodal input without an external image upload service", () => {
    const content = imageMessage("", ["data:image/png;base64,abc"]);
    expect(content).toEqual([
      { type: "text", text: "Describe the attached image." },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,abc", detail: "auto" },
      },
    ]);
    expect(hasImageInput([{ role: "user", content }])).toBe(true);
  });
  it("omits pixels from persistence and text budgets without mutating the provider request", () => {
    const original = {
      messages: [
        {
          content: imageMessage("Look", [
            "data:image/png;base64," + "x".repeat(100000),
          ]),
        },
      ],
      result: { imageData: "data:image/png;base64,abc", screenshotId: "id" },
    };
    const saved = withoutImageData(original);
    expect(JSON.stringify(saved)).not.toContain("data:image");
    expect(saved.result.screenshotId).toBe("id");
    expect(contextWeight(original)).toBeLessThan(1000);
    expect(JSON.stringify(original)).toContain("data:image");
  });
  it("revokes live capabilities without expanding an existing task", () => {
    const saved = capabilitiesSchema.parse({
      allApps: false,
      allowedApps: ["C:\\A.exe"],
      controlScreen: false,
    });
    const current = capabilitiesSchema.parse({
      allApps: false,
      allowedApps: ["C:\\A.exe", "C:\\B.exe"],
    });
    expect(effectiveCapabilities(saved, current)).toMatchObject({
      controlScreen: false,
      allowedApps: ["C:\\A.exe"],
    });
    expect(
      effectiveCapabilities(
        current,
        capabilitiesSchema.parse({ allApps: false, controlScreen: false, allowedApps: [] }),
      ),
    ).toMatchObject({ controlScreen: false, allowedApps: [] });
  });
});
