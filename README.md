# SchoolWork

SchoolWork is a Windows desktop AI work assistant powered by the models available through your TeachGPT account. It can map and search projects, edit files with stale-file protection, run direct processes or PowerShell commands, inspect localhost previews, search the web, and keep project notes in a local Markdown memory vault.

## Install on Windows

Download the latest installer from the [SchoolWork Releases page](https://github.com/SILLEN69/schoolwork-desktop/releases/latest), then run `SchoolWork-<version>-x64-setup.exe`. The current Windows package is unsigned. Each user configures their own TeachGPT API key in the app; no API key is included in the repository or installer.

You can also download and verify the latest installer with the included PowerShell script:

```powershell
.\Install-SchoolWork.ps1
```

The script checks the release's SHA-256 manifest before starting the regular interactive installer. It does not change PowerShell's execution policy or bypass Windows security prompts. If your school device blocks scripts, use the installer download or ask your administrator for the approved method.

## Run from source

Requirements: Windows 10/11 x64 and Node.js 22.12 or later.

```powershell
npm install
npm run dev:app
```

On first launch, open Settings, enter your own TeachGPT API key, refresh the models, and choose a workspace folder. SchoolWork stores the key using Windows-protected application storage and sends it to TeachGPT for inference.

## Build Windows packages

```powershell
npm install
npm run package:win
```

The installer and portable executable are written to `release/`.

For an isolated test profile, launch with `--user-data-dir=<existing absolute directory>`; the default SchoolWork profile is not changed. After packaging, run the desktop test with `SCHOOLWORK_TEST_PACKAGED=1` to additionally verify the packaged executable and bundled native helper.

## Current features

- Chat and multi-step tasks using TeachGPT models.
- Task progress with a total timer and a timer for the current stage.
- TeachGPT model list with matching Artificial Analysis Intelligence Index scores where available. Unmatched models are labeled as unranked.
- Project mapping with manifests and scripts, paginated file discovery, bounded multi-file reads, literal search with line references, hash-checked multi-edit patches, versioned backups, and cancellable process trees.
- Direct process execution with separate arguments for Node/test runners, app-owned background development servers, streamed output, and cleanup on cancellation or application exit.
- PowerShell command mode without temporary script files or execution-policy changes.
- Isolated localhost preview checks with optional CSS-selector interaction and expected-text assertions.
- Web search and opening links in the system browser.
- Local SQLite conversation/task storage and an Obsidian-compatible Markdown memory vault.
- Pause, cancel, and retry/resume controls, persistent project plans, and completion checks tied to real test commands.
- Swedish and English interface.
- Rendered LaTeX maths, syntax-highlighted fenced code with Copy, tables and clearer message spacing.
- PNG/JPEG image attachments: file picker, paste/drop, thumbnail previews and saved conversation images.
- Selected Windows applications: launch, list/focus/inspect windows, capture screenshots, mouse clicks, Unicode typing, shortcuts and scrolling.
- A Desktop panel and immediate Stop control (`Ctrl+Alt+Escape`). No per-action confirmation dialogs.

## Applications, screen and images

In Settings, select the executables the desktop tools may use and enable app launching, screen viewing and input control. Add an executable with **Add application**, or select an already running application. Windows' modern packaged applications may use a different executable than their launcher; select the running executable in that case. Existing tasks retain their original capability snapshot; turning a capability off revokes it immediately. Start a new task to expand access.

Ask the agent to use an application normally. Each input requires a fresh, one-use window screenshot; moving the window, switching focus, revoking access or stopping the task invalidates input. Windows may refuse foreground focus; manually activate the window if that happens. The helper stays unelevated: it cannot control secure/UAC/locked desktops or reliably inject input into elevated applications. Visible screen capture may include occluding windows and protected video may appear black. This is point-in-time capture, not continuous recording.

Attach PNG/JPEG images with the composer, clipboard or drop. Limits: 10 MB original, 32 megapixels, six images and 8 MB normalized images per message. Images are resized to a maximum 1600-pixel side and re-encoded locally as PNG. Saved images stay in the app's user-data attachment directory until conversation deletion; unsent images expire after 24 hours at next startup. Tool screenshots are ephemeral and are not written into memory or diagnostic logs. Capture buttons create normal persistent attachments; **sending** them uploads them to TeachGPT. A screenshot requested by the agent is sent to TeachGPT at its next step. Do not use these features with secrets visible on screen.

Image reasoning requires a vision-capable model on your school's TeachGPT endpoint. Model names alone are not proof. Settings includes a synthetic-image vision test, showing verified/unknown/unsupported separately from streaming support. Unknown models may be tried; rejected image input produces a recoverable error without silently changing models or dropping images. The latest two image-bearing messages are included in inference, with a notice for older omitted images.

PowerShell and process tools already execute with your Windows account's permissions and can bypass the desktop allowlist. Capability switches are application-level controls, **not** a security sandbox. Pausing/cancelling stops the helper and invalidates observations; applications you opened remain running. An interrupted input can have partial effects: inspect it before repeating it.

The bundled x64 helper uses Windows .NET Framework, Win32 `SendInput`, UI Automation and GDI; no Node native addon, background service, network listener or elevation is required. Building it requires the Windows Framework compiler installed with .NET Framework 4.x. It is built by `npm run build` and included by the Windows packager.

## Verification

```powershell
npm test
npm run test:desktop
```

The Windows-only desktop test runs the actual Electron app, isolated SQLite/settings and a disposable test window. TeachGPT responses are mocked; no personal screen or credential is sent. It checks image-to-provider content arrays, actual screenshot transport and Unicode input, formatted maths/code/Copy, layout, and Stop. Set `SCHOOLWORK_TEST_OUTPUT` to an existing output directory to keep its UI screenshots. Live provider vision must be tested separately in Settings. Manual checks should cover paste/drop, app selection, window movement/focus loss, rapid Stop, 100/125/150% display scaling, partially off-screen windows, protected content and elevated apps; don't dismiss UAC or unlock Windows automatically.

## Important limits

SchoolWork is independent software and does not claim feature or intelligence parity with ChatGPT Work. The Artificial Analysis Intelligence Index is a general model benchmark, not a guarantee of coding or project success. TeachGPT may intermittently return HTTP 504; saved tasks can be resumed without repeating completed tools. Web search can be blocked or challenged. Processes and PowerShell run with the current Windows user's permissions and are not a security sandbox. Background servers stop when SchoolWork exits.

File tools default to the selected folder. Settings includes a **Full user access** profile for task-relevant files elsewhere under the same Windows account. Existing tasks keep their original access mode; new tasks use the current setting. Credential files, `.env` files, private keys, and similar secrets are excluded from model context in both modes.

No `.env` file, API key, conversation database, browser profile, or local diagnostic log belongs in this repository. Every user must obtain and configure their own TeachGPT key under their school's terms.
