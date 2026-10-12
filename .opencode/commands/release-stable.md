---
description: Validate the stable version on main and publish via the tagged workflow
agent: build
---

This command authorizes: pushing `main` and creating/pushing a `v*` tag to publish the stable release through `.github/workflows/release.yml`, then verifying public assets and the stable update feed. Do not merge branches — use `/promote` first.

1. Verify HEAD is `main` with a clean tree. The `package.json` version must be a stable semver with no `-beta` suffix (e.g. `0.10.1`). If it still carries a beta suffix, stop and report that a deliberate stable version bump + release notes are required first — do not invent a version.
2. Release notes must resolve per `scripts/release-config.cjs` (`docs/release-<version>.md`, falling back to the base version). Create or refresh the exact file for this version if missing.
3. Validate: `npm run check:release`, `npm test`, `npm run build`.
4. Check publisher prerequisites (names only, never values): repo variable `SCHOOLWORK_GOOGLE_CLIENT_ID` and secret `SCHOOLWORK_GOOGLE_CLIENT_SECRET` via `gh api repos/SILLEN69/schoolwork-desktop/actions/variables` and `.../actions/secrets`. If either is missing, stop and report exactly what is missing.
5. Push `main` if it is ahead, then `git tag v<version>` and `git push origin v<version>`. Refuse and report if the tag already exists on the remote.
6. Follow the workflow: `gh run list --repo SILLEN69/schoolwork-desktop --workflow release.yml --limit 1` and `gh run watch <id> --repo SILLEN69/schoolwork-desktop`. On failure, report the exact failing job and a bounded log excerpt. Do not delete the tag without explicit confirmation.
7. Verify public assets: `gh release view v<version> --repo SILLEN69/schoolwork-desktop --json assets,isDraft,isPrerelease,url` — expect `SchoolWork-<version>-x64-setup.exe`, `-portable.exe`, `-setup.exe.blockmap`, `latest.yml`, `SHA256SUMS-v<version>.txt`, all uploaded, and `latest.yml` pointing at the new version (the stable update feed).
8. Report: version, tag, main commit, workflow run id + conclusion, release URL, asset list with sizes, stable feed status, and any unresolved problem.
