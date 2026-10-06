import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DesktopTools,
  desktopInputs,
  desktopToolSchemas,
} from "./desktopTools";
import { DesktopBridge } from "./desktopBridge";
import { capabilitiesSchema, type DesktopWindow } from "../src/capabilities";

vi.mock("electron", () => ({
  nativeImage: {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 2000, height: 1000 }),
      resize: () => ({
        getSize: () => ({ width: 1600, height: 800 }),
        toJPEG: () => Buffer.from("pixels"),
      }),
    }),
  },
}));
afterEach(() => vi.restoreAllMocks());
const window: DesktopWindow = {
  windowId: "123",
  pid: 42,
  appId: "C:\\Selected.exe",
  title: "Fixture",
  left: -200,
  top: 80,
  width: 2000,
  height: 1000,
  focused: true,
  minimized: false,
};
function setup() {
  const request = vi.fn(async (action: string) =>
    action === "list_windows"
      ? [window, { ...window, windowId: "456", appId: "C:\\Other.exe" }]
      : action === "capture_screen"
        ? { window, image: Buffer.from("pixels").toString("base64") }
        : { sent: true },
  );
  const stop = vi.fn();
  const tools = new DesktopTools({ request, stop } as unknown as DesktopBridge);
  const ctx = {
    owner: "task",
    capabilities: capabilitiesSchema.parse({
      allApps: false,
      allowedApps: [window.appId],
    }),
    signal: new AbortController().signal,
  };
  return { tools, ctx, request, stop };
}
describe("desktop action boundaries", () => {
  it('observes an unfocused window but issues no reusable input token',async () => {
    const {tools,ctx,request}=setup();
    request.mockImplementation(async action => action==='list_windows'?[window]:{window:{...window,focused:false},image:Buffer.from('pixels').toString('base64')} as any);
    const capture=await tools.execute('capture_screen',{windowId:'123'},ctx);
    expect(capture.ok).toBe(true);expect(capture.data.inputReady).toBe(false);
    expect(capture.data.frameDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(capture.summary).toContain('may be covered');
    await expect(tools.execute('click',{screenshotId:capture.data.screenshotId,x:1,y:1},ctx)).rejects.toThrow('expired');
  });
  it("allows every accessible app in all-app mode and honors live revocation", async () => {
    const { tools, ctx } = setup();
    const all = {
      ...ctx,
      capabilities: { ...ctx.capabilities, allApps: true },
    };
    expect((await tools.execute("list_windows", {}, all)).data).toHaveLength(2);
    await expect(
      tools.execute("focus_window", { windowId: "456" }, all),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      tools.execute("focus_window", { windowId: "456" }, ctx),
    ).rejects.toThrow("not selected");
  });
  it("passes exact monitor identity to capture/movement and rejects mixed targets", async () => {
    const { tools, ctx, request } = setup();
    await tools.execute("capture_screen", { displayId: "DISPLAY2" }, ctx);
    expect(request).toHaveBeenCalledWith(
      "capture_screen",
      { displayId: "DISPLAY2" },
      ctx.signal,
    );
    await tools.execute(
      "move_window",
      { windowId: "123", displayId: "DISPLAY2" },
      ctx,
    );
    expect(request).toHaveBeenLastCalledWith(
      "move_window",
      expect.objectContaining({ windowId: "123", displayId: "DISPLAY2" }),
      ctx.signal,
    );
    expect(() =>
      desktopInputs.capture_screen.parse({
        windowId: "123",
        displayId: "DISPLAY2",
      }),
    ).toThrow("not both");
  });
  it("registers validated schemas and filters application windows", async () => {
    expect(desktopToolSchemas.map((t) => t.function.name)).toEqual(
      Object.keys(desktopInputs),
    );
    expect(() =>
      desktopInputs.click.parse({ screenshotId: "not-an-id", x: 0, y: 0 }),
    ).toThrow();
    const { tools, ctx } = setup();
    expect((await tools.execute("list_windows", {}, ctx)).data).toEqual([
      window,
    ]);
    await expect(
      tools.execute("focus_window", { windowId: "456" }, ctx),
    ).rejects.toThrow("not selected");
    await expect(
      tools.execute("launch_app", { appId: "C:\\Other.exe" }, ctx),
    ).rejects.toThrow("not selected");
  });
  it("maps resized image coordinates into physical pixels and consumes the observation", async () => {
    const { tools, ctx, request } = setup();
    const image = await tools.execute(
      "capture_screen",
      { windowId: "123" },
      ctx,
    );
    const args = { screenshotId: image.data.screenshotId, x: 800, y: 400 };
    await tools.execute("click", args, ctx);
    expect(request).toHaveBeenLastCalledWith(
      "click",
      expect.objectContaining({ x: 800, y: 580, windowId: "123", pid: 42 }),
      ctx.signal,
    );
    await expect(tools.execute("click", args, ctx)).rejects.toThrow("expired");
  });
  it("rejects stale, wrong-owner and out-of-bounds observations", async () => {
    const { tools, ctx } = setup();
    const image = await tools.execute(
      "capture_screen",
      { windowId: "123" },
      ctx,
    );
    await expect(
      tools.execute(
        "click",
        { screenshotId: image.data.screenshotId, x: 0, y: 0 },
        { ...ctx, owner: "other" },
      ),
    ).rejects.toThrow("another task");
    const outside = await tools.execute(
      "capture_screen",
      { windowId: "123" },
      ctx,
    );
    await expect(
      tools.execute(
        "click",
        { screenshotId: outside.data.screenshotId, x: 1600, y: 0 },
        ctx,
      ),
    ).rejects.toThrow("outside");
    const stale = await tools.execute(
      "capture_screen",
      { windowId: "123" },
      ctx,
    );
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 181000);
    await expect(
      tools.execute(
        "type_text",
        { screenshotId: stale.data.screenshotId, text: "test" },
        ctx,
      ),
    ).rejects.toThrow("expired");
  });
  it("enforces revocation, abort and stop without closing user applications", async () => {
    const { tools, ctx, stop } = setup();
    const image = await tools.execute(
      "capture_screen",
      { windowId: "123" },
      ctx,
    );
    await expect(
      tools.execute(
        "type_text",
        { screenshotId: image.data.screenshotId, text: "test" },
        { ...ctx, capabilities: { ...ctx.capabilities, controlScreen: false } },
      ),
    ).rejects.toThrow("disabled");
    tools.stop();
    expect(stop).toHaveBeenCalledOnce();
    await expect(
      tools.execute(
        "type_text",
        { screenshotId: image.data.screenshotId, text: "test" },
        ctx,
      ),
    ).rejects.toThrow("expired");
    await expect(
      tools.execute(
        "list_windows",
        {},
        { ...ctx, signal: AbortSignal.abort() },
      ),
    ).rejects.toThrow();
  });
});
