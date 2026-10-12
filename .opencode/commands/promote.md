---
description: Promote beta to main via reviewed PR and report the main commit
agent: build
---

This command authorizes: creating or reusing a beta→main pull request, merging it when required checks pass, and reporting the resulting main commit. Do not tag, bump versions or publish releases.

1. `git fetch origin`. Review the delta honestly: `git log origin/main..origin/beta --oneline` and `git diff --stat origin/main...origin/beta`. Summarize what `main` would receive, including any behavior changes (provider/tool-history/recovery semantics) that need deliberate attention.
2. Validate the promotion: on a detached checkout or temporary worktree with `beta` merged onto `origin/main`, run `npm run check:release`, `npm test` and `npm run build`. Resolve conflicts using the final beta implementations per the handoff notes; keep application ID `nu.ssis.schoolwork` and the user-data layout intact.
3. Create or reuse the PR: `gh pr list --repo SILLEN69/schoolwork-desktop --head beta --base main`. If none exists: `gh pr create --repo SILLEN69/schoolwork-desktop --base main --head beta --title "Promote beta to main" --body-file <notes-file>` with an honest change summary.
4. Wait for required checks: `gh pr checks <number> --repo SILLEN69/schoolwork-desktop --watch` (or poll `gh pr view <number> --repo ... --json statusCheckRollup`).
5. Merge only when all required checks pass, using the repository's default merge method: `gh pr merge <number> --repo SILLEN69/schoolwork-desktop`.
6. Report: PR number, merge method, resulting main commit SHA (`git fetch origin && git rev-parse origin/main`), what was merged, and any skipped checks with reasons.

If any required check fails: stop, report the exact failing checks and do not merge.
