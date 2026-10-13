# SchoolWork 0.11.0-beta.3 — real-time transcription and the classroom board

Beta Windows x64 installer and portable application are published as [v0.11.0-beta.3](https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.11.0-beta.3), built from the beta branch on top of the 0.10.1 main source. The release includes the installer blockmap, `beta.yml` update feed and SHA-256 checksums.

## Real-time transcription

- While the microphone is recording, the lesson studio can transcribe live over the school's TeachGPT **realtime** (Speaches) speech-to-text service: the microphone audio streams straight to the speech server over WebRTC and the words appear in the transcript card as they are spoken, marked with a pulsing live line.
- The existing file-based Whisper pipeline stays the final source of truth. The original beta.3 live client used the rejected `/api/v1/realtime` proxy path. Investigation on 13 October confirmed that the existing live relay accepts an API token with its normal CSRF session; [beta.4 fixes that connection and shared-microphone cleanup](release-0.11.0-beta.4.md).
- Realtime signalling is a single one-shot request through the TeachGPT API with your stored key; the audio itself never passes through SchoolWork.

## The classroom board (YeetCast)

- A new **Tavlan** panel in the lesson studio follows the school's YeetCast projector pages (yeet.ssis.nu). Set your projector's page URL once and SchoolWork shows whether a cast is running and who is casting.
- **Visa tavlan** opens a small floating always-on-top window with the active cast's read-only view. SchoolWork is a pure spectator: it only reads the public projector page and the read-only view stream — no sender or connection is ever created, so the cast is never disturbed.
- **Fotografera tavlan** captures the board to an image and stores it on the session. The latest captured board image is then attached automatically as context to the lesson AI: the summary (analyse), transcript tidying (refine) and the "ask about the lesson" assistant all see the board, which helps repair mis-transcribed words, names and formulas. Board images are only sent to models known to accept images; if a model rejects the image the request transparently retries without it.

## Channel

This is a prerelease on the beta channel (`beta.yml` feed). Stable users on `latest.yml` are unaffected. Binaries are unsigned.

## Validation

Unit tests for the new YeetCast page parser, the realtime envelope reassembly, and the board-image summary/retry paths; full Windows application build including the native desktop helper; the real-Electron lesson regression; and the tagged release workflow's Linux lesson/UI verification, Windows build, unit tests, packaging and uploaded-asset integrity checks.
