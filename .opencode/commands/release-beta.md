---
description: Prepare and publish the next beta release via the tagged workflow
agent: build
---

This command authorizes: bumping the beta version, pushing `beta`, creating and pushing a `v*` tag, and publishing the beta GitHub release through `.github/workflows/release.yml`. Do not touch `main`.

1. Determine the next unused beta version. Current: `node -p "require('./package.json').version"`. Bump the final beta number (e.g. `0.10.1-beta.5` → `0.10.1-beta.6`). Confirm the tag is unused: `git ls-remote --tags origin v<version>` and `gh release view v<version> --repo SILLEN69/schoolwork-desktop` (a 404 is fine).
2. `npm version <version> --no-git-tag-version`; verify both `package.json` and `package-lock.json` carry the new version.
3. Write release notes at `docs/release-<version>.md` in the style of the latest beta notes: what changed since the previous beta (`git log <previous-tag>..HEAD --oneline`), how to install, and honestly what was not verified.
4. Validate: `npm run check:release` and `npm run build`. Optional pre-flight: `npm run package:win` + `node scripts/verify-release.cjs release` (the tagged workflow rebuilds from source anyway).
5. Check publisher prerequisites (names only, never values): `gh api repos/SILLEN69/schoolwork-desktop/actions/variables --jq '.variables[].name'` must include `SCHOOLWORK_GOOGLE_CLIENT_ID`, and `gh api repos/SILLEN69/schoolwork-desktop/actions/secrets --jq '.secrets[].name'` must include `SCHOOLWORK_GOOGLE_CLIENT_SECRET`. If either is missing, stop and report exactly what is missing.
6. Commit the version bump + release notes on `beta`, `git push origin beta`, then `git tag v<version>` and `git push origin v<version>`.
7. Follow the workflow: `gh run list --repo SILLEN69/schoolwork-desktop --workflow release.yml --limit 1` and `gh run watch <id> --repo SILLEN69/schoolwork-desktop`. On failure, report the exact failing job and a bounded log excerpt. Do not delete the tag without explicit confirmation.
8. Verify public assets: `gh release view v<version> --repo SILLEN69/schoolwork-desktop --json assets,isDraft,isPrerelease,url` — expect `SchoolWork-<version>-x64-setup.exe`, `SchoolWork-<version>-x64-portable.exe`, `SchoolWork-<version>-x64-setup.exe.blockmap`, `beta.yml`, `SHA256SUMS-v<version>.txt`, all uploaded, and `beta.yml` pointing at the new version.
9. Report: version, tag, commit, workflow run id + conclusion, release URL, asset list with sizes, beta update-feed status, and any unresolved problem.
