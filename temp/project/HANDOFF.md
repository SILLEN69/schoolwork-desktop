# SchoolWork beta handoff — 12 October 2026

## Start here

Repository: https://github.com/SILLEN69/schoolwork-desktop
Work branch: `beta`. Package version: `0.10.1-beta.5`.
This transfer publishes source and working media, not a new installer release or a main merge.
Read this document, `AGENT_PROGRESS.md`, `docs/development.md`, and `docs/google-verification-status.md` before making changes. Some older checkpoints describe an earlier state; the current source and this handoff take precedence.

The normal project at the repository root is the canonical working tree. `temp/project/` is a complete, frozen source snapshot, including the launch audio needed on another computer. Do not maintain two divergent implementations. Develop in the repository root on `beta`, and use the snapshot for recovery or standalone work.

Folder contents:

- `project/`: current tracked/untracked source, lockfiles, app startup assets, public media and documents. No dependencies, build output, credentials or personal profile.
- `videos/`: the finished local exports, including the latest Swedish 4K trailer and older variants. Older videos retain their original layouts and logos; filenames distinguish them.
- `video-assets/`: downloaded sound library, audio timing/cues and provenance needed to continue editing.
- `legacy-build-state.md`: historical project milestones, preserved as context rather than current acceptance proof.
- `FILE_MANIFEST.json`: SHA-256 and sizes for the snapshot, exports and supporting assets.
- `restore-launch-audio.ps1`: copies the two audio mixes from the snapshot into the normal project's ignored `public/launch-private` folder.

## Resume on another Windows computer

Use Git, Node 24 LTS/npm and Windows 11 x64. Native desktop builds also require the Windows .NET Framework 4.x x64 C# compiler; see `scripts/build-native.mjs`. Install dependencies from the lockfiles.

```powershell
git clone --branch beta https://github.com/SILLEN69/schoolwork-desktop.git
Set-Location schoolwork-desktop
npm ci
npm ci --prefix remotion-startup
& ./temp/restore-launch-audio.ps1
npm run build
npm run dev:app
```

The PowerShell helper can also be replaced by copying `temp/project/remotion-startup/public/launch-private/*.wav` to `remotion-startup/public/launch-private/` manually. Do not change machine-wide execution policy just for this copy operation.

`dev:app` uses the isolated `work/dev-profile`, not an installed user's profile. If the fixed development port is occupied, set `$env:SCHOOLWORK_DEV_PORT='0'`. Do not use `npm run dev` as a substitute for the Electron application; it only previews the renderer.

Installed credentials cannot be decrypted or transferred through Git. Set your TeachGPT key in Settings on the new computer. Do not commit keys, `.env`, browser sessions, personal conversations, databases or Google user tokens.

## What changed since the previously pushed beta

Eight already-created local commits are included in the push:

| Commit | Change | Main source locations |
| --- | --- | --- |
| `ad40165` | Recognize real verification commands, Windows command execution fixes and repeated-action recovery | `src/verification.ts`, `src/progressGuard.ts`, `electron/processTools.ts` |
| `44897b9` | Branded startup animation, skip/reduced-motion behavior and restrained UI motion | `src/ui/StartupIntro.tsx`, startup/motion CSS, `remotion-startup/`, `src/assets/` |
| `fe7689b` | Isolated reproducible development, native-build helpers, source/asset guard, CI | `scripts/start-dev.mjs`, `scripts/build-native.mjs`, `scripts/check-startup-assets.mjs`, `docs/development.md`, `.github/workflows/ci.yml` |
| `07e8091` | Stable pointer bubble displaying brief public assistant explanations | `electron/desktopPointer.ts`, `electron/desktop-pointer.html`, `electron/main.ts` |
| `c61ffbc` | Completion/error notifications, diagnostics, in-app fallback and conversation navigation | `electron/taskNotifications.ts`, `src/ui/TaskNotices.tsx`, preload/main |
| `8f2c598` | Simplified settings, removed notification-test UI, working startup replay and credential-error handling | `src/ui/App.tsx`, settings components, `electron/credentials.ts` |
| `efc9c08` | First landscape/portrait showcase, lesson/calendar/email/work scenes and timed audio | `remotion-startup/src/showcase/`, public audio and render scripts |
| `8f51f8f` | Improved green computer-use pointer in the video | `remotion-startup/src/showcase/Shared.tsx`, `Email.tsx` |

Additional source changes included with this handoff:

