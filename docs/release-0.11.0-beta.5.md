# SchoolWork 0.11.0-beta.5 — enter the projector code

Connect the classroom board by entering the six-digit code shown on the projector. SchoolWork uses YeetCast's normal school sign-in and code validation, then remembers the receiver so rotating codes do not disconnect the board. The first connection may require a school sign-in; no projector website address or extra developer configuration is required.

- Clear errors for invalid/expired codes, cancellation and connectivity problems; switching projectors preserves the previous selection on failure.
- Correct parsing of real Livewire receiver snapshots, collection tuples and idle projectors.
- Hide/show works reliably; disconnected or failed streams cannot be captured as a current board.
- Sender iframes and camera/microphone/screen access are blocked in the connection window. The app removes its own temporary YeetCast sender after resolving a code and opens a view stream only.
- Beta installations now check the beta update channel, while stable installations stay on latest. Downloads/restarts remain explicit and downgrades remain disabled. Install this beta manually if upgrading from an older beta whose updater excluded prereleases.
- Existing TeachGPT Realtime support from beta.4 remains included.

Validation: 209 unit tests, six release/asset/native checks, a Windows build, the 13 lesson/model workflows and the projector setup suite with simulated school services. The real anonymous YeetCast/Google login page was checked. No current classroom code was available, so a real signed-in code lookup and live teacher video remain unverified. See [setup and verification details](projector-setup.md).

This is an unsigned Windows x64 beta installer and portable application. The alpha feature branch remains experimental and source-only. Stable main and the v0.10.1 installer are unchanged.
