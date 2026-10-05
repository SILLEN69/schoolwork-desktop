# SchoolWork 0.5: stronger agent coordination and phone link

## Evidence and scope

Reviewed `electron/main.ts`, `desktopTools.ts`, `desktopBridge.ts`, `native/DesktopBridge.cs`, `preload.ts`, `storage.ts`, `memory.ts`, `src/provider.ts`, `src/agentRequest.ts`, and the conversation/desktop/settings UI at the 0.4 implementation. Recent installed-profile task and diagnostic metadata showed completed screen-control tasks, completed follow-up inferences and persisted nonempty assistant replies. That does not prove those replies were visible in the user's UI, or conclusively identify the reported silence. No personal conversation contents or credentials were copied into this report.

Code-level gaps were independently reproducible: failures saved a task error/event but no assistant reply; incomplete native-tool turns could poison subsequent requests; known unsupported historical image attachments could prevent a new text-only conversation turn; renderer events were not reconciled from saved state. Screenshots expired after 30 seconds despite potentially much longer model inference.

## Requested capabilities implemented

- All-app mode defaults on, with selected-app mode still available. Capability intersections preserve a restricted task's original scope and apply revocations immediately. Launch tools accept accessible canonical `.exe` paths; packaged/UWP apps may need their normal shell launcher via existing PowerShell access. This is normal-user access, not universal control or automatic elevation.
- Physical monitor enumeration and exact monitor selection for screenshots; window movement between monitor work areas; negative desktop origins and resized-image coordinate mapping remain supported. The existing per-monitor-DPI-aware native helper supplies physical coordinates end to end, avoiding a mixture of Electron DIP and Win32 pixel coordinates.
- Recorded desktop recovery patterns: a same-app primitive must fail, subsequently succeed, and be followed by a new capture/UI Automation observation before a pattern is saved. App identity, monitor layout when observed, tool names, evidence task and success count are retained. No screenshots, typed text, passwords or model-generated instructions enter this learning store. Maximum 100 records; eight recent hints are included in model context with explicit environment revalidation requirements. Unknown layouts are marked unknown, not assumed transferable. This is procedural memory, not training model weights or rewriting executable code.
- Optional Telegram link: encrypted token, five-minute single-use pairing, private chat plus sender authentication, persistent incoming offset, retry outbox, task buttons and `/retry`, `/status`, `/stop`. Notifications disclose only generic status and a task identifier. The app must be running; no always-on Windows service or public webhook is installed.
- Casual SMS-style prose, with the requested coding-success phrase gated by recorded edits plus a successful subsequent check. Code, maths, error explanations and verification limits remain precise.

## Ten additional improvements applied

1. Durable assistant replies on failure, pause, cancel, execution limit and recovered interrupted work; saved action counts distinguish success, failure and unknown outcome.
2. Repair incomplete/orphan native-tool history before every provider request, inserting honest unknown-outcome results without executing missing calls.
3. Keep batched native tool results adjacent and defer the transient screenshot until the tool turn is closed; normalize old native history for the constrained JSON protocol.
4. Reconcile a missed completion event from SQLite on focus and while waiting; avoid overwriting a newly submitted draft/turn during reconciliation; refresh background task entries.
5. Periodic progress heartbeat while inference or an action is pending, so network waits do not look like a frozen app.
6. Offline “What happened?” action-status button and direct English/Swedish status-question path, independent of provider availability.
7. Reject overlapping work submissions in one chat and prevent retrying an old task after a newer work request. Status-only questions do not supersede work.
8. Allow a text-only follow-up after an old image was rejected, without resending unsupported historical image bytes. Saved attachments remain intact.
9. Accommodate model latency with a 180-second one-use screenshot token, while retaining native focus/identity/bounds checks; discard owner tokens at task exit so retries must capture again. Double-click is supported explicitly with bounded count 1–2.
10. User-visible forgetting of learned desktop patterns, Telegram connection state/test/disconnect controls, and encrypted-token deletion; all remain accessible without per-action approval dialogs.

## Contracts and privacy

IPC remains restricted to the trusted main renderer. New bounded IPC endpoints cover displays, learning list/reset, saved task status and Telegram configuration/pair/status/test/disconnect. Renderer code never receives decrypted saved credentials. The native helper remains a private, unelevated stdin/stdout process; no native dependency or additional runtime package is required. Telegram uses the platform fetch API.

`list_displays {}` returns monitor identifiers plus physical and work-area bounds. `capture_screen {windowId? | displayId?}` rejects mixed targets. `move_window {windowId,displayId}` rechecks window identity, restores a normal window and fits it to the selected work area; a subsequent capture is mandatory before input. `click {screenshotId,x,y,button?,count?}` supports one or two clicks. Other desktop schemas retain their bounded arguments and one-use observation requirement. Launch arguments are not free-form shell strings; discovery/special shell launching remains available through the separate existing process tools.

