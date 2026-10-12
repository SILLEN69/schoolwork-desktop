# SchoolWork 0.10.1 — integrated beta promotion

The stable Windows x64 installer and portable application are published as [v0.10.1](https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.10.1), built from validated main source. The release includes the installer blockmap, `latest.yml` update feed and SHA-256 checksums.

- The startup shows the centered local atom logo and wordmark without a visible Skip intro button. Escape, media completion/error exit, the hard timeout and reduced-motion behavior remain available. Explicit Settings replay still plays the video.
- Desktop pointer explanations contain public assistant text only, remain stable between actions and stay hidden during capture/native input. Stop/cancellation/completion remove the overlay.
- Completed/error tasks have notifications, delivery diagnostics and dismissible in-app fallback notices that open the matching conversation.
- Windows batch commands, directory-prefixed verification and repeated-read recovery work through the existing durable task journal. Later failed checks remain failures after restart.
- Lessons, dictation, safe-step task steering, attachments, model selection, Google Calendar and optional Drive/MCP workflows are preserved.
- Source development uses an isolated profile and checks startup source/asset consistency before building. OpenCode commands are included for source contributors.

## Google availability

Live Google Cloud inspection on 12 October shows External / In production, with 1 user out of the 100-user cap. Branding and sensitive/restricted data access remain unverified; the previous homepage-ownership issue still requires branding re-verification. Production status is not unrestricted Google approval. See [current status](google-verification-status.md).

Release builds must use the provisioned publisher Google Desktop client through the existing Actions variable/secret. Development builds without it disclose unavailable shared sign-in and preserve custom connections.

## Validation

The integrated source passed 176 unit tests, six release/asset/native-build checks, the full Windows application build and real isolated Electron regressions for startup/reduced motion, model selection, lessons/audio, reviewed Calendar writes, dictation/steering, pointer/sidebar behavior, notifications, agent recovery and the development launcher. Native Windows desktop integration passed capture, clicks, Unicode typing, keys, scrolling, UI Automation, two-monitor checks and Stop.

The tagged release workflow passed Linux lesson/UI verification and Windows build, unit tests, packaging and uploaded-asset integrity checks. Public verification on 13 October 2026 confirmed that all five installer/update assets return HTTP 200, their SHA-256 digests match GitHub and the checksum manifest, and `latest.yml` matches the installer SHA-512. A simulated v0.10.0 installation discovered v0.10.1 and downloaded the exact public installer. Installer SHA-256: `7d1370e05e154c98f1b5ee4185608acbababe7e35c66c118b923540f55f2b32f`.

Remote TeachGPT, Telegram and Google traffic is simulated in those application regressions. Live account acceptance, visible Windows banner receipt and clean-machine installation remain separate checks. Binaries are unsigned. No installed user profile or active installed task is replaced by source validation.
