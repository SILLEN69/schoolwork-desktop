# SchoolWork 0.10.1-beta.4 — visible screen actions and readable recent chats

This opt-in beta is published from `beta`. It has not been merged into `main`, and stable automatic updates remain on v0.10.0.

- Screen control now has a lime SchoolWork cursor that moves smoothly to the target and pulses after a successful click. A small translucent speech bubble grows with its bounded action text and the assistant's public explanation when available. It does not display private reasoning or invent a running commentary.
- The display overlay does not receive input or take focus. It is hidden throughout screen observations and closes on Stop, cancellation, task completion, or closing the app. Its isolated renderer has no application or tool API.
- Recent chats have their own scroll area; navigation, folder and settings stay in place. Selecting a chat keeps the list open. Smaller windows use tighter spacing, and collapsed navigation hides the lesson label. Long tool labels are shortened visually; expand the activity or use the tooltip to read the full text.

## What “separate cursor” means

The animated cursor is a separate visual overlay. Windows desktop control still briefly uses the real pointer and foreground keyboard. The helper restores the previous pointer position after clicking/scrolling when the user has not moved it in the meantime. This is not an independent desktop or a background computer-use session; avoid using the same desktop during automated input.

## Installation

Download `SchoolWork-0.10.1-beta.4-x64-setup.exe` or the portable executable and check it against `SHA256SUMS-v0.10.1-beta.4.txt`. Finish or pause active tasks, then close SchoolWork normally before updating. Packages are unsigned; do not disable Windows protections.

The existing application ID, chats, settings and credential storage are retained. Do not run the installer app and portable app against the same profile simultaneously. Each tester needs their own TeachGPT API key and school access; no user credentials, `.env` files or personal databases are packaged.

## Verification and limitations

- 166 unit tests and 4 release-configuration tests pass; full TypeScript and native Windows builds pass.
- Real Electron UI tests cover 45 recent chats at two window sizes, scrolling/clicking, collapsed navigation, transparent bubble resizing and bounded text, focus preservation, observation suppression, Stop and cancellation.
- Windows integration exercises real capture, clicks, Unicode input, shortcuts, scrolling, UI Automation and native/JSON agent loops in disposable fixtures. Remote provider responses are simulated.
- 12 lesson/model workflows pass with real Electron IPC and simulated TeachGPT/Google responses.
- No Google permission scopes or agent write access were added in this update. Google approval remains pending; this beta does not promise unrestricted Google sign-in. See [verification status](https://sillen69.github.io/schoolwork-desktop/google-verification-status.md).
- Clean-machine installation, a personal-profile upgrade, live Google consent and live TeachGPT completion were not reverified for this visual update. No active installed task was stopped to test or install it.
