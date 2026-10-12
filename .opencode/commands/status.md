---
description: Inspect branches, changes, PRs, CI and releases
agent: build
---

Status report for this repository. Read-only: do not modify files, branches, tags or remote state.

1. `git status --short`, `git branch -vv` and `git log --oneline -5` — current branch, uncommitted changes, recent commits.
2. `git fetch origin`, then report ahead/behind for `beta` and `main` versus their remotes, and `git rev-list --left-right --count origin/main...origin/beta`.
3. Open pull requests: `gh pr list --repo SILLEN69/schoolwork-desktop --json number,title,headRefName,baseRefName,state,mergeStateStatus,statusCheckRollup`.
4. Recent CI: `gh run list --repo SILLEN69/schoolwork-desktop --limit 8 --json databaseId,displayTitle,branch,event,status,conclusion,createdAt`.
5. Latest releases: `gh release list --repo SILLEN69/schoolwork-desktop --limit 3`.

Report compactly: branch state, dirty files, open PRs with check status, latest CI conclusions, latest releases. If `gh` is not authenticated, say so and continue with git-only findings. Keep output bounded: no full diffs, at most one line per run.
