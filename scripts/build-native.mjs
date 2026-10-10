import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const crossCompiler = process.env.SCHOOLWORK_CSC;
const referenceDir = process.env.SCHOOLWORK_FRAMEWORK_REFERENCES;
if (process.platform !== "win32" && !(crossCompiler && referenceDir)) {
  console.log("Windows desktop helper is built when packaging on Windows.");
} else {
  const framework = referenceDir || path.join(
    process.env.SystemRoot || "C:\\Windows",
    "Microsoft.NET",
    "Framework64",
    "v4.0.30319",
  );
  mkdirSync("dist-native", { recursive: true });
  const result = spawnSync(
    crossCompiler || path.join(framework, "csc.exe"),
    [
      "/nologo",
      ...(referenceDir ? ["/nostdlib", "/r:"+path.join(framework,"mscorlib.dll"), "/r:"+path.join(framework,"System.dll"), "/r:"+path.join(framework,"System.Core.dll")] : []),
      "/target:exe",
      "/platform:x64",
      "/optimize+",
      "/out:" + path.resolve("dist-native/SchoolWork.DesktopBridge.exe"),
      "/r:" + path.join(framework, "System.Drawing.dll"),
      "/r:" + path.join(framework, "System.Windows.Forms.dll"),
      "/r:" + path.join(framework, "System.Web.Extensions.dll"),
      "/r:" + path.join(framework, ...(referenceDir ? [] : ["WPF"]), "UIAutomationClient.dll"),
      "/r:" + path.join(framework, ...(referenceDir ? [] : ["WPF"]), "UIAutomationTypes.dll"),
      "/r:" + path.join(framework, ...(referenceDir ? [] : ["WPF"]), "WindowsBase.dll"),
      path.resolve("native/DesktopBridge.cs"),
    ],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status || 0;
  if (result.status === 0) {
    const hash = file => crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
    writeFileSync('dist-native/build.json', JSON.stringify({sourceSha256:hash('native/DesktopBridge.cs'),binarySha256:hash('dist-native/SchoolWork.DesktopBridge.exe'),target:'windows-x64-netframework4'}));
  }
}
