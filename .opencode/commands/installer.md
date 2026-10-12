---
description: Build Windows installer and portable packages and verify manifests/checksums
agent: build
---

This command authorizes: local packaging only. Do not publish, push or tag.

1. From the repository root: `npm run package:win` — builds renderer, Electron bundles and the Windows helper, then NSIS installer + portable binary into `release/`.
2. Verify integrity: `node scripts/verify-release.cjs release` — must PASS for the current package.json version (version/path/URL in the update manifest, blockmap, assets, installer SHA-512).
3. If the build fails at the startup-asset guard, the cause is usually stale startup media: run `npm run animation:render` first, then retry. Report the exact error for any other failure (for example a terminated C# compiler).
4. Report exact output paths with sizes for the current version: `release/SchoolWork-<version>-x64-setup.exe`, `release/SchoolWork-<version>-x64-portable.exe`, the update manifest (`beta.yml` for beta versions, `latest.yml` for stable), `release/SchoolWork-<version>-x64-setup.exe.blockmap`, plus SHA-256 of both binaries (`Get-FileHash -Algorithm SHA256`).

Do not run `scripts/publish-release.mjs` and do not upload anything.
