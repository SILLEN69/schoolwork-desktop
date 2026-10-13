# TeachGPT Realtime: working desktop connection

Verified against the deployed school service on 13 October 2026.

Realtime exists. The beta.3 client called `/api/v1/realtime`, whose API proxy rejects that path with HTTP 403, and incorrectly concluded that live transcription required a school server change. The existing `/audio/live/signal` route is protected by Laravel Sanctum, which accepts either a website session or an API bearer token. An API token works with the route's normal CSRF protection; a separate school website login is unnecessary.

SchoolWork now performs this connection in its main process:

1. Fetch `/audio` with the configured TeachGPT bearer token. Keep the returned session cookies and CSRF token together in memory.
2. Read the live component's JSON configuration without executing remote scripts. Resolve the model-group aliases to `KBLab/kb-whisper-large` or `Systran/faster-whisper-large-v3`, and pass the school's fresh STUN/TURN configuration to the renderer.
3. Gather ICE candidates and POST the SDP offer to `/audio/live/signal?model=<resolved-id>` using the bearer token, paired session cookies and `X-CSRF-TOKEN`.
4. Apply the SDP answer. Microphone audio and live transcription events travel over WebRTC to the school's Speaches service.

The main process refreshes an expired CSRF session once after HTTP 419, cancels pending configuration/signalling on Stop and clears connection credentials after signalling. API keys, cookies and CSRF tokens never enter the renderer or Git. Temporary TURN credentials are supplied only to the active local WebRTC connection. No school server configuration, new OAuth scope or API provider change is required.

The recorder owns the microphone track. Closing or failing the live peer now closes its data channel and peer connection without stopping that shared track. Recorded WAV segments continue through the existing file-transcription pipeline. Live connection errors are visible and no longer claim the API is absent.

## Verification

- Real Electron/WebRTC probes connected to both deployed ASR models with synthetic speech. Both received live transcription events; the microphone remained active after live-session teardown.
- Unit regressions cover nested Livewire data, token/cookie/CSRF pairing, one-time CSRF refresh, cancellation, permission errors, duplicate fragments and shared-microphone ownership.
- The lesson UI regression deliberately fails live signalling and verifies that complete WAV capture and file transcription still work.

These probes establish real service connectivity with synthetic speech, not recognition accuracy for every classroom, microphone or network. Summary/chat/Google interactions in the general lesson regression remain simulated.

Reference: [Laravel Sanctum route authentication](https://laravel.com/docs/12.x/sanctum#protecting-routes).
