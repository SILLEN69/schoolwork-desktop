# SchoolWork 0.11.0-beta.7 — projector reliability and connection logs

Enter the six-digit classroom projector code in **Follow a lesson**. Sign in through the school's normal YeetCast flow when required; SchoolWork remembers the resolved receiver when the visible code rotates. No additional OAuth/developer setup is required for the projector feature.

- Reconnect/disconnect now abort old receiver requests; a slow old request cannot block or overwrite a newly selected projector.
- Closing or disconnecting during a viewer load cannot reopen an outdated window. Captures recheck current receiver state, require a real video frame and discard images from an interrupted or changed selection.
- Manual Refresh bypasses the polling cache. Sign-in crashes, network failures, expired-code errors and cleanup problems have actionable outcomes.
- **Save connection log / Spara anslutningslogg** exports local beta-only metadata for classroom troubleshooting. Logs contain phases, durations, HTTP/network codes and frame readiness; never projector PINs, account identities, tokens, page contents or stream URLs. Nothing is uploaded automatically.
- Logging is disabled automatically in main/stable builds, with an explicit removal checklist before main promotion.
- Windows batch launchers use directly quoted `cmd.exe` arguments instead of cold PowerShell initialization. This addresses the hosted 10-second batch-test timeout that prevented beta.5 publication, while preserving literal arguments, exit codes and metacharacter rejection.
- Beta updates remain on `beta.yml`, stable updates on `latest.yml`, with explicit downloads/restarts and no automatic downgrade.

Local verification: 218 unit tests, seven release/asset/native/logging-policy checks, the complete Windows build, 13 lesson/model workflows and eight projector workflows passed. A main-configured build also passed the projector workflow with logging/export disabled. The lesson notification fixture now uses a real owned foreground window rather than relying on ineffective blur calls. Further targeted checks and hosted release results are recorded in `AGENT_PROGRESS.md`.

Deterministic tests and isolated real-Electron workflows use simulated school identity, receiver lookup and video frames. A current classroom code and actual teacher stream are still required to establish real school acceptance; no first-attempt guarantee or live signed-in classroom test is claimed. Older betas whose updater excluded prereleases need this installer installed manually once.

This is a Windows x64 prerelease. Installer and portable binaries are unsigned. Stable main/v0.10.1 remain unchanged. Existing credentials, conversations and files are preserved; close or pause your task and exit SchoolWork normally before updating.

Hosted readiness: the projector harness installs the pinned Electron runtime before launch, clears inherited Electron Node/download-skip flags and records child startup diagnostics on CI. The archive persistence regression uses a bounded 20-second filesystem budget on hosted Windows while retaining all disk/index assertions. Beta.5 and beta.6 failed publication; this candidate supersedes them.
