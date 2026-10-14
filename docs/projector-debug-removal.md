# Temporary projector diagnostics — remove before main promotion

Owner request, 14 October 2026: add local logs so classroom connection failures can be diagnosed, then remove this debugging when promoting to main.

Beta builds expose **Save connection log / Spara anslutningslogg** beside the board controls. Logs are local at `<SchoolWork userData>/diagnostics/projector-beta.jsonl`, bounded to roughly 1MB with one previous file. Use the button after a failed attempt to export JSON and share that file for diagnosis. Nothing uploads automatically.

Events include sign-in/join phases, allowed or blocked navigation categories, HTTP/network status codes, cleanup outcomes, durations, board/view state and frame readiness. PINs, receiver/stream URLs, account names, passwords, cookies, tokens, page contents and raw error/console messages are excluded by an explicit metadata allowlist.

The build flag is false on `main` or with a stable version. The runtime also refuses stable-version logging. Main/stable UI therefore has no diagnostic control and generates no new projector logs, even if removal is overlooked. The compile-policy regression runs in CI/release checks.

Before merging/promoting to main, do the actual removal:

1. Remove `electron/projectorDiagnostics.ts` and its temporary tests, the build flag/helper and `scripts/projector-debug-config.test.cjs`.
2. Remove the logger construction/import in `electron/main.ts`, the `board:export-diagnostics` IPC handler, preload/type API, renderer preview stub, diagnostics-availability field and **Save connection log** button.
3. Remove diagnostic callbacks/events from `projectorConnect.ts` and `yeetcast.ts` while preserving cancellation, cleanup, isolated windows, real-frame capture, refresh and stale-operation fixes.
4. Remove only the diagnostic/export assertions from the projector suite and temporary policy checks from workflows. Keep the projector setup suite in release/CI.
5. Retain ordinary actionable user errors. Verify main has no logging/export UI and projector setup still passes. Remove this checklist and its AGENTS reminder once complete.

An old local log or exported JSON is not deleted by changing branches; it belongs to that user's local profile. Do not commit personal diagnostics or force-delete their exports.
