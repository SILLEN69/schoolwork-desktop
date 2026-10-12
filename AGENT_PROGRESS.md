# Autonomous engineering checkpoint

Updated: 2026-10-12. Work stays on `beta`; no release, deployment, main merge or installed-app replacement is requested for this session.

## Mission and working rules

Investigate stalled SchoolWork and development sessions first, then improve motion, reproducible development and the most useful product defects. Preserve chats, credentials, current user edits and live processes. Commit validated milestones locally. Keep evidence and limits explicit.

## Phase 1: findings verified before edits

- Baseline: 168 unit tests in 28 files passed on Windows, Node 24.13.0/npm 11.6.2. Installed app and source are `0.10.1-beta.5`. GitHub `beta` and local HEAD both start at `aefbabf`; main is `c56eb97`. There are no open GitHub issues at inspection time.
- Latest release workflow runs beta.3 and beta.4 passed. Earlier beta.1 and beta.2 failed; recorded investigation and subsequent regression checks identify update-manifest/provider override configuration as the cause, rather than a continuing build blocker.
- Read-only inspection of the real SQLite profile found 34 completed tasks, six waiting for retry, six paused and four cancelled. No credential values or private transcript contents were exported.
- Two recent tasks stopped at the code-verification gate (84 and 144 turns). The 84-turn task has a successful `Set-Location "<project>"; npm run lint` after editing; the gate only recognizes a check at the beginning of the command. This is a reproducible false negative. The 144-turn task has 105 successful reads and genuine PowerShell syntax failures; fix the gate without pretending a failed check passed.
- A direct Windows `.cmd` invocation returned `spawn EINVAL`. Separate executable/arguments are appropriate for executables; batch launchers require safe Windows handling.
- Historical TeachGPT diagnosis proves approximately 30-second non-streaming gateway failure and a successful 146-second SSE response. Current source already streams and tests cancellation/truncation. No new claim about provider availability follows from the historical diagnosis.
- Pointer observations explicitly hide the overlay and do not redraw after capture. This explains at least one real mechanism for disappearing/reappearing. The bubble also mixes tool status with public explanation, contrary to the user's saved request.
- Completion-to-notification state ordering is correct, but notification failures are swallowed and no delivery diagnostics are persisted. Previous smoke evidence proves Electron accepted a toast, not that Windows displayed a banner. Investigate shortcut registration and OS suppression before claiming a cause.
- Accessible prior conversation/history also contains PowerShell quoting failures and diagnosis-only handoffs. Platform session interruption/context exhaustion cannot be proved from app logs; large unbounded historical tool output can consume context. Use bounded reads and resumable checkpoints rather than claiming platform limits are fixable app defects.

## Existing work preserved

- Uncommitted `StartupIntro.tsx`, `startup-intro.css` and the App mount were created in this chat before the mission.
- `remotion-startup/src/Composition.tsx` changed externally to a 96-frame atom reveal. Preserve it; do not restore the earlier linked-square composition. It is not yet the same animation as the app intro.
- The real installed app/profile, current Studio server and user source edits have not been closed or overwritten.

## Next three tasks

1. Make source setup, CI and development-profile recovery reproducible; check dependency advisories and stale-build failure handling.
2. Correct pointer explanation-only content and observation/idle stability without weakening capture exclusion.
3. Add notification delivery diagnostics and an accessible fallback/test flow; verify terminal outcomes and OS limitations honestly.

## Milestone 1: confirmed execution blockers repaired

- Verification accepts literal directory setup followed by an actual supported check, invocation operators and npx.cmd. Printed claims, comments, nested commands, nonzero exits and timeouts remain insufficient. No historical task or result is edited.
- Windows `.cmd`/`.bat` tools use a process-local literal PowerShell invocation; unsafe batch-shell argument characters are rejected explicitly. Spaced paths/literal arguments and nonzero exit codes are tested. No execution policy is changed.
- Repeated reads are keyed by file hash, returned range and excerpt size. Warn after three identical reads and save a resumable stop after eight. Changed hashes/ranges and new edits permit legitimate new work.
- Focused checks: 20 tests pass across verification/progress/process suites; four release configuration checks pass; full TypeScript/Vite/Electron/native build passes. Existing Vite large-chunk and dependency-comment warnings remain.
- Real isolated Windows Electron agent cycles pass both Set-Location-prefixed syntax checking and npm.cmd lint. Each task finishes after one actual check, with one user input and no repeated completed tools. Provider transport is simulated; these are not live TeachGPT tests.
- The first new integration-fixture run lacked a valid allowed-app entry and timed out waiting for a window. A concrete allowed path and explicit isolated user-data-dir are now supplied; the two scenarios then pass. Test subprocess output is surfaced for recovery.
- Build used no publisher Google configuration (expected warning); custom user configuration is preserved. No installation, task resumption or OS notification settings were changed.

## Milestone 2: verified branded startup and native UI motion

- Preserved the externally edited 96-frame atom reveal and rendered it locally using pinned Remotion 4.0.534 after reading the Remotion render/markup skills and official interactivity documentation. MP4 is 191,877 bytes; reduced-motion JPEG is 19,370 bytes. Poster/frame 70 was visually inspected without clipping.
- Desktop startup plays this exact local asset with no runtime Remotion dependency or inference/network call. The shell is inert while the intro is shown. Esc/button skip, completion/error exit and a non-resetting 4.2-second hard deadline prevent a media failure from blocking the app.
- Reduced motion uses a still for about 0.4 seconds. Settings allows explicit replay. New chats do not replay the intro. Brief native opacity/translation/button feedback honors reduced motion.
- Source/asset hashes prevent a stale animation from shipping after Studio edits; source hashes normalize CRLF/LF. `animation:studio` and `animation:render` are repeatable project scripts.
- Checks: animation lint/type check passes; H.264 video/JPEG render passes; app type check/production frontend build passes. Real isolated Electron verifies actual local playback, one-time completion, inert background, keyboard skip, injected media failure, stalled playback timeout, reduced motion and Settings replay. No renderer errors. Expected pending desktop-discovery cancellation is logged during test-window shutdown; this does not establish a runtime regression and remains a cleanup candidate.
- Evidence screenshots live in ignored `work/motion-verification`. No private screenshots, credentials, browser profiles or runtime data are committed. Existing audio-generation helper scripts remain local and are not connected to this muted intro.
- Windows shortcut inspection confirms the installed SchoolWork Start Menu shortcut already has the expected `nu.ssis.schoolwork` AUMID. Registry reads did not establish notification suppression; the original missing-banner cause remains unproven.

## Resume commands

```powershell
cd <checkout>
git status --short
npm test
node --test scripts/check-release-config.cjs
npm run build
```

Development prerequisites: Windows x64, Node 24 LTS with npm, .NET Framework 4.x x64 C# compiler. `npm run dev` is renderer-only; use `npm run dev:app` for privileged tools. Use an isolated `--user-data-dir` for verification, never the personal profile.

## Remaining limits

No public release, clean-machine install, Google review approval, live email delivery or new live TeachGPT qualification has been verified by this session. Public release/auth approvals remain separate external prerequisites. Ordinary development builds may run without publisher Google credentials and must disclose that distinction.
