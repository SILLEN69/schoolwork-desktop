import { z } from "zod";

export const capabilitiesSchema = z.object({
  allApps: z.boolean().default(true),
  launchApps: z.boolean().default(true),
  viewScreen: z.boolean().default(true),
  controlScreen: z.boolean().default(true),
  allowedApps: z.array(z.string().min(1).max(4096)).max(40).default([]),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export type DesktopWindow = {
  windowId: string;
  pid: number;
  appId: string;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  focused: boolean;
  minimized: boolean;
  ownerWindowId?: string;
};
export type Attachment = {
  id: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  conversationId: string;
  messageId?: string;
  createdAt: number;
};
export function effectiveCapabilities(
  saved: Capabilities,
  current: Capabilities,
): Capabilities {
  return {
    allApps: saved.allApps && current.allApps,
    launchApps: saved.launchApps && current.launchApps,
    viewScreen: saved.viewScreen && current.viewScreen,
    controlScreen: saved.controlScreen && current.controlScreen,
    allowedApps: saved.allApps
      ? current.allowedApps
      : current.allApps
        ? saved.allowedApps
        : saved.allowedApps.filter((p) =>
            current.allowedApps.some(
              (c) => c.toLowerCase() === p.toLowerCase(),
            ),
          ),
  };
}
export function appAllowed(appId: string, capabilities: Capabilities) {
  return (
    Boolean(appId) &&
    (capabilities.allApps ||
      capabilities.allowedApps.some(
        (p) => p.toLowerCase() === appId.toLowerCase(),
      ))
  );
}
export type DesktopDisplay = {
  displayId: string;
  primary: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  workLeft: number;
  workTop: number;
  workWidth: number;
  workHeight: number;
};
