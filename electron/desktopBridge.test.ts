import { afterEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { DesktopBridge } from "./desktopBridge";

vi.mock("node:child_process", async () => {
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  return {
    spawn: vi.fn(() => {
      const child = Object.assign(new EventEmitter(), {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: vi.fn(),
      });
      child.kill.mockImplementation(() => {
        child.emit("exit", 0);
        return true;
      });
      child.stdin.on("data", (buffer) => {
        const request = JSON.parse(buffer.toString());
        if (request.action === "hold") return;
        child.stdout.write(
          request.action === "malformed"
            ? "bad json\n"
            : JSON.stringify({
                id: request.id,
                ok: request.action !== "fail",
                data: { ready: true },
                error: "Window lost focus.",
              }) + "\n",
        );
      });
      return child;
    }),
  };
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
describe.runIf(process.platform === "win32")(
  "private desktop helper lifecycle",
  () => {
    it("serializes actions and surfaces native failures without repeating them", async () => {
      const bridge = new DesktopBridge("fixture.exe");
      expect(await bridge.request("ready")).toEqual({ ready: true });
      await expect(bridge.request("fail")).rejects.toThrow("lost focus");
      expect(vi.mocked(spawn)).toHaveBeenCalledOnce();
      bridge.stop();
      expect(
        vi.mocked(spawn).mock.results[0].value.kill,
      ).toHaveBeenCalledOnce();
    });
    it("cancels both active and queued work and allows a fresh helper later", async () => {
      const bridge = new DesktopBridge("fixture.exe"),
        controller = new AbortController();
      const active = bridge.request("hold", {}, controller.signal),
        queued = bridge.request("ready");
      const activeCheck = expect(active).rejects.toThrow("cancelled"),
        queueCheck = expect(queued).rejects.toThrow("cancelled");
      await new Promise((resolve) => setImmediate(resolve));
      controller.abort();
      await activeCheck;
      await queueCheck;
      expect(spawn).toHaveBeenCalledOnce();
      expect(await bridge.request("ready")).toEqual({ ready: true });
      expect(spawn).toHaveBeenCalledTimes(2);
      bridge.stop();
    });
    it("rejects malformed responses and timeouts with uncertain-outcome errors", async () => {
      const bridge = new DesktopBridge("fixture.exe");
      await expect(bridge.request("malformed")).rejects.toThrow(
        "invalid response",
      );
      vi.useFakeTimers();
      const pending = bridge.request("hold");
      const check = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(15001);
      await check;
      bridge.stop();
    });
  },
);
