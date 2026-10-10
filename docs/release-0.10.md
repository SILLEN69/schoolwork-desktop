# SchoolWork 0.10.0 — Lessons, voice & connected work

- Dictate directly into the Work message field. Speech remains editable and is never sent automatically. The separate transcription navigation and screenshot composer button have been removed; desktop capture tools remain available to the agent.
- Add context or images to a running task without stopping its active tool. Stop is now a separate button. Guidance is saved in SQLite and applied at the next safe step boundary.
- Lesson Studio now has Notes, Tasks and Transcript tabs, subject-grouped history, automatic subject/title detection and a manual subject override.
- Continuous recording uses independently decodable WAVs, pause-aware boundaries, two seconds of overlap and preceding transcript context. A continuous transcript removes matching overlap words; timestamped originals remain accessible. Optional AI tidying never replaces the originals.
- Repeated assignment descriptions are consolidated while keeping completion and Calendar identity. Existing linked Calendar events are never silently deleted.
- Ask questions or give instructions from the lesson view using the same Work agent and saved lesson context.
- Google Calendar event IDs now use Google's allowed alphabet. Connection checks distinguish API-disabled, missing scope, rate-limit and administrator restrictions. Desktop OAuth JSON import makes configuration easier.
- Optional Google Drive read access supports search, Google Docs and plain text/CSV. Connected apps supports HTTPS/loopback Streamable HTTP MCP servers with optional locally encrypted bearer tokens.
- Custom Node verification scripts are recognized. Repeated passing checks are bounded, and a stale task plan no longer indefinitely suppresses the final reply. Reasoning-only/no-progress requests time out sooner.
- Windows foreground switching attaches input threads briefly, detaches in all cases and still respects focus/UAC restrictions. Late-opening modal file pickers are observed instead of returning their disabled parent. Local HTML previews can open under the existing file-access policy.

## Before installing

Use the x64 setup installer, or the portable executable. All update assets (installer, blockmap and latest.yml) are published together after verification.

Google still requires an enabled Cloud API, a Desktop OAuth client and permitted scopes. School administrators may block third-party OAuth. This release cannot bypass that policy. Google read checks do not prove calendar write permission. Drive is read-only and must be enabled explicitly, followed by reconnecting Google. Full MCP OAuth, stdio servers and binary Drive document editing are not included.

This is a personal/pilot release, not a certified municipal-school deployment. Recording requires participants' permission; transcripts, attachments, commands and connected-account actions may contain sensitive information. See workflow-0.10.md for the verification boundary and institutional rollout requirements.
