# Working instructions

- Search first; read only relevant files and line ranges.
- Prefer surgical patches. Do not rewrite whole files for local changes.
- Keep command output focused: use quiet, targeted or bounded output.
- Run the narrowest relevant check after a change when checks are authorized; expand only when needed. Respect an explicit user instruction not to run tests.
- Final response: result, checks, unresolved issues. Do not narrate routine tool calls.
- Preserve technical detail, safety boundaries and exact error text; brevity must not remove meaning.
- Start with `temp/HANDOFF.md` for the 12 October 2026 beta transfer. Root source is canonical; `temp/project/` is a frozen recovery snapshot.
- Keep credentials and personal app data out of Git. Preserve TeachGPT inference, selected models, task progress and existing user data.
