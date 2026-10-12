# SchoolWork v0.3.0 build state

## Next version: pointer bubble correction requested (2026-10-11)

- User asks the bubble to show only the assistant's brief public explanation of its intended action/decision. Remove tool names, coordinates and tool-status text from the bubble; tool activity remains in the app timeline. Do not expose private reasoning or invent commentary when no public explanation is available.
- Investigate reported one-second disappearing/reappearing behavior. Keep the bubble visually stable through short idle/thinking gaps while preserving Stop/cancel and screenshot exclusion. Avoid weakening observation correctness just to hide flicker.
- Saved for next beta; not implemented in v0.10.1-beta.5. No new build or release requested this turn.

## Next beta: user reports missing completion toast (2026-10-11)

- User screenshot shows the successful assistant answer “done bro — scrolled the feed…” displayed in the chat, but Windows showed no notification.
- Trace completed answer → persisted task state → notification eligibility → Electron show/failure → actual Windows banner. The beta.5 smoke test confirmed Electron's `show` event only; it did not prove the user received a visible notification. Find and fix actual delivery; retain error notifications. Test with SchoolWork open and check app/Windows notification settings and event timing.
- The screenshot does not identify the installed version or Windows Focus/notification configuration. Establish those facts during reproduction; do not assume the previous test proved actual delivery.
- Explicitly saved for next beta. Do not apply an immediate code change for this reminder.

## Latest: quick beta task notifications (2026-10-11, v0.10.1-beta.5)

- Added Windows completion and stopped-error notifications from persisted task states; no transient retry/tool-error spam. Duplicate outcomes are suppressed, a new resumed outcome can notify again, and clicking brings SchoolWork forward. Generic localized text excludes task content/credentials. Notification failure cannot change task progress.
- Windows application ID explicitly matches existing installer ID nu.ssis.schoolwork. Google scopes, data migration and agent permissions unchanged.
- User explicitly requested quick beta with notification-specific tests only. Two focused notification tests pass; actual Electron notification smoke run confirmed Windows accepted both answer and error notifications. Normal TypeScript/build and installer/portable compilation passed. No wider application tests/package acceptance run.
- Published beta commit aefbabf and tag v0.10.1-beta.5 with [skip ci], avoiding the full test workflow as requested. Local installer/portable/blockmap/beta.yml and generated SHA-256 manifest uploaded directly through existing GitHub authentication (credentials never persisted/logged). Public prerelease: https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.10.1-beta.5 . Installer and portable public download HEAD checks both return HTTP 200. No wider acceptance or full-download verification performed. No main merge and no forced installed-app closure.

## Latest: beta screen pointer and sidebar repair (2026-10-11, v0.10.1-beta.4)

- Added a click-through, transparent SchoolWork cursor overlay with smooth motion, click pulse, bounded resizing speech bubble and brief public assistant output. No private reasoning is displayed. No Google scopes or agent write permissions changed.
- Pointer is task-owned, hidden throughout observations (including composer screenshots and concurrent status updates), and destroyed on Stop, cancellation, task completion and window closure. Its isolated renderer has a one-way display subscription only. JSON tool protocol text is excluded from the bubble.
- Native desktop input still uses foreground Windows input. Click/scroll returns the owner's pointer to its previous position only if it has not been moved by the user. This is not an independent OS cursor or isolated browser; user was informed of the difference.
- Sidebar history now scrolls in its own remaining area, preserves navigation/folder/settings, stays open when selecting chats, and has usable space at minimum window size. Collapsed sidebar hides the lesson label; long tool labels expose full text in expanded activity/tooltip.
- Passed: 166 unit tests, 4 release checks, full TypeScript/native build, real Windows capture/click/Unicode/key/scroll/UI Automation and native/JSON task loops, 12 Electron lesson/model checks. Remote model/Google transport is simulated for these integration tests.
- UI regression: 45 valid-UUID recent chats, two sizes, no overlap, accessible last chat, collapsed label hidden, transparent bubble grows and fits bounded long text, no focus theft, observation stays hidden during updates/timer, Stop and cancellation close overlay.
- Local installer/portable/blockmap/beta.yml integrity checks pass; SHA-256 manifest saved. Extracted package contains pointer HTML/preload and no test module or user credentials/databases. Isolated packaged startup reports publisher Google configuration, correct version and no renderer errors. Packaged integration restores synthetic SQLite/images and verifies bundled helper capture/KaTeX. Authenticode: unsigned.
- Commit 5f7ca7300acf7eadcd16ad028815f52e496fae76 pushed to beta; tag v0.10.1-beta.4 pushed. GitHub release workflow 38171814152 completed successfully. Public prerelease is published (prerelease=true, draft=false): https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.10.1-beta.4 . Anonymous installer and portable download HEAD requests both return HTTP 200 with nonzero content lengths. User narrowed final verification to checking download links only; no additional full public downloads/hash checks were performed. Main remains c56eb97; no merge performed.
- No installed app or active user task was closed, and no merge to main performed. Google approval/live consent and clean-machine upgrade remain pending.

