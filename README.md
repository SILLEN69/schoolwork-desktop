# SchoolWork

SchoolWork is a Windows desktop AI work assistant powered by the models available through your TeachGPT account. It can work through multi-step tasks, edit files in a selected workspace, run PowerShell commands, search the web, and keep project notes in a local Markdown memory vault.

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
- Workspace-scoped file listing, bounded reads and search, writes with backups, targeted patches, and cancellable PowerShell commands.
- Web search and opening links in the system browser.
- Local SQLite conversation/task storage and an Obsidian-compatible Markdown memory vault.
- Pause, cancel, and retry/resume controls.
- Swedish and English interface.

## Important limits

SchoolWork is independent software and does not claim feature or intelligence parity with ChatGPT Work. The Artificial Analysis Intelligence Index is a general model benchmark, not a guarantee of coding or project success. TeachGPT may intermittently return HTTP 504; saved tasks can be resumed without repeating completed tools. Web search can be blocked or challenged. PowerShell runs with the current Windows user's permissions and is not a security sandbox.

No `.env` file, API key, conversation database, browser profile, or local diagnostic log belongs in this repository. Every user must obtain and configure their own TeachGPT key under their school's terms.
