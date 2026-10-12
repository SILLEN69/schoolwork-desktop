---
description: Run appropriate checks and report exact failures
agent: build
---

Run the project checks and report exact failures. Scope: $ARGUMENTS (empty = full standard set). Report only — do not fix anything in this command.

Standard set, from the repository root:

1. `npm test` (Vitest unit suite).
2. `node --test scripts/check-release-config.cjs scripts/check-startup-assets.test.mjs scripts/build-native.test.mjs`
3. `npm run check:release`
4. `npm run check:startup`
5. `npm run build` (startup-asset guard + TypeScript + Vite + Electron bundle + native helper). Required when source or startup assets changed; skip only if the working tree is clean and a verified build already exists, and say so explicitly.

If $ARGUMENTS names a specific area (for example notifications, pointer, motion, lessons, desktop, agent recovery), prefer the matching focused script from docs/development.md or AGENT_PROGRESS.md "Resume commands", but still run the unit suite unless the user asked for a narrow check only. The `test:*` npm scripts build first; when testing an already-verified build, run the matching `scripts/test-*.mjs` directly to avoid a redundant build.

If `node_modules` is missing, run `npm ci` first. Report each check with pass/fail and exit code; for failures include the exact error text (bounded: first ~40 relevant lines per failure).