## Latest: beta publication requested (2026-10-11, v0.10.1-beta.3)

- Created and pushed beta branch; no merge into main. Main remains c56eb97 with the earlier Google work; Google application changes were already on main before this beta-only request. Stable public release remains v0.10.0.
- Release publishing now distinguishes prerelease vs stable, selects beta.yml, uses --latest=false, validates uploaded hashes, and keeps beta out of stable automatic updates.
- Failed beta.1 and beta.2 build attempts never created public releases. Local verification caught the GitHub provider's default latest manifest; electron-builder's mergePublish expects a provider object override, not an array. Added integration regression against its actual config merge/schema.
- v0.10.1-beta.3 local installer/portable/blockmap/beta.yml integrity checks pass. Packaged app starts in a separate empty profile, reports publisher Google configuration, correct version, no renderer errors, and no included credential/user database files. Authenticode confirms unsigned. Installed user app was not stopped or upgraded.
- Checks: 161 app tests and 4 release checks pass. GitHub release run 38168844166 completed successfully (Linux Electron workflows and Windows build/tests/package/publication).
- Published public prerelease https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.10.1-beta.3 . Anonymous installer, portable, blockmap and beta.yml downloads all match the release SHA-256 manifest and GitHub asset digests. Public release page returns 200; prerelease=true, draft=false; no latest.yml asset; stable latest remains v0.10.0.
- Beta branch is 3c90ff1; published tag is 63710d9 (the following branch commit only makes the regression test independent of future package versions). Main remains c56eb97. Working tree is clean; no automatic merge or installation.
- Google branding/scope approval, live account authorization, multi-account access, and clean-machine acceptance remain pending; release notes disclose this. Do not claim Google approval or unrestricted access.

## Latest: shared Google sign-in and approval setup (2026-10-11, v0.10.1)

- Pulled current GitHub main before editing. Shared Desktop OAuth client is injected only into the privileged build; private publisher JSON is ignored. Existing app ID, chats, settings, custom Google credentials, and local user-token storage are preserved.
- Primary Google button opens the browser without per-user client configuration. Added PKCE callback cancellation/generation checks, encrypted grants, optional Drive disclosure, privacy link, and release CI credential provisioning.
- Google Cloud schoolwork-desktop: Calendar and Drive APIs enabled, external audience, registered scopes, homepage/privacy URLs, shared Desktop client, AI-agent designation, and Production publication completed with user approval.
- GitHub Pages main/docs deployed; Search Console explicitly confirmed homepage ownership. Branding check still reports ownership unavailable and explicitly requires waiting 24 hours for propagation. Earliest retry: 2026-10-12 after approximately 21:17 Europe/Stockholm. Do not repeatedly retry early or claim Google approval.
- Next: retry branding once after propagation, then continue Verification Center scope application. No scope submission yet. Google-data processing terms for TeachGPT and any required demo/security assessment remain prerequisites for truthful review. No automatic scheduled retry was created.
- Checks: 161 tests pass; complete TypeScript check/build pass; 12 Electron workflow checks pass, including primary sign-in without custom setup. OAuth network responses are mocked; live account consent and two-account availability remain untested.
- Built local unsigned SchoolWork-0.10.1-x64-setup.exe and portable.exe; release manifest/SHA512 verification passes. No installed instance was stopped or upgraded. Clean-machine verification and public v0.10.1 release remain pending.
- Public progress: docs/google-verification-status.md. Browser proof saved under ignored work/google-login. No credentials or user tokens recorded in this checkpoint.

## Latest: project execution tools and UI redesign (2026-10-05)