Tool frames stay ephemeral and are not attached to Telegram or retained as a screen recording. User-attached screenshots remain subject to the existing attachment lifetime and conversation deletion rules. Learned metadata stays in local SQLite until forgotten; ordinary notes and action journals retain their existing local lifetime. Telegram keeps a local offset, paired chat/user IDs, deduplication identifiers and the latest 100 unsent notifications. Disconnect removes token/pair/outbox, not the task journal. The bot API lacks a client idempotency key for sends, so an uncertain acknowledgement may yield duplicate notifications; remote commands are consumed before execution to prioritize avoiding duplicate input. Polling/delivery are cancellable and failures must not block local final replies.

PowerShell/process tools already execute with normal user permissions and are not sandboxed by the desktop allowlist. The all-app toggle is a desktop-tool scope, not a new security boundary around arbitrary shell code. No claim of absolute privacy containment is made for a fully privileged local agent. Never bypass the lock screen, secure desktop or UAC; elevated apps, protected video, access-denied processes and Windows foreground restrictions remain explicit limitations. Stop clears observation tokens and kills only the app-owned helper/processes, not ordinary user-launched apps.

## Verification and release boundary

- TypeScript/frontend/backend/native helper build passes.
- 83 unit tests pass, including capability intersections, monitor argument routing, negative-origin mapping, token expiry/ownership/revocation, interrupted history, recovery learning and Telegram authentication/replay/privacy.
- Real Electron UI/IPC tests pass in an isolated profile: persisted maths/code/images and Copy, narrow layout, a failed desktop/provider flow with a saved reply, offline status and a following ordinary question, text-only recovery after image rejection, and a real file write → syntax check → read → final answer loop.
- The same real app tests exercise encrypted bot-token storage, pairing, notifications and authorized retry using mocked TeachGPT and Telegram transports. These are not evidence of live phone delivery or real model reasoning.
- Packaged SchoolWork 0.5.0 also passed isolated-profile startup, SQLite/image restoration, local KaTeX rendering and immediate Stop verification. The installer is unsigned; the user's existing running installation was not overwritten.
- The full physical mouse/keyboard suite was blocked by Windows being on the `Screen-saver` desktop. The helper correctly refused control. Source and packaged UI can be tested without bypassing that restriction; multi-monitor capture/movement and the physical-input regression suite still require an awake/unlocked desktop. Earlier 0.4 physical tests are not counted as 0.5 verification.
- A configured live vision model and a real configured Telegram bot remain user/environment-dependent checks. No token was requested in chat and no live-phone delivery is claimed.

## Manual acceptance checks after installation

1. Enable all-app mode; open an application never added to the list. Ask for `list_displays` and `list_windows`, then observe and perform a harmless edit in a disposable document. Require a visible final reply and check the action log.
2. With two monitors (preferably different DPI and a monitor left of primary), request a capture of each, move a disposable window to the other monitor, focus/capture it and perform a safe click/type/scroll. Confirm input occurs in the intended window and all coordinates/bounds correspond to the selected frame.
3. Change monitor topology or move/focus a window between capture and input. Stale identity/bounds/focus must cause reobservation, not an unverified click. Disconnecting a target monitor must produce a visible error/checkpoint.
4. Pause/Stop during model output and between tool calls. Verify saved reply, restart restoration, honest unknown outcomes and no automatic repeat of uncertain input. Retry an older task after a new work request: it must be refused; a status-only query must not supersede saved work.
5. Cause a known stale/focus failure, recover in the same disposable app, then capture/inspect. Confirm a bounded recovery pattern is saved, reused only as a revalidation hint, and can be forgotten. No passwords/typed text/screenshots may appear in its record.
6. Create a BotFather bot, enter token only in Settings, link the private account and send a test. Run a checked coding task and an intentionally failed task. Verify success/error notifications; use Retry/Status/Stop. A different sender or group must not control the app. Pause/disconnect the link and verify polling stops and token/outbox removal.
7. Test offline/provider rejection/empty inference and a normal follow-up. Ask “what did you do?” and use the status button: saved evidence must remain available without model access. No failed task may send the coding-success phrase.

Technical sources: [Telegram Bot API](https://core.telegram.org/bots/api) (long polling, update offsets and callback-data bounds), [Electron screen coordinates](https://www.electronjs.org/docs/latest/api/screen) (DIP/physical distinction), [Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput) (integrity/UIPI limitations).
