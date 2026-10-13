# Autonomous engineering checkpoint

## TeachGPT Realtime fixed and beta.4 published — 13 October 2026

- Realtime already exists. The earlier `/api/v1/realtime` probe hit the API proxy's route rejection; it did not establish that the speech service was missing. The existing Sanctum-protected `/audio/live/signal` route accepts an API bearer token together with its normal CSRF cookie pair. No website password/login or school server patch is required. Read `docs/teachgpt-realtime.md` before changing this integration.
- The desktop main process fetches the protected `/audio` configuration, resolves full KBLab/Systran speech model IDs and fresh STUN/TURN settings, then relays SDP with paired bearer/cookie/CSRF authentication. Pending HTTP operations cancel on Stop. Live teardown closes the peer without stopping the recorder's shared microphone; fragment duplicates and stale callbacks are guarded.
- Real Electron/WebRTC tests against both deployed ASR models returned synthetic speech transcripts. The actual lesson UI displayed `Solve exercise 3` from the real KBLab service, then paused successfully with recorded-file transcription intact (the file/summary/Google fixture responses are simulated). All 196 unit tests, six release/asset/native-build checks, full Windows build and 13 lesson/model UI checks passed.
- Published prerelease `v0.11.0-beta.4` from `df11ada8621ceb5cc47c20c5116adc699ef031f3`. Beta branch CI `38370161034` and release workflow `38370164101` passed. Installer, portable app, blockmap, `beta.yml` and SHA-256 manifest all downloaded publicly with HTTP 200 and verified hashes; a beta-feed audit from simulated beta.3 downloaded the identical installer. Installer SHA-256: `051b8ac204c7beedcb1e26dc01a1327d8a7cd97bbcfaae34acf421c872e6ae97`.
- Use the beta.4 installer download for this update. Stable remains v0.10.1; no main merge, installed-profile replacement, new Google permission or personal provider/model change occurred. Historical checkpoints below describe their dated state.

## Beta-to-main promotion — 12 October 2026

- Owner requests integrating beta into main, removing the visible startup Skip intro button, checking current Google OAuth publication and validating the combined app. This supersedes earlier beta-only/no-merge scope for this promotion; installer publication remains a separate tagged operation.
- Preserved all five newer local OpenCode setup/checkpoint commits. Set package/lockfile to stable source version 0.10.1 and added current source notes. Existing public stable downloads and install script now consistently reference the published v0.10.0, rather than an unpublished installer.
- Removed the intro button/CSS. The accessible dialog receives focus and retains Escape, ended/error exits, the hard deadline, reduced motion and explicit replay. The regression asserts no visible button and captures the current 2.13-second clip while playing. Isolated script fixtures now report the SchoolWork package version instead of Electron's version.
- Passed: full Windows build; 176 unit tests; six release/asset/native-build checks; Electron motion, 12 lesson/model/audio/OAuth/Calendar/dictation/steering checks, pointer/sidebar, notification routing/fallback, agent recovery and development-launcher regressions. Real native Windows integration passed on two monitors, including capture/click/Unicode/key/scroll/UI Automation, bounded loops, saved history/attachments and Stop. Remote provider/Telegram/Google traffic in application regressions is simulated.
- Visually inspected the button-free centered intro, narrow chat/sidebar, lessons/transcript and Settings. No clipping or renderer errors found in these captures. Existing chunk-size/dependency-comment warnings remain.
- Local 0.10.1 installer/portable/blockmap/latest.yml packaging and installer SHA-512 integrity checks pass. This development build has no publisher Google configuration, so it is not a public shared-sign-in package. Existing release Actions retain the publisher configuration requirement. Installed SchoolWork and its user profile were preserved.
- Live Google Cloud: SchoolWork Desktop is External / In production, with 1/100 unverified-app users. Branding/data access are unverified; branding still shows the previous homepage-ownership issue and requires re-verification. No Cloud permissions/client/review settings were changed. See docs/google-verification-status.md.
- Promotion uses a reviewed PR and fresh CI results; no skip-ci marker is added and no release tag is pushed.
- PR #3's first Linux checks passed; hosted Windows hit the batch-launcher test's 5-second Vitest deadline before its own 10-second command budget. The test now allows 30 seconds including cold PowerShell startup/cleanup, with exit-status/literal-argument/injection assertions unchanged. SchoolWork's current Desktop OAuth client is already marked for an AI-powered agent. Concurrent uncommitted animation/agent-skill files are preserved and excluded from this promotion.

## OpenCode environment setup checkpoint — 12 October 2026

