# SchoolWork 0.9.0 — Lesson Studio

## What changed

- Foreground process commands now close unused standard input, allowing commands that wait for end-of-input to finish. Windows PowerShell also retains its required module search path so it can initialize with the restricted child-process environment.

- Model selection updates immediately. Rapid selections save in order, stale settings responses cannot replace the latest choice, and a failed save restores the last confirmed model with an error message. Existing running tasks continue with their original model.
- **Följ lektion** opens a separate Swedish-first workspace with a timestamped transcript, structured summary, in-class tasks and future assignments. Notes persist across restarts. You can pause/continue capture, complete tasks, update the summary manually or automatically, export Markdown, and delete sessions.
- **Transkribera** gives a focused transcription view for the microphone or WAV/MP3/M4A/MP4/OGG/WebM/FLAC files under 25 MB. Swedish uses `kb-whisper-large`; the English button uses `faster-whisper-large-v3`. Whisper models are kept out of the chat model selector.
- Microphone recordings are complete, independent mono 16 kHz WAV segments, about 20 seconds each. Language changes wait until capture/upload finishes. Backpressure pauses capture; failed audio is retained for retry and successful audio is deleted. A cancelled transcription retains its audio. Transcripts and summaries stay in the local app database.
- The selected chat model generates summaries without executing tools. Assignment/task evidence must occur in the transcript. Summaries are suggestions to review, and automatic updates stop after a provider error until you retry.
- Google Calendar connects via desktop OAuth with a loopback callback, PKCE, state validation and encrypted credentials. Each assignment has a review screen for its title/date before an all-day Calendar event is written. Stable event IDs prevent duplicate writes on retry. Already-created Calendar events remain when local notes are deleted.

## Use it on your laptop

Close SchoolWork and run `SchoolWork-0.9.0-x64-setup.exe`. Use the installer to update the existing installation. The portable build is also available. The GitHub release includes the installer, portable build, checksums and complete in-app update files. Installed 0.8.1 builds can use **Settings → Check for updates**; the PowerShell installer now defaults to 0.9.0.

Your existing TeachGPT key is reused. Open **Följ lektion** in the sidebar, select Svenska or English, and start recording. Record with the teacher's and participants' permission; audio and transcript analysis go to school TeachGPT. Click **Pausa** and wait for pending audio before closing the app. Failed segments can be retried from the transcript column.

For Google Calendar, open its connection card. Enable Google Calendar API in a Google Cloud project, configure its OAuth consent screen, and create a **Desktop app** OAuth client. Add your account as a test user if required. Enter that client ID and client secret in SchoolWork's connection screen, then sign in with Google. Do not enter a TeachGPT key into these Google fields. Credentials belong in the app, never in chat or committed files. Testing-mode Google apps may require periodic reconnection. The app owner needs a production OAuth client before this can become a zero-setup feature for all users.

## Verification scope

The cloud run exercises real Electron UI/IPC, microphone capture from Chromium's synthetic input device, local persistence, and simulated remote TeachGPT and Google responses. It does not measure real microphone acoustics, school Whisper quality, school API permissions, live Google authentication, or Windows desktop automation.

The expected school audio API is `POST /api/v1/audio/transcriptions` with multipart file/model/language and a JSON `{text}` result. A read-only request with `Accept: application/json` received HTTP 401 from the school site on 2026-10-10. Authentication is required; that response does not verify the multipart contract or prove Whisper availability. An authenticated school-service check remains necessary. Unsupported routes and provider failures produce visible errors and retain the audio for retry.

For source validation: `npm test -- --maxWorkers=4`, `npm run build`, and `npm run test:lessons`. On headless Linux, supply an X display (`DISPLAY=:99` when Xvfb is running). The lesson fixture uses synthetic credentials in an isolated profile; its Linux-only plaintext-encryption and Chromium sandbox overrides are test-only and never enabled by the packaged app. Windows keeps Electron's normal OS-protected credential storage and renderer sandbox.

Windows packaging uses `npm run package:win`, which refuses a stale/missing desktop helper. On Linux a cross-compiler wrapper and Microsoft .NET Framework reference directory can be supplied via `SCHOOLWORK_CSC` and `SCHOOLWORK_FRAMEWORK_REFERENCES`. The Linux packaging script uses electron-builder's existing PE/NSIS uninstaller extractor for its temporary 32-bit generation stub, matching its macOS strategy. It retains the extractor's signature/size checks and builds the final installer through the normal NSIS target. No downloaded checksum or TLS verification is disabled, and `--publish never` prevents automatic publication.

After packaging, run `node scripts/verify-release.cjs release`; this checks installer/portable/blockmap/update-manifest presence and installer SHA-512. Windows install/uninstall, actual microphone and authenticated TeachGPT/Google checks are still required on the target laptop. A cloud package is not a claim that those live checks passed.
