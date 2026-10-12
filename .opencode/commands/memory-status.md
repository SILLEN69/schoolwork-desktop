---
description: Report opencode-mem plugin health, embedding connectivity and store status without exposing secrets
agent: build
---

Report the health of the personal OpenCode memory setup (opencode-mem) without exposing secrets. Read-only plus harmless probes; never print API keys, tokens or Authorization headers.

1. Configuration: read `~/.config/opencode/opencode.json` and report the plugin entry and its non-secret settings (embedding model id, endpoint base, dimensions, extraction/summarization model). If a secret value is visible, report only that it is present — never its content.
2. Storage: locate the memory database/directory (typically under `~/.local/share/opencode` or the plugin's data directory). Report path, file size, last-modified time, and entry counts where available (prefer the `memory` tool's `list`/`list-shards`/`help` modes over raw DB reads).
3. Plugin tools: list the memory tools available in this session and exercise one harmless read/query (e.g. `memory` help or a bounded `search` with a common keyword).
4. Embedding connectivity: run one small authenticated embeddings request through the configured endpoint using the credential resolved from the supported environment reference (e.g. `$env:TEACHGPT_API_KEY` in a fresh shell). Report model id, vector dimensions, latency, and whether the vector is finite.
5. Viewer: if a memory viewer is configured, check its loopback HTTP endpoint with a plain request and report the status code.
6. Report: installed plugin version, configured vs verified model ids, storage status, connectivity result with measured latency, and any unresolved problems with exact error text.

Do not add, delete or modify memories in this command. Avoid dumping personal memory contents beyond what a health check needs.
