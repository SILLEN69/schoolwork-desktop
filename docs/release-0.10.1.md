# SchoolWork 0.10.1 — integrated beta promotion

This document describes the stable-version source promoted from beta. Installer publication is a separate tagged operation; the current public stable installer remains v0.10.0 until that publication occurs.

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

Remote TeachGPT, Telegram and Google traffic is simulated in those application regressions. Live account acceptance, visible Windows banner receipt and clean-machine installation remain separate checks. Binaries are unsigned. No installed user profile or active installed task is replaced by source validation.
