# 0.12.0-beta.2

## Work

- New tasks run on bundled OpenCode 2.0.28 with SchoolWork's existing TeachGPT key and selected school model. No separate account, installation or OpenCode configuration is required.
- SchoolWork keeps ownership of file permissions, commands, native screen observations/input, cancellation and the durable tool ledger. Native OpenCode file/shell/plugin permissions are disabled; permitted tools are supplied through a per-task authenticated loopback MCP connection.
- Native questions appear inside Work and lesson conversations. Choice, multiple choice, custom text, skip and stop are supported. Answers are saved before continuing and do not grant permissions.
- Pause/restart/resume retains the OpenCode session and completed SchoolWork operations. Existing tasks continue on their original engine; they are not silently rewritten.
- Streaming remains enabled, the selected model is retained, unfinished actions are never executed, and an explicitly unsupported native-tool protocol gets a streaming JSON action protocol on the same model.

## Lessons and interface

- Study notes preserve definitions, theory, formulas, units, assumptions and worked examples. New speech refines the existing notes rather than replacing earlier topics with a tiny recap.
- Notes are editable. Revision checks prevent a late summary from overwriting a manual edit; existing assignment completion/calendar references remain intact.
- Speech language and interface language are independent. Switching speech language during a pending summary cancels that request safely. Back navigation remains available, and audio-only lessons work without a projector.
- Swedish is the fresh-install default. Existing explicit English preferences remain. Shared interface copy, Markdown controls, image controls, subject labels and the native menu follow the current language.
- User-facing errors omit Electron RPC wrappers and show concise recovery instructions. Detailed diagnostics remain local. Removed redundant projector setup/time labels.
- The top-left logo is the animated atom and keeps moving while idle. The extra atom above the welcome headline is removed. Requested icons animate even when Windows reduced motion is enabled; the Animate icons setting can stop them. Automatic startup/layout motion still respects reduced motion.
- First-time users see one small game hint after a Work task runs for one minute. Clicking or keyboard-activating the thinking atom opens Star catch. The hint does not repeat after restart.

## Verification and limits

- Live TeachGPT/Qwen3.8-27B completed file creation and a real Node assertion via the protected credential service and actual OpenCode runtime; the tool result reached the model. No model was switched.
- Live audio-only lesson analysis retained definitions, units and conditions, then retained earlier theory outside the latest transcript window while adding power/energy formulas and numerical examples. No assignment was invented.
- Deterministic checks cover native questions, streaming JSON fallback, operation deduplication, pause/restart/resume, inference cancellation, editable notes/concurrent updates, speech switching/navigation, projector lifecycle and animation preferences.
- School API availability and model intelligence remain upstream dependencies. This is a beta, not a guarantee that every task succeeds. Public download requires each person's own school key. No credentials or personal profiles are included.
- Packages are unsigned. Existing Google account policies/approval and school restrictions remain unchanged. First-time YeetCast code lookup can still briefly refresh the physical receiver; eliminating that entirely needs a school-side change.
- Temporary beta-only projector diagnostics remain local and must be removed before promotion to main; see projector-debug-removal.md. Main is not merged by this release.

OpenCode retains its [MIT license](https://github.com/anomalyco/opencode/blob/v2.0.28/LICENSE), also included with the bundled runtime.

The first release attempt stopped at the Linux UI gate before packaging: a fixture observed public streamed progress before the durable completed state. The test now waits for authoritative completion and still verifies the tool result. Beta.1 had no published installer.

The Windows Work fixture also waits for the real startup shell to become interactive before typing. Before that, the intentional startup inert state can discard simulated keystrokes on a slower runner.
