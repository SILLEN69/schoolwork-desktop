# Work backbone and current beta handoff

Canonical source is the repository root on beta. temp/project remains a frozen recovery snapshot. Release changes must not be merged to main until requested, and beta projector diagnostics must be removed first (docs/projector-debug-removal.md).

New tasks have engine:task metadata opencode-v2. Existing tasks keep the legacy engine to preserve their history. OpenCode 2.0.28 owns reasoning/tool orchestration and its session persistence; SchoolWork exposes its tools over an authenticated per-task loopback MCP lease and keeps permission enforcement, screen freshness/ownership, process management and a durable operation ledger. OpenCode's native shell/files/plugins are denied. The school key is decrypted only in Electron and never put in the child environment. No model switching or direct OpenAI fallback is enabled.

Provider requests go through openCodeBridge.ts and the existing streaming parser/recovery. Complete calls receive durable operation IDs before OpenCode sees them. Explicit native-tools rejection gets the same-model streaming JSON protocol. Unknown/truncated calls cannot be executed. Diagnostics exclude prompts, screenshots, file contents and private reasoning. Large requests need streaming; do not regress to non-streaming retry.

workQuestions.ts persists native form metadata/answers. Forms are questions only, never permission grants. Native event session identity is data.form.sessionID for form.created. Use the pinned SDK session.form.reply answer object, not a guessed chat message. QuestionCard is mounted in both Work and lesson UI.

Lesson notes use lessonNotesPrompt and version checks. Markdown editing does not remove task/calendar state. Speech language is separate from LanguageContext, and summary cancellation must not disable back/speech controls. Fresh UI language is Swedish; explicit English survives.

AtomWorking uses requestAnimationFrame SVG updates. This machine has OS reduced motion enabled, which caused static icons. Brand/thinking icons deliberately use respectReducedMotion=false and persisted animateIcons (default true). Other accessibility/startup behavior retains OS preference. Remove the welcome-page atom; do not restore the old green brand icon. The one-minute game hint is stored per installation in renderer localStorage and must not flash every step.

Focused verification: npm run build; npm test; node scripts/test-opencode.mjs (actual runtime, simulated school responses, one-minute UI clock accelerated); node scripts/test-lessons.mjs (actual microphone/IPC, simulated services, includes projector suite); node scripts/test-agent-recovery.mjs; node scripts/test-ui-motion.mjs. Live evidence is under ignored work/work-v012-verification; it contains an isolated protected credential profile and must NEVER be added to Git or release assets. Live author-written fixtures exercise TeachGPT without personal lecture content.

Installer distribution must use the publisher-provisioned GitHub workflow. Local npm run build without publisher environment intentionally lacks shared Google OAuth configuration. No active user task or original profile may be force-closed for installation.
