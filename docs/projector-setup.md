# Connect a classroom projector

1. Open **Follow a lesson** in SchoolWork.
2. Enter the six-digit code shown on the projector, including any leading zeroes, and press **Connect**. Spaces in `123 456` are accepted.
3. The first connection opens the school's YeetCast sign-in page. Sign in with your authorized school account, or use a valid school-issued guest identity on that page. SchoolWork never receives your school password.
4. When someone is presenting, press **Show board**. **Capture board** attaches its image to the selected lesson as AI context.

SchoolWork remembers the projector's receiver address, not its rotating code. Later code changes do not require another connection. Use **Change projector** in a different classroom, and **Disconnect** to forget the saved projector. An expired code produces an error and keeps the previous projector selected; enter the code currently visible on the screen. Closing the sign-in window or pressing Cancel cancels setup.

An idle projector shows “Waiting for a presentation”. Network errors stop the stale view and disable capture until the service recovers. No additional TeachGPT API key or developer configuration is needed for YeetCast. Existing saved YeetCast receiver links remain compatible.

## How the integration matches YeetCast

Verified against [the school's YeetCast source](https://git.ssis.nu/SSIS/yeetcast), commit `3bdcdc9a2c10b585348da1d7541d3b854293f7ff`:

- `Cast::checkCode` resolves a six-digit access code after validating the signed-in or guest identity. A code is not a receiver ID and is never concatenated into `/receiver/{id}`.
- SchoolWork calls this normal action, reads its server-validated receiver ID, and invokes `deleteSender` to remove its own temporary sender. It never deletes another sender or invokes moderation actions.
- The connection window blocks sender iframes and microphone/camera/screen permissions. The board window opens only a read-only `view` stream. Nothing is cast from the user's computer.
- Receiver pages contain HTML-escaped Livewire snapshots and nested collection tuples. Empty receivers are valid states, even without a stream URI.
- Cleanup waits for an in-flight join, with a bounded retry when offline. If the window/process is forcibly closed or the network prevents cleanup, YeetCast's normal inactive-sender expiry remains the fallback.

## Verification boundary

The automated projector suite runs the real SchoolWork renderer, IPC and connection/view windows with simulated school identity, code lookup and streams. It checks leading zeroes, expired codes, rotating codes, sender cleanup, blocked push streams, hide/show, cancellation and disconnect. A separate anonymous live check confirmed that the real YeetCast component is recognized and its Google login reaches an account-entry page.

No current classroom code was available on 13 October 2026. A real signed-in classroom lookup and teacher video stream remain unverified. School account access, guest authorization, the projector being online and network access to YeetCast/VDO remain service prerequisites; the app cannot bypass them.
