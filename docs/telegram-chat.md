# SchoolWork 0.6: Telegram conversations and photos

## Setup and use

Install 0.6, open Settings → Telegram, paste your BotFather token into the password field, Save & enable, then Link phone and press Start. Never paste tokens into AI chats. The PC must remain on/online and SchoolWork open. No public web server or additional native dependency is required.

Send a normal message to start a saved conversation; send follow-ups normally after a reply. Send individual photos or PNG/JPEG image files, optionally with a caption. The AI receives normalized image bytes through the existing multimodal provider path, and desktop chat shows persisted image previews. No caption defaults to “Describe the attached image.” Choose a vision-capable model in Settings (test vision there); new phone chats use that selection, existing conversations use their latest task model. Vision failure is reported back to the phone without silently switching models/dropping the image.

- `/new`: fresh conversation, without stopping existing tasks.
- Reply to a task notification/answer, press its Status button, or `/use <full task UUID>`: select that task’s saved conversation for follow-up.
- `/status`, `/retry`, `/stop`: selected conversation’s latest non-status task, or the latest desktop task before selecting a conversation. Full UUIDs or task buttons target an explicit task.
- A running conversation rejects new messages/photos with a clear response. Stop then resend, or `/new`. No hidden automatic interruption/queueing of new work inside an active tool turn.

Photos: under 10 MB original, at most 32 megapixels; PNG/JPEG decoder validates the content regardless of document filename/MIME. Existing normalization caps the longest side at 1600 pixels, strips source metadata and limits normalized PNG to 4 MB. One image per Telegram message. Albums, voice, video, PDFs and other documents are explicitly rejected, not interpreted as work.

## Implementation decisions

`electron/telegram.ts` authenticates both private chat and sender before commands, AI messages or downloads. It maps replies to delivered bot messages back to their task, keeps pairing-session-specific routing and changes/aborts the old session on re-pairing. Natural-language messages are distinct from reserved commands. Stable UUID request IDs plus persisted offsets prevent duplicate task submissions. Offset consumption is deliberately at-most-once: if the app crashes after consumption but before acceptance, inspect saved state and resend rather than automatically replaying potential desktop actions.

`electron/main.ts` uses one shared task submission path for renderer IPC and authenticated Telegram messages. The existing task runner, permission snapshots, action journal, verification gate, cancellation and model history are reused. Task/user message/image binding and permission/phone-routing metadata commit atomically in SQLite. Failed/cancelled imports clean up only their own unsent attachments. Current permissions still constrain tools; linking Telegram does not grant elevated Windows access.

Photos use `getFile`, then stream from the fixed HTTPS Telegram file host with redirects disabled, a 30-second limit and a hard byte limit even when size metadata is missing. No arbitrary remote URL/local path is accepted. Pause/disconnect/re-pair abort downloads and check the session again after image import before creating a task. The existing `Attachments` importer creates durable user-data files, binds them to the user message, restores previews and hydrates TeachGPT `image_url` data-URI parts; original Telegram file URLs/tokens are never passed to the provider.

Final assistant replies and failure/pause/stop checkpoints for phone-submitted/phone-controlled tasks go to Telegram. In 0.7, desktop final replies are also delivered verbatim after known-secret redaction: the agent generates a new task-specific final rather than an extra costly model call to rewrite a generic notification. Action results are prompted to be 1–2 SMS-style sentences; questions/explanations retain needed detail. Task identifiers stay in inline-button callbacks and reply mappings, not visible message suffixes. Desktop displays incoming phone tasks in the sidebar and refreshes the selected conversation without losing composer drafts. Long replies are split into plain-text Unicode-safe parts under Telegram’s size limit, with task buttons; above 60,000 characters a visible shortening notice points to the full desktop result. No Telegram Markdown parser can reject model code/LaTeX. Replies are queued durably, ordered across retries and deduplicated locally. The latest 200 unsent parts and 1000 reply-to mappings are retained. Telegram send acknowledgements are not idempotent: uncertain acknowledgement can cause duplicate delivery. No live-screen images are automatically uploaded to Telegram.