- Set up the personal OpenCode (v2.0.27) environment for this repository. GitHub CLI 2.102.0 installed via winget; `gh auth login --web` completed for SILLEN69 (https protocol, token in keyring); `gh auth setup-git` configured. Repository access verified read-only (push/admin permissions, `git ls-remote`); no verification commit was published.
- Added `.opencode/opencode.json` (V2 permissions: external directories for OpenCode config/data/scratch, project read/edit, `git`/`gh`/`npm`/`npx`/`node` shell, subagent) and eight Build-agent commands under `.opencode/commands/`: `/status`, `/check`, `/push-beta`, `/installer`, `/release-beta`, `/promote`, `/release-stable`, `/memory-status`. Invoking a command authorizes its named operation; remote pushes, main merges, release tags and publication stay reserved for the named commands.
- Verified on this machine: `npm ci` (480 packages; Electron binary verified via `node node_modules/electron/install.js`), `npm run build` exit 0, `npm test` 176/176 in 29 files, `node --test scripts/check-release-config.cjs scripts/check-startup-assets.test.mjs scripts/build-native.test.mjs` pass, `check:release` 4/4, `check:startup` 2/2. `npm run package:win` produced setup (114.64 MB), portable (114.42 MB), blockmap and `beta.yml`; `node scripts/verify-release.cjs release` PASS (installer SHA-512 matches). SHA-256: setup `EEE0737D94C6B3AECA0DC356FBA42369E5E28C9CA6665773F87830CC06033EC6`, portable `896BC10A783E5AE10CFF2BAC0DCF1EEAD467ECF74603FF3F0E57D04D99B1190`.
- Reproduced and repaired the known startup regression: `scripts/test-ui-motion.mjs:18` waited for `currentTime >= 2.25` while the 96-frame/45fps clip is 2.134s (verified via MP4 mvhd: timescale 1000, duration 2134), timing out at 30s. The expectation now requires playback to reach the end of the current clip (`ended` or within 50ms of duration); `test:motion` passes. App behavior is unchanged: skip, ended/error fallback and the 4.2s hard deadline are retained.
- Local development build discloses Google sign-in not provisioned (no publisher configuration on this machine; expected). Release prerequisites exist in the repository: variable `SCHOOLWORK_GOOGLE_CLIENT_ID` and secret `SCHOOLWORK_GOOGLE_CLIENT_SECRET` (names verified, values not read). Binaries remain unsigned.
- `opencode run --standalone` from the repository loads user + project config and commands end-to-end. `teachgpt/Qwen3.8-27B` (owner-selected model) responds OK. The configured default `teachgpt/Meta-Llama-3.3-70B-Instruct-AWQ` currently fails tool-calling requests at the gateway: `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set` (hosted vLLM group) — a server-side configuration gap, not a local defect. Owner instruction: use Qwen 3.8 27B.
- Personal memory (opencode-mem v2.3.0) installed and verified. Embeddings: requested `mge-m3` is rejected by TeachGPT (400 "Invalid model name"); verified identifier is `bge-m3` (200, OpenAI format, 1024-dim finite vectors, EN+SV, ~180ms). API key lives in an ACL-restricted `teachgpt-api-key.txt` referenced via `file://` (never printed). Extraction/summarization uses `Qwen3.8-27B` (tool_choice verified); Llama 3.3 70B is rejected upstream for tool_choice and is not usable for extraction. Config: global `~/.config/opencode/opencode-mem.jsonc` (loopback viewer 127.0.0.1:4747, project-scoped default, bounded retrieval, auto-capture on, user profile). Verified live: add EN+SV memories, semantic retrieval by paraphrase (0.70 EN, 0.62 SV), threshold filters off-topic queries, project isolation via path-hash shards, persistence in a fresh `opencode run --standalone` session (recalled both scratch memories; 1024-dim bge-m3 vectors confirmed in store), prompt capture active, viewer HTTP 200. Temp test memories removed (production store empty). One caveat: the currently running OpenCode service (started before the config existed) initialized the plugin with defaults (local nomic 768-dim, auto-capture off) and has no config watcher — it must be restarted (`opencode service restart`) to load bge-m3 + auto-capture; the 768-dim test vectors were deleted before restart to keep the production shard dimension-consistent.
- User-config default model switched from Llama 3.3 70B to `teachgpt/Qwen3.8-27B` per owner instruction (backup in `C:\Users\elias\AppData\Local\Temp\opencode\backups\20261012-215933`); standalone run without `-m` confirms the new default responds.
- Post-restart follow-up (same day): standalone verification runs from the scratch directory had registered it as the service's `global` project; because the plugin keeps one module-level config, that scratch `storagePath` override hijacked the live memory tool after the first restart. Fixed by deleting the two scratch `.opencode/opencode-mem.jsonc` overrides (copies kept in the backup folder) and `opencode reload` — memory tool is back on the production store. Auto-capture was then observed working live: a pending prompt was summarized by Qwen3.8-27B and persisted as a memory, and user-profile-learning started (3/10 captured prompts). The old 768-dim test vectors left the production shard flagged for a dimension mismatch (768 stored vs 1024 configured); the shard file (test data only) was replaced with a fresh schema and `embedding_dimensions=1024` metadata, but the plugin's schema-version marker (`PRAGMA user_version`) had to be set to 2 while the service was stopped (Windows single-process DB ownership) via a scheduled-task helper. **Final state verified:** production store `~/.opencode-mem/data` active on the service; live add writes 1024-dim bge-m3 vectors (confirmed in shard DB); semantic search hits paraphrased queries (0.69) and the 0.6 threshold still filters weak matches; auto-capture ready (earlier observed persisting a summarized memory via Qwen3.8-27B); viewer HTTP 200 on 127.0.0.1:4747; all temp test memories removed (production store empty); scratch verification store and the unused 523MB local nomic ONNX cache deleted.
- No push, tag, release, merge or publication. Remote actions remain reserved for the named commands.

## Transfer checkpoint — 12 October 2026

- Owner now authorizes pushing all current beta source and media for continuation on another PC. This supersedes the earlier no-publication instruction for this source transfer only; no main merge, tag or installer release is requested.
- Read `temp/HANDOFF.md`: all eight previously local commits, latest English/Swedish launch-ad changes, interactive scenes, CTA removal and startup 4K scaling are captured there.
- Refreshed the current 3840x2160/45fps startup MP4, poster and source/asset manifest. `temp/project/` is a complete frozen source snapshot including working launch WAVs; `temp/videos/` holds finished exports; credentials and user profiles are excluded.
- Vitest excludes `temp/**` to prevent duplicate snapshot tests being discovered during future work. No tests, lint or application/installer builds are run for this transfer. Push uses `[skip ci]`.
- Canonical development stays at the repository root on beta. Future main merge/build/release instructions, prerequisites and evidence limits are in the handoff. Snapshot is for recovery, not a second implementation.

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
