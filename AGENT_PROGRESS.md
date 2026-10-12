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

1. Add notification delivery diagnostics and an accessible fallback/test flow; verify terminal outcomes and OS limitations honestly.
2. Audit remaining performance, accessibility and cancellation paths, then verify the integrated changes without unnecessary release/deployment.
3. Run a minimal safe live provider tool cycle through the existing credential service, if the current service is available; do not execute arbitrary generated actions.

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

## Milestone 3: repeatable source development and recovery

- Development now starts its own strict-port Vite server before Electron, selects the correct platform binary, clears inherited Electron Node mode and uses an isolated development profile. A real forked launcher smoke check verifies an OS-selected free port, HTTP 200, separate initialized SQLite profile and shutdown of both owned processes. No installed app is stopped.
- Removed unused concurrently/wait-on dependencies. Node 24 is declared in package metadata and matches CI/docs. New CI validates beta/main pushes and PRs on Linux/Windows without publishing or publisher credentials; YAML syntax parses. Remote CI execution is not claimed before a future push.
- A terminated C# compiler now fails the build rather than accepting a previous helper. A controlled signal regression and the animation consistency regression both pass.
- A late failed check invalidates an earlier pass after an edit. Reconstruction now includes failed completed operations in deterministic order, so a restart does not silently lose that failure. The real isolated agent regression verifies the pending result; failed checks never become completed tasks.
- Full unit suite passes: 173 tests in 28 files. The first broader run incorrectly discovered Node-runner CLI tests through Vitest; scripts are now excluded from Vitest and executed explicitly through node:test/CI. This mismatch was diagnosed and repaired, not ignored.
- Fresh `npm ci` installed 480 packages in an isolated copy; full fresh TypeScript/frontend/backend/native build passed. This is a new dependency installation on the current Windows machine, not clean-Windows installation acceptance. Existing deprecation/large-chunk warnings remain documented.
- Production npm audit reports zero advisories. The animation lint dependency chain has one unpatched braces issue propagated through ten dev packages: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm . Latest published braces is 3.0.3 and no fixed version exists at inspection. Do not suppress the report by inventing an upgrade.
- Exact install/build/test/animation/recovery instructions are in `docs/development.md`. No API key, publisher JSON, profile or private log was committed. Local source commits remain ahead of remote beta; no publication/merge occurred.

## Milestone 4: public-only pointer and capture/idle stability

- Removed generated tool/status/coordinate text from the pointer channel and bubble. The app timeline retains tool details; the bubble receives only filtered public assistant content. Empty or private-only updates retain the previous public note instead of blinking it away. No private reasoning is shown or invented.
- Capture suppression now restores the overlay immediately after a completed observation. A separate input suppression flag keeps it hidden throughout native hit-testing and post-input capture, including concurrent explanation updates. Failure cleanup restores display safely; abort/generation changes cannot resurrect a stopped window.
- Keyboard steps no longer force an arbitrary window-corner cursor target or needless movement delay. Pointer motion respects the actual overlay reduced-motion media preference. No input permissions or Google scopes changed.
- Full app type check/build and focused real Electron pointer/UI checks pass: 45 chats at two sizes, public-only resizing bubble, idle stability, immediate post-capture restore, hidden capture/input during public updates, retained text after empty/private-only updates, no focus theft, Stop and cancellation cleanup. No real desktop input or live provider action was used in the display fixture.
- Earlier pointer regression expected the old permanently hidden post-observation state; it was updated to assert the requested restored state while keeping the stricter hidden-during-capture assertions. The initial run's true-vs-false assertion was this changed expected behavior, not an ignored regression.
- A brief deliberate hide remains during native observation/hit-testing to keep overlays out of model pixels; this does not create a second OS mouse or independent desktop.

## Milestone 5: completion/error notifications (final requested scope)

- Latest user instruction narrows work to finishing notifications and stopping; nothing may be published yet. All changes stay on local beta. No push, release, merge or installation was performed; the installed user application/profile were preserved.
- Native requests now record requested, accepted, failed, unsupported and clicked outcomes without error bodies or task content. Asynchronous failure releases duplicate protection so a deliberate retry can work. Notification failure cannot change task state or interrupt execution.
- Persisted completed/error outcomes also produce visible, dismissible notices in the app. View task and native notification clicks open the correct conversation. Unfocused windows flash the taskbar until focused. The notice listener stays mounted while navigating to lessons.
- Settings now provides a Windows-notification test and a link to Windows notification settings. Test feedback reports a request, not guaranteed banner visibility. No Windows notification/DND setting is changed.
- Focused verification passed: three notification unit tests; full TypeScript/frontend/backend/native build; real isolated Electron completion and provider-error outcomes, fallback notice visibility, correct conversation navigation, unavailable-native diagnostics and test-button feedback. A separate actual Windows/Electron native request emitted accepted. This proves native acceptance, not banner visibility under every user's Windows settings.
- Reproduce: `npm test -- electron/taskNotifications.test.ts`; `npm run test:notifications`. After a current build, `node scripts/test-notifications.mjs --native` additionally requests one real Windows toast. Tests use isolated profiles and simulated provider traffic, never the personal profile/key.

## Latest UI cleanup and local-preview credential repair

- Removed notification-test/settings help UI while retaining ordinary completion/error notifications and developer regression access. Removed repeated footer/marketing copy and shortened general, model, desktop, Telegram and MCP settings; permission boundaries and actionable errors remain visible.
- Windows MinAnimate is disabled on this machine. Automatic startup retains reduced-motion behavior; explicitly selecting Play startup animation now requests actual video playback, including with reduced motion. Real isolated Electron tests verify playing video, skip, failed/stalled media cleanup and still-only automatic startup.
- The earlier local preview copied encrypted settings without their Chromium Local State encryption context. Inspection confirmed different protected os_crypt keys in the original and cloned profiles. This was a preview-preparation mistake, not an established TeachGPT server defect. After verifying zero active preview tasks, closed only the preview gracefully, backed up its Local State and restored the matching protected os_crypt context from the original. Original installed app/profile remained untouched.
- Real Electron verification in a separate probe profile used the actual credential service and confirmed the copied configured key decrypts successfully without printing it. Credential failures now offer a Settings recovery instruction; configured status checks readability rather than ciphertext presence. Two focused credential unit tests pass.
- Full app build passed after closing the idle preview. An earlier native compilation failed because its helper was still running; that failure was repaired by graceful preview shutdown, not ignored. Animation/UI and notification regressions pass after removal of the settings control.
- Reopened the updated local beta with the same isolated preview history; window responds and settings reports readable credentials. Models:list returned 13 entries, but that handler can return cached defaults, so it is not live-authentication proof. An optional direct provider probe was rejected by execution policy and was not retried through a workaround. No new live inference/authentication claim is made.
- No push, release, merge, installed-app replacement, new Google permission or execution-policy change. Preview has its own chats/settings; original profile remains authoritative for the installed app.

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
