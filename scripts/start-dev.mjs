import { spawn } from "node:child_process";
import path from "node:path";
const child = spawn(
  path.resolve("node_modules/electron/dist/electron.exe"),
  ["."],
  {
    windowsHide: true,
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