- New 34-second landscape launch ad in English and Swedish. Eight scenes: Hook, Reveal, Lesson, Calendar, Ask, Email, Work, Close. Both are registered in `remotion-startup/src/Root.tsx` with separately registered scene compositions.
- Added the atom logo/vector and Apache-2.0 notice. It follows the user's supplied taskbar reference and derives from the Electron logo. Keep its license and do not describe it as wholly original SchoolWork artwork.
- Replaced all old green launch-ad logos with that atom mark; removed the oversized green-block visual defect.
- Swedish text throughout the launch scenes. Main composition IDs: `SchoolWorkLaunchAd` and `SchoolWorkLaunchAdSwedish`.
- Fixed blank Studio previews by using a plain scene shell rather than letting Studio treat the nested scene shell as editable text. Formatted JSX so source mapping and selection work.
- Replaced mapped sequence instances with eight directly named `Series.Sequence` elements so each scene has a usable connected timeline.
- Added interactive title spans in both languages. Swedish conditional headings have stable, distinct React keys to prevent Studio reusing one heading's source/overrides for another.
- Swedish closing scene exposes logo, SchoolWork title, slogan and requirement text as interactive layers. The green beta-access call-to-action was subsequently removed, as requested.
- Swedish 4K export: `temp/videos/SchoolWork-Reklam-Svenska-4K.mp4`, 3840x2160, 30 fps, 1020 frames, approximately 34 seconds, with music and stock effects. The prior 1080p file still contains the older green CTA.
- Startup composition now uses the user's current 3840x2160 / 45 fps / 96-frame settings. The original 1280x720 design plane scales uniformly by 3x and stays centered. Runtime scaling also handles other canvas dimensions.
- Refreshed the app's startup MP4, poster and hash manifest from current source during this transfer so the next build is not blocked by stale assets.

## Product context and boundaries

SchoolWork is an Electron/React/TypeScript Windows assistant with TeachGPT inference, durable task/conversation state, files/processes, browser/desktop tools, project memory, lessons and optional connections. It is not identical to proprietary ChatGPT Work. Current model availability/capabilities must be checked against the configured school endpoint.

All application inference stays on TeachGPT. Preserve the user's selected model: no automatic provider/model switch, no direct OpenAI inference fallback, no paid API purchase. Long Qwen requests need qualified SSE streaming; non-streaming can hit the upstream Apache gateway around 30 seconds even with a longer client timeout. Buffer and validate complete tool calls; never execute partial stream JSON, length-truncated responses or raw model text.

Relevant areas: `src/provider.ts`, `src/core.ts`, `src/agentRequest.ts`, `src/progressGuard.ts`, `src/verification.ts`, `electron/storage.ts`, `electron/projectTools.ts`, `electron/processTools.ts`, `electron/memory.ts`, `electron/lessons.ts`, `electron/desktopTools.ts`, `electron/connections.ts` and `src/ui/`.

Owner preferences:

- Work autonomously, inspect the failure before patching, preserve work and report blockers honestly.
- Beta work stays on beta until a deliberate main merge/release.
- Full-user file/command access is a Windows-user permission profile, not a secure arbitrary-command sandbox or administrator privilege.
- Pointer bubble: a small transparent speech bubble, brief public assistant explanation only. No tool names, commands, coordinates, raw private reasoning or idle-gap flicker. Detailed tool activity belongs in the app timeline.
- Native desktop input still shares the foreground Windows desktop; the overlay does not create a second independent OS mouse. Hide the overlay during observation/hit testing so it cannot contaminate screenshots.
- Notifications must trace an actual completed/error task. Electron accepting a notification does not prove Windows displayed a banner; Focus/Do Not Disturb and system settings matter. Keep a reliable in-app fallback.
- Avoid UI clutter. The notification test was removed from Settings at the user's request. Explicit startup replay should work even if automatic startup honors reduced motion.
- Google write scopes were deferred. Do not add Calendar/Gmail/Drive write permissions merely because an animated trailer shows a send/save action.
- Keep secret filtering targeted. Earlier generic 32-character redaction broke legitimate Gist URLs and temp script names. Preserve real tool arguments for validated execution, while filtering known credentials at logging/context boundaries.

## Remotion editing and rendering

```powershell
npm run animation:studio
```

Use the port Studio prints. Open `SchoolWorkLaunchAdSwedish`, then double-click a named scene to edit its own timeline (`LaunchAd-Sv-Hook` through `LaunchAd-Sv-Close`). Select an interactive layer to change text, font size, color, transform or supported inline keyframes. Procedural SVG orbits, pointer paths, typed text, some app mockup contents and mathematical animation helpers still require source editing. Do not claim every pixel is editable through the inspector.

The 34s launch ad is authored at 1920x1080. Render at scale 2 for 4K; changing its width/height alone will not scale absolute-positioned content:

```powershell
Set-Location remotion-startup
npx remotion render src/index.ts SchoolWorkLaunchAdSwedish out/SchoolWork-Reklam-Svenska-4K.mp4 --scale=2 --codec=h264 --crf=17 --concurrency=2 --audio-bitrate=192k
```

The startup is already authored as a responsive 4K composition; render it without an additional scale=2. After changing startup source or Root registration, run `npm run animation:render` from the repository root to refresh the app assets and manifest. Do not fake the manifest hashes without rendering.

