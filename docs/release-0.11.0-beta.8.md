# SchoolWork 0.11.0-beta.8

- Fix waiting-for-presentation on a YeetCast shared screen/tab whose receiver HTML starts with active=false.
- Automatic full-frame board snapshots every 30 seconds during lesson recording, without opening or focusing a floating window. Pause/unmount stops sampling.
- Each frame carries capture time and an approximate microphone-audio position. Nearby speech is resolved when context is used, so late transcription is included. Vision summaries receive up to three recent frames with matching metadata.
- Reconnecting the same remembered receiver with its currently displayed code avoids the temporary sender join/delete and its physical-screen reload.
- Beta-only redacted connection diagnostics remain available. Remove them before main promotion as documented.

Verification: focused unit tests and real Electron projector workflows using simulated school login/code actions and actual moving video frames. This is not proof of a current signed-in classroom stream or a clean-machine installation.

Limits: first-time official code lookup can still briefly blank the physical projector; fully eliminating that needs a YeetCast server change. Screenshots sample periodically, not every video frame. The model needs qualified vision support to inspect the images. Microphone audio is recorded; presenter tab audio is not separately captured. Original conversations, credentials and app ID are preserved.

OpenCode backbone development remains separate and is not included in this projector package.