## Privacy and lifetime

Only the paired private sender can submit or control work; group/foreign updates are ignored. Bot tokens are stored using Windows-backed Electron encryption, never returned to the AI or renderer. Token-bearing URLs and arbitrary network/filesystem errors are not disclosed in acceptance replies. Known secret formats are redacted from outgoing assistant text, but this is not a comprehensive data-loss-prevention boundary: requested results and errors may contain private content. Bot chats are cloud chats, not Secret Chats. Your phone messages/photos go through Telegram and TeachGPT, and selected-context replies go through Telegram.

Disconnect removes the encrypted token, pairing, selected conversation, reply mapping and private outbox; it does not stop accepted local tasks or delete their saved chat/images. Re-pairing cannot send the former session’s pending private results to the new account. Pausing only stops the link/downloads; re-enabling retains the pairing and queued messages. Already-dispatched network messages cannot be recalled. Delete conversations in SchoolWork to remove their local image files; disconnecting does not erase Telegram or provider-side copies.

## Verification boundary

Verified on 2026-10-06: 104 unit tests across 17 files passed; the complete source Electron chat/photo/phone-control workflow passed with simulated transports; packaged SchoolWork 0.6.0 passed isolated-profile startup, image restoration, bundled KaTeX rendering and Stop. Installer SHA256: `7DE51458A7988074A20121E91F9A69F4496731C1D3CBD271D7A17F274415568A`. Authenticode status is `NotSigned`.

TypeScript/frontend/backend/native build, unit tests and a real Electron UI/IPC integration workflow are required before release. Integration transport is simulated: Telegram text → task → saved context → provider request → answer/outbox, captions/photo bytes, PNG document upload, invalid-image refusal, unsupported vision failure and later text recovery, reply-to-desktop task routing, busy refusal, Stop, duplicate updates and saved previews after reload. Unit tests cover private-sender/group authentication, pairing/re-pairing, restart, cancellation, safe URLs/size bounds, Unicode replies and atomic routing rollback. Packaged startup/restored SQLite/images/KaTeX and bundled helper presence are checked in an isolated profile.

Live phone delivery and actual TeachGPT visual reasoning require a configured bot/model and are not established by mocked integration tests. Physical Windows control was not changed in this release; the full screen-input/multi-monitor suite remains a separate awake/unlocked-desktop check. No personal credentials were copied into test profiles, and the running user installation was not overwritten. The installer is unsigned.

## Manual checks after connecting your own bot

1. Send “hey, can we talk here?” and a follow-up. Confirm replies on your phone and matching saved desktop history.
2. Send one photo with a concrete question/caption, then a PNG/JPEG file. Verify a model describes actual visible content, not just generic image acceptance; inspect saved desktop previews and restart restoration.
3. Switch to a known text-only model and use `/new`. Send a photo: require a phone failure explanation. Follow with text: it must work without resending the unsupported historical image.
4. Run a harmless desktop task, reply to its notification with a follow-up, then `/new`. Confirm correct context isolation. Send a message while working: require explicit refusal; `/stop`, then resend.
5. Try a wrong sender/group, duplicate update, invalid file, album and oversized image. None may trigger a task or download before authentication. Pause/disconnect during download; no photo task may start afterward.
6. Disconnect/re-pair a different account during work. The new account must not receive the old account’s private pending answer. Simulate offline Telegram/re-enable and check queued part order; stop/pause/failed tasks must never claim coding success.

Sources: [Telegram Bot API: getFile](https://core.telegram.org/bots/api#getfile), [sendMessage](https://core.telegram.org/bots/api#sendmessage), [Telegram FAQ: encryption](https://telegram.org/faq#q-how-secure-is-telegram).