- Added project_map, find_files, bounded read_files, literal search pagination, hash-checked edit_file, atomic backups, and full-user file access selected in Settings. Credential files and environment files remain excluded from model context.
- Added direct run_process, app-owned start_process/read_process/stop_process sessions, streamed output, child-tree cleanup, and PowerShell command mode without temporary script files or execution-policy changes.
- Added isolated localhost check_preview with optional selector click and expected-text assertions.
- Added persistent plan milestones, real verification-command matching, paired activity cards, safe Markdown rendering, file browser/reader, localhost preview panel, scroll anchoring, and clearer timers/status.
- Live TeachGPT Qwen3.8-27B repair cycle passed: project_map → read_files → edit_file → node test, with a verified final answer in 5 turns.
- Verification: full suite passes (52 tests); `npm run build` passes; Windows x64 NSIS and portable packages built as v0.3.0. Packages are unsigned. Existing SchoolWork instances were not stopped or overwritten.

## Latest: rank only the live TeachGPT model list (2026-10-05)

- Model refresh now keeps only identifiers returned by TeachGPT; the current persisted selection is retained only so it remains selectable if the provider temporarily omits it.
- Verification: full suite passes (42 tests); `npm run build` passes.
- Built v0.2.5 Windows x64 NSIS installer and portable package. SHA-256 values are in `release/SHA256SUMS-v0.2.5.txt`. Packages are unsigned. Existing SchoolWork instances were not stopped or overwritten; clean-machine upgrade not performed.

## Latest: persistent and per-stage timers plus TeachGPT model ranking (2026-10-05)

- Added a total task stopwatch that continues across model turns and tool actions, plus a separate current-stage timer that resets when the activity phase, tool, retry, or task changes.
- Added TeachGPT-only model ordering in Settings using matched Artificial Analysis Intelligence Index values. Qwen3.8-27B is represented by the published Qwen3.8 27B xhigh score (34); gpt-oss-120b high (12), low (10), and Meta-Llama/Llama 3.3 70B (8) are matched where available. Unmatched TeachGPT models are labeled `Not ranked` rather than guessed.
- Added unit coverage for model ranking and aliases. Verification: full suite passes (42 tests); `npm run build` passes.
- Built v0.2.4 Windows x64 NSIS installer and portable package. SHA-256 values are in `release/SHA256SUMS-v0.2.4.txt`. Packages are unsigned. Existing SchoolWork instances were not stopped or overwritten; clean-machine upgrade not performed.

## Latest: prevent secret redaction from corrupting URLs (2026-10-05)

- Cause: a generic redaction pattern treated any 32+ character alphanumeric/underscore/hyphen string as a secret. Opaque identifiers in URLs (including Gist IDs) were replaced with `[redacted secret]`, producing invalid browser URLs. Tool argument JSON was also redacted before parsing, so the mutation could affect the action itself.
- Fix: removed the length-only secret pattern; retained explicit credential-label, Bearer-token, and private-key patterns. Parse and validate original tool-call arguments for execution; keep redaction at persistence/context boundaries.
- Regression coverage: long GitHub Gist identifier remains intact, while labeled API keys and Bearer tokens still redact.
- Verification: focused memory suite passes (4 tests); full suite passes (40 tests); `npm run build` passes.
- Built v0.2.2 Windows x64 NSIS installer and portable package. SHA-256 values are in `release/SHA256SUMS-v0.2.2.txt`. Packages are unsigned. Existing SchoolWork instances were not stopped or overwritten; clean-machine upgrade not performed.

## Delivery: public v0.3.0 release (2026-10-05)

- Commit `1e1e456` pushed to `main`; tag `v0.3.0` pushed.
- Public release: https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.3.0
- Uploaded installer, portable package, and `SHA256SUMS-v0.3.0.txt`.
- Public HEAD checks returned 200 with expected byte lengths. Remote checksum file matches locally computed SHA-256 values.
- No `.env`, API key, or private logs were included. Packages remain unsigned because no signing certificate is configured.

Notifications completed locally on beta: terminal outcome notices, native delivery diagnostics/retry, correct conversation navigation, taskbar attention and Settings test/help. Focused notification unit tests, app build and isolated real Electron/native Windows acceptance passed. Windows banner visibility remains subject to OS notification/Do Not Disturb settings. No publish, push, release, merge or personal-profile installation; stop as requested.
