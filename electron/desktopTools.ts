import { z } from "zod";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { nativeImage } from "electron";
import { DesktopBridge } from "./desktopBridge";
import {
  appAllowed,
  type Capabilities,
  type DesktopWindow,
} from "../src/capabilities";

const windowId = z.string().regex(/^\d+$/).max(24);
const snapshot = { screenshotId: z.string().uuid() };
const point = {
  x: z.number().int().min(0).max(16000),
  y: z.number().int().min(0).max(16000),
};
export const desktopInputs = {
  prepare_desktop: z.object({ windowId }),
  list_apps: z.object({}),
  launch_app: z.object({ appId: z.string().min(1).max(4096) }),
  list_windows: z.object({}),
  list_displays: z.object({}),
  move_window: z.object({ windowId, displayId: z.string().min(1).max(80) }),
  focus_window: z.object({ windowId }),
  inspect_window: z.object({ windowId }),
  capture_screen: z
    .object({
      windowId: windowId.optional(),
      displayId: z.string().min(1).max(80).optional(),
    })
    .refine(
      (a) => !(a.windowId && a.displayId),
      "Choose a window or a display, not both.",
    ),
  click: z.object({
    ...snapshot,
    ...point,
    button: z.enum(["left", "right"]).default("left"),
    count: z.number().int().min(1).max(2).default(1),
  }),
  type_text: z.object({ ...snapshot, text: z.string().min(1).max(4000) }),
  key_press: z.object({ ...snapshot, keys: z.string().min(1).max(100) }),
  scroll: z.object({
    ...snapshot,
    ...point,
    amount: z.number().int().min(-2400).max(2400),
  }),
};
const descriptions: Record<string, string> = {
  prepare_desktop: "Prepare a window for action in ONE call: resolve its active owned dialog (including file pickers), focus it once and capture fresh pixels. Prefer this before desktop input. Use the returned window identity and screenshotId. Each action on a prepared view returns the next screenshot automatically; do not capture again unnecessarily. If focus is refused, report the blocker rather than looping.",
  list_displays:
    "List every connected monitor with physical pixel bounds, including negative origins. Use exact displayId for capture or moving a window. Refresh after a monitor change.",
  move_window:
    "Move and fit a normal application window into a monitor's work area. Then focus, capture and inspect it again. Does not elevate permissions.",
  list_apps:
    "List running and configured applications. In all-app mode any accessible absolute .exe path can be launched; use project/shell tools to discover installed paths.",
  launch_app:
    "Launch a selected application. Returns a PID; then list_windows to find its window. Does not prove readiness.",
  list_windows:
    "List windows belonging to selected applications, with identity, physical pixel bounds and focus.",
  focus_window:
    "Focus a selected window; Windows may refuse. Capture or inspect it before input.",
  inspect_window:
    "Read bounded Windows UI Automation controls. Password fields are omitted. Does not provide pixels.",
  capture_screen:
    "Capture a monitor using displayId or a visible window using windowId. An unfocused window may be covered by other apps: its pixels are NOT verification of that app and cannot authorize input. For input focus then capture. Coordinates are image-relative, not global monitor pixels.",
  click:
    "Click image-relative x/y on a recent window screenshot; count=2 double-clicks. One-use screenshotId. Capture again after every action.",
  type_text:
    "Type Unicode into the focused selected window using a recent screenshotId. Never guess focus. Capture again after input.",
  key_press:
    "Send a shortcut such as Ctrl+A or Enter with a recent screenshotId. Supports Ctrl/Shift/Alt, letters, numbers, arrows and F1-F12.",
  scroll:
    "Scroll at image-relative x/y with a recent screenshotId. Positive amount scrolls up; negative down. Capture again after input.",
};
export const desktopToolSchemas = Object.entries(desktopInputs).map(
  ([name, schema]) => ({
    type: "function",
    function: {
      name,
      description: descriptions[name],
      parameters: z.toJSONSchema(schema),
    },
  }),
);
export function desktopToolAvailable(name: string, cap: Capabilities) {
  if (["list_apps", "list_windows"].includes(name))
    return cap.launchApps || cap.viewScreen || cap.controlScreen;
  if (name === "launch_app") return cap.launchApps;
  if (["capture_screen", "inspect_window", "list_displays"].includes(name))
    return cap.viewScreen;
  return cap.controlScreen && cap.viewScreen;
}
export async function defaultApplications(): Promise<string[]> {
  const candidates = [
    path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "notepad.exe",
    ),
    ...[
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]
      .filter(Boolean)
      .flatMap((root) => [
        path.join(root!, "Google/Chrome/Application/chrome.exe"),
        path.join(root!, "Microsoft/Edge/Application/msedge.exe"),
      ]),
  ];
  const found: string[] = [];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      found.push(candidate);
    } catch {}
  }
  return found;
}
type Observation = {
  owner: string;
  createdAt: number;
  window?: DesktopWindow;
  imageWidth: number;
  imageHeight: number;
  prepared: boolean;
  consumed?: boolean;
  superseded?: boolean;
  focusedControl?: {runtimeId?:string;name?:string;type?:string;protected?:boolean};
};
export class DesktopActionError extends Error {
  constructor(public code: string, message: string, public windowId?: string) { super(message); }
}
export function desktopFailure(error: unknown) {
  if(error instanceof DesktopActionError) return {code:error.code,windowId:error.windowId};
  const text=String(error);
  const code=/FOCUS_CHANGED/.test(text)?'FOCUS_CHANGED':/FOCUS_REQUIRED|lost focus|foreground focus/i.test(text)?'FOCUS_REQUIRED':/WINDOW_COVERED|covered by another/i.test(text)?'WINDOW_COVERED':/moved or resized|identity changed/i.test(text)?'WINDOW_CHANGED':undefined;
  return code?{code}:undefined;
}
export class DesktopTools {
  private observations = new Map<string, Observation>();
  constructor(readonly bridge: DesktopBridge) {}
  stop() {
    this.observations.clear();
    this.bridge.stop();
  }
  forgetOwner(owner: string) {
    for (const [id, observation] of this.observations)
      if (observation.owner === owner) this.observations.delete(id);
  }
  async windows(signal?: AbortSignal): Promise<DesktopWindow[]> {
    return this.bridge.request("list_windows", {}, signal);
  }
  async execute(
    name: keyof typeof desktopInputs,
    raw: unknown,
    ctx: { owner: string; capabilities: Capabilities; signal: AbortSignal },
  ): Promise<any> {
    const args: any = desktopInputs[name].parse(raw);
    const cap = ctx.capabilities;
    ctx.signal.throwIfAborted();
    if (!desktopToolAvailable(name, cap))
      throw new Error("This desktop capability is disabled in Settings.");
    if (name === "list_displays")
      return {
        ok: true,
        summary: "Connected monitors (physical pixels).",
        data: await this.bridge.request(name, {}, ctx.signal),
      };
    if (name === "list_apps")
      return {
        ok: true,
        summary: "Selected applications.",
        data: [
          ...new Set([
            ...cap.allowedApps,
            ...(cap.allApps
              ? (await this.windows(ctx.signal)).map((w) => w.appId)
              : []),
          ]),
        ].map((appId) => ({
          appId,
          name: path.basename(appId, ".exe"),
        })),
      };
    if (name === "launch_app") {
      if (!appAllowed(args.appId, cap))
        throw new Error("Application is not selected in Settings.");
      const canonical = await fs.realpath(args.appId);
      if (
        !appAllowed(canonical, cap) ||
        !canonical.toLowerCase().endsWith(".exe")
      )
        throw new Error(
          "Application target changed or is not an executable. Select it again.",
        );
      const child = spawn(canonical, [], {
        shell: false,
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      child.unref();
      return {
        ok: true,
        summary: "Application launched. Inspect its window before using it.",
        data: { appId: canonical, pid: child.pid },
      };
    }
    if (name === "list_windows")
      return {
        ok: true,
        summary: "Selected application windows.",
        data: (await this.windows(ctx.signal)).filter((w) =>
          appAllowed(w.appId, cap),
        ),
      };
    if (args.screenshotId) {
      const observation = this.observations.get(args.screenshotId);
      const reject=(code:string,message:string):never=>{throw new DesktopActionError(code,message,observation?.owner===ctx.owner?observation.window?.windowId:undefined);};
      if(!observation) reject('UNKNOWN_OBSERVATION','Screenshot is unknown or was cleared. Use prepare_desktop for a current window view.');
      if(observation!.owner!==ctx.owner) reject('WRONG_TASK','Screenshot belongs to another task. Use prepare_desktop in this task.');
      if(observation!.consumed) reject('OBSERVATION_USED','This screenshot was already used for an input attempt. Use the next screenshot returned by the action, or prepare_desktop. Do not replay the previous input.');
      if(observation!.superseded) reject('OBSERVATION_SUPERSEDED','A newer view or input replaced this observation. Use the latest returned screenshotId or prepare_desktop.');
      if(Date.now()-observation!.createdAt>180000) reject('OBSERVATION_EXPIRED','Screenshot expired after 180 seconds. Use prepare_desktop.');
      if(!observation!.window) reject('DISPLAY_ONLY','A monitor screenshot cannot authorize input. Use prepare_desktop with a windowId.');
      if(!observation!.window!.focused) reject('FOCUS_REQUIRED','This was an observation-only screenshot: the window was not focused. Use prepare_desktop, not another capture_screen. No input was sent.');
      const observed=observation!;
      if (!appAllowed(observed.window!.appId, cap))
        throw new Error("Application access was revoked.");
      const { imageWidth, imageHeight } = observed;
      const target=observed.window!;
      if(name==='type_text' && observed.prepared && !observed.focusedControl?.runtimeId) reject('FOCUS_UNKNOWN','No observable unprotected focused control. Inspect or click the intended editable field before typing. No text was sent.');
      if (
        args.x !== undefined &&
        (args.x >= imageWidth || args.y >= imageHeight)
      )
        throw new Error("Point is outside the captured image.");
      const nativeArgs = {
        ...target,
        ...args,
        ...(name==='type_text' && observed.prepared?{expectedFocus:observed.focusedControl!.runtimeId}:{}),
        x:
          target.left + Math.floor(((args.x || 0) * target.width) / imageWidth),
        y:
          target.top +
          Math.floor(((args.y || 0) * target.height) / imageHeight),
      };
      // Consume only after validation, but before dispatch: a partial input must never be replayed.
      observed.consumed=true;
      for(const old of this.observations.values()) if(old.owner===ctx.owner && old!==observed)old.superseded=true;
      let data:any;
      try {data=await this.bridge.request(name, nativeArgs, ctx.signal);} catch(error) {
        ctx.signal.throwIfAborted();
        throw new DesktopActionError(desktopFailure(error)?.code || 'INPUT_FAILED',error instanceof Error?error.message:String(error),target.windowId);
      }
      if(observed.prepared) {
        try {
          const capture=await this.bridge.request('observe_active',target,ctx.signal);
          ctx.signal.throwIfAborted();
          const next=this.recordCapture(capture,ctx.owner,true,cap);
          return {ok:true,summary:'Input sent once. Inspect the returned current view before deciding the next action. '+next.summary,data:{...next.data,actionSent:true}};
        } catch(error) {
          ctx.signal.throwIfAborted();
          return {ok:true,summary:'Input was sent, but its resulting screen could not be captured. Do not repeat the input. Use prepare_desktop to inspect the outcome.',data:{actionSent:true,observationError:String(error),windowId:target.windowId}};
        }
      }
      return {
        ok: true,
        summary:
          "Input sent. Capture and inspect the result before the next action.",
        data,
      };
    }
    let target: DesktopWindow | undefined;
    if (args.windowId) {
      target = (await this.windows(ctx.signal)).find(
        (w) => w.windowId === args.windowId,
      );
      if (!target || !appAllowed(target.appId, cap))
        throw new Error(
          "Window is unavailable or its application is not selected.",
        );
    }
    if (name === "capture_screen" || name === "prepare_desktop") {
      const capture = await this.bridge.request(
        name,
        { ...target, ...(args.displayId ? { displayId: args.displayId } : {}) },
        ctx.signal,
      );
      ctx.signal.throwIfAborted();
      return this.recordCapture(capture,ctx.owner,name==='prepare_desktop',cap);
    }
    return {
      ok: true,
      summary: name === "focus_window" ? "Window focused." : name === "move_window" ? "Window moved. Prepare it again before input." : "Window controls observed.",
      data: await this.bridge.request(name,{...target,...(args.displayId?{displayId:args.displayId}:{})},ctx.signal),
    };
  }
  private recordCapture(capture:any,owner:string,prepared:boolean,cap:Capabilities) {
      if(capture.window && !appAllowed(capture.window.appId,cap)) throw new Error('Captured application is not allowed.');
      const source = nativeImage.createFromBuffer(
        Buffer.from(capture.image, "base64"),
      );
      if (source.isEmpty())
        throw new Error("Screen capture returned no usable pixels.");
      const size = source.getSize();
      const image = size.width > 1600 ? source.resize({ width: 1600 }) : source;
      const imageSize = image.getSize();
      const screenshotId = crypto.randomUUID();
      for(const old of this.observations.values()) if(old.owner===owner && old.window?.windowId===capture.window?.windowId)old.superseded=true;
      for (const [id, old] of this.observations)
        if (Date.now() - old.createdAt > 360000) this.observations.delete(id);
      while(this.observations.size>=128) this.observations.delete(this.observations.keys().next().value!);
        this.observations.set(screenshotId, {
          owner,
          createdAt: Date.now(),
          window: capture.window,
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          prepared,
          focusedControl:capture.focusedControl,
        });
      const jpeg = image.toJPEG(85);
      const imageData = "data:image/jpeg;base64," + jpeg.toString("base64");
      return {
        ok: true,
        summary:
          !capture.window ? "Monitor observed only. Use prepare_desktop with a windowId before input." : capture.window.focused===false ? "Window is NOT focused and may be covered. Observation only; use prepare_desktop before input. Do not treat another app’s pixels as verification." : "Window ready. Use this screenshotId once; coordinates are relative to this image.",
        data: {
          screenshotId,
          width: imageSize.width,
          height: imageSize.height,
          window: capture.window,
          focusedControl: capture.focusedControl,
          displayId: capture.displayId,
          capturedAt: Date.now(),
          imageData,
          inputReady: Boolean(capture.window && capture.window.focused !== false),
          frameDigest: crypto.createHash('sha256').update(jpeg).digest('hex'),
        },
      };
  }
}