Launch music is the user-supplied Ali-A intro track. The export fades after the approximately 33-second drop and finishes at 34 seconds. The two prepared WAV mixes are included in the snapshot for continuation; availability here is not proof of third-party music rights for advertising. Source effects are downloaded Kenney/Mixkit assets with provenance in `video-assets/`; they are not model-generated effects. The older showcase uses a separate original audio mix.

`render-launch-ad.mjs` renders 1080p and trims the output; `verify-launch-ad.mjs` currently asserts 1080p. Do not run that verifier unchanged against a 4K export. `make-audio.mjs` / `make-chime.mjs` are earlier optional experiments with fixture paths; the packaged startup playback is muted and prepared launch mixes are sufficient to render the ads. Do not infer those optional synthesis scripts created the current stock-effects mix.

## Build, main merge and installer release

1. Start from `beta` at this handoff. Inspect current source and instructions; preserve later user edits. Work in a feature branch if useful.
2. Configure TeachGPT locally. Publisher Google configuration comes from `SCHOOLWORK_GOOGLE_CLIENT_ID` and `SCHOOLWORK_GOOGLE_CLIENT_SECRET`; release builds also set `SCHOOLWORK_GOOGLE_REQUIRED=1`. Use existing GitHub Actions variable/secret settings, never source files. A development build can omit them but shared Google sign-in will be unavailable.
3. `npm run build` creates renderer, Electron bundles and the Windows helper. `npm run package:win` creates NSIS and portable binaries without publishing. Build output and installers are not source snapshots.
4. Before a main release, deliberately run the appropriate checks on the finished feature and review the relevant Windows behavior. The user requested no tests during this transfer; that is not a claim that this combined state passed release acceptance.
5. When the owner is ready to promote, merge/review beta against main. Resolve conflicts using final implementations, especially provider/tool-history/recovery semantics. Keep application ID `nu.ssis.schoolwork`, preserve chats/settings/credentials and never force-close an active user's task to install.
6. Set a deliberate package version. A release tag must be exactly `v<package.json version>`. Beta/pre-release and stable update manifests differ; consult `scripts/release-config.cjs` and `scripts/verify-release.cjs`.
7. `.github/workflows/release.yml` runs on `v*` tag pushes, builds/tests/packages, verifies integrity and publishes. A branch push alone creates no installer. Do not tag or trigger a release merely to save source.

## Verification and unresolved work

No test suite, lint, new application build, installer publication or main merge was run for this transfer. Startup media generation and source/asset manifest refresh were performed; they are not app acceptance tests. The push commit uses `[skip ci]` so branch-push CI tests are skipped.

Earlier focused work passed checks documented in `AGENT_PROGRESS.md`; distinguish historical evidence from the latest combined snapshot. Studio title editing/closing-layer controls were observed, and the new Swedish 4K file was probed and its ending visually inspected. No current clean-machine installation or live cross-account OAuth acceptance was established.

Known remaining prerequisites/limits:

- Google review was pending in the status document last checked 11 October. Homepage ownership had been verified, but branding/scope approval and real two-account access were not established. Refresh Cloud Console before making current claims; Production does not mean verified.
- This transfer does not contain another computer's credentials, personal SQLite conversations, browser cookies, API keys or app userData. Reconfigure them locally; do not copy protected ciphertext and expect it to decrypt.
- Final binaries remain unsigned unless real signing credentials are supplied.
- The startup is now about 2.13s at 45fps; older docs/tests may assume 3.2s at 30fps. Review those expectations before the next release, and retain skip, ended/error fallback and the app's hard exit deadline.
- The pointer overlay cannot provide independent simultaneous mouse control on the shared desktop.
- Native notification acceptance and in-app fallback are documented; visible banner receipt remains dependent on Windows configuration and needs real user-flow evidence.
- Voice/image/video services, broad autonomous office production, scheduling and cloud synchronization were separate larger-scope items; inspect current capabilities before promising them.
- Generated `node_modules`, dist folders, legacy installer trees, caches, bundles, raw intermediate encodes and private app profiles are deliberately omitted. Rebuild dependencies/binaries; existing public installers are available under GitHub Releases. Final media/source assets needed for continued editing are included.

## Ready-to-paste prompt for the next agent

Read `temp/HANDOFF.md` and the current project instructions. Work from the root `beta` source (not two separate copies). Inspect Git status and the implementations before changing them. Continue the owner's requested new feature, preserve TeachGPT inference/model selection, task recovery, secrets, chats and Windows app identity. Use `temp/project/` only as a recovery snapshot. Restore launch audio if editing videos. Do not treat animated Gmail/Calendar screens or old test summaries as live application proof. Keep code and assets synchronized, make narrow patches, and run only checks authorized for the new work. Prepare a concrete main merge/build when the owner requests it; do not silently merge, tag or release. Record exact changes, verification and blockers for the next handoff.
