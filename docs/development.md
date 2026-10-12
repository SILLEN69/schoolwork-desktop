# Development and recovery

Use Node 24 LTS/npm and the committed lockfile. Windows builds need the .NET Framework 4.x x64 C# compiler. Linux can build the renderer/backend and run portable unit checks, but cannot verify Windows desktop input or make the native helper without the documented cross-compiler environment.

## Install, build and run

```powershell
npm ci
npm run build
npm run dev:app
```

Development uses `work/dev-profile`, not the installed profile. Configure a separate school credential in its Settings. Override with an absolute `SCHOOLWORK_DEV_DATA` path if needed. The launcher selects the platform's Electron binary, clears inherited `ELECTRON_RUN_AS_NODE`, starts its own Vite server and only then opens Electron. It refuses an occupied port. Use `$env:SCHOOLWORK_DEV_PORT='0'` for a free port. Ctrl+C closes the owned development process/server.

`npm run dev` is only a renderer preview. `npm start` runs compiled production code; for an isolated profile launch Electron with `--user-data-dir=<absolute-directory>`. These commands do not install, publish or modify the installed application.

## Focused checks

```powershell
npm test
npm run check:release
npm run check:startup
npm run test:agent-recovery
npm run test:motion
npm run test:pointer-ui
npm run test:lessons
npm run test:desktop
```

The `test:*` commands build first. When testing an already verified build, run the matching script directly to avoid redundant builds. Windows Electron regressions use disposable profiles and simulated provider responses; they cannot establish live model quality, Google approval or notification-banner receipt.

CI now checks pushes to beta/main and pull requests on Linux and Windows, with Windows execution/motion regressions. It needs no publisher credentials and never publishes packages. The separate tagged release workflow still requires publisher Google configuration. A development build without that configuration reports the limitation rather than claiming shared sign-in is provisioned.

## Animation

```powershell
npm ci --prefix remotion-startup
npm run animation:studio
npm run animation:render
```

Open the exact URL printed by Studio. Source changes require rerendering the local MP4/JPEG before the main build. The hash guard explains the recovery command and normalizes source line endings across platforms. It checks consistency; actual playback/accessibility are checked by `test:motion`. See the [animation project](../remotion-startup/README.md).

## When a session stops

Read `AGENT_PROGRESS.md`, inspect `git status --short` and the failing log before retrying. Keep live process/session handles; a polling timeout is not a stopped process. Never repeat uncertain file writes, native inputs or external sends blindly. Run the narrowest failed check again after a concrete change and commit validated increments. Application tasks retain their completed tool history and resume from checkpoints; development tooling cannot remove platform quota or session limits.

## Dependency audit at 2026-10-12

`npm audit --omit=dev` reported no production dependency advisories. The separate Remotion lint dependency chain reports ten affected packages rooted in one unpatched [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting the latest 3.0.3. No patched version was published at inspection time. Keep lint patterns repository-controlled; these development packages are not included in the desktop installer. Do not claim the entire development graph is advisory-free or force an unverified dependency replacement merely to suppress the report.
