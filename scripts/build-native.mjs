import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

if (process.platform !== "win32") {
  console.log("Windows desktop helper is built when packaging on Windows.");
} else {
  const framework = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "Microsoft.NET",
    "Framework64",
    "v4.0.30319",
  );
  mkdirSync("dist-native", { recursive: true });
  const result = spawnSync(
    path.join(framework, "csc.exe"),
    [
      "/nologo",
      "/target:exe",
      "/platform:x64",
      "/optimize+",
      "/out:" + path.resolve("dist-native/SchoolWork.DesktopBridge.exe"),
      "/r:System.Drawing.dll",
      "/r:System.Windows.Forms.dll",
      "/r:System.Web.Extensions.dll",
      "/r:" + path.join(framework, "WPF", "UIAutomationClient.dll"),
      "/r:" + path.join(framework, "WPF", "UIAutomationTypes.dll"),
      "/r:" + path.join(framework, "WPF", "WindowsBase.dll"),
      path.resolve("native/DesktopBridge.cs"),
    ],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status || 0;
}
