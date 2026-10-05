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

## Important limits

SchoolWork is independent software and does not claim feature or intelligence parity with ChatGPT Work. The Artificial Analysis Intelligence Index is a general model benchmark, not a guarantee of coding or project success. TeachGPT may intermittently return HTTP 504; saved tasks can be resumed without repeating completed tools. Web search can be blocked or challenged. Processes and PowerShell run with the current Windows user's permissions and are not a security sandbox. Background servers stop when SchoolWork exits.

File tools default to the selected folder. Settings includes a **Full user access** profile for task-relevant files elsewhere under the same Windows account. Existing tasks keep their original access mode; new tasks use the current setting. Credential files, `.env` files, private keys, and similar secrets are excluded from model context in both modes.

No `.env` file, API key, conversation database, browser profile, or local diagnostic log belongs in this repository. Every user must obtain and configure their own TeachGPT key under their school's terms.
