---
description: Review changes, stage intended source, commit, push beta and inspect CI
agent: build
---

This command authorizes: committing reviewed source and pushing the `beta` branch. Do not tag, release, merge to main or push any other branch.

1. Verify the working branch is `beta`. If other work exists on a clean feature branch, stop and report instead of switching.
2. Review every change: `git status --short`, `git diff`, `git diff --cached`.
3. Stage only intended source changes, explicitly by path. Never stage credentials, `.env` files, personal profiles, databases, app data, screenshots or unrelated files. `temp/` changes only when they are deliberate handoff/snapshot updates.
4. Commit with a clear conventional message describing the change (e.g. `feat(...)`, `fix(...)`, `chore(...)`).
5. `git push origin beta`.
6. Inspect CI: `gh run list --repo SILLEN69/schoolwork-desktop --branch beta --limit 3`, then wait for the run matching the pushed commit with `gh run watch <id> --repo SILLEN69/schoolwork-desktop` and report every job conclusion.

Report: commit SHA, pushed ref, CI status per job, and any failure with exact error text. If there is nothing to commit, report that and stop. Never amend or rewrite already-pushed commits.
