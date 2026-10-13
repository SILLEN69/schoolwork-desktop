# SchoolWork 0.11.0-beta.4 — working TeachGPT Realtime

This beta fixes live lesson transcription using the school's existing Realtime service.

- Uses the existing token-authenticated live relay with its paired CSRF session, replacing the rejected `/api/v1/realtime` request. No additional website login or school server change is needed.
- Resolves the school's full speech-model IDs and fresh STUN/TURN settings before starting WebRTC, and gathers candidates for one-shot signalling.
- Live failures no longer stop the shared microphone. Closing or pausing releases the peer and pending HTTP requests while preserving the ordinary recorder's ownership.
- Shows live connection failures without claiming that the API is missing. File transcription, summaries, lesson questions and YeetCast board context remain available.
- Correctly handles duplicate fragments and both wrapped and plain Realtime events.

Real WebRTC tests against TeachGPT succeeded for both `KBLab/kb-whisper-large` and `Systran/faster-whisper-large-v3`, using synthetic speech. Unit, build and lesson/UI checks also verify failure recovery and saved transcription. See [the connection and verification details](teachgpt-realtime.md).

This is a prerelease using `beta.yml`. Stable v0.10.1 and its `latest.yml` feed are unaffected. Windows packages are unsigned.
