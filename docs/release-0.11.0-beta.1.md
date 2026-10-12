# SchoolWork 0.11.0-beta.1 — atom working indicator and star catch

Beta Windows x64 installer and portable application are published as [v0.11.0-beta.1](https://github.com/SILLEN69/schoolwork-desktop/releases/tag/v0.11.0-beta.1), built from the beta branch on top of the 0.10.1 main source. The release includes the installer blockmap, `beta.yml` update feed and SHA-256 checksums.

- While a task runs, the activity bar shows an animated atom: three stars orbit their own tilted ellipses with fading trails while the disc, orbits and nucleus breathe gently together. A static version of the same atom marks the welcome screen for new profiles.
- Clicking the working atom opens **Star catch**: a 30-second fidget game where you click the orbiting stars before time runs out. Best score is stored locally; Escape, × or Back to work closes the game.
- The "Task complete" in-app notice no longer appears while the app window is focused — the chat already shows the result. Completion and error notices now carry a static atom badge.
- A Remotion bumper set was added for brand animation: `SchoolWorkLoop` (2s seamless atom loading spinner), landscape/portrait stingers and `LessonToAction`, together with the Remotion agent skills for source contributors.

## Channel

This is a prerelease on the beta channel (`beta.yml` feed). Stable users on `latest.yml` are unaffected. Binaries are unsigned.

## Validation

Local validation on 13 October 2026: 176 unit tests passed, the full Windows application build including the native desktop helper passed, and the startup source/asset consistency gate passed. The tagged release workflow additionally runs Linux lesson/UI verification and the Windows build, unit tests, packaging and uploaded-asset integrity checks before publishing.
