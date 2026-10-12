# SchoolWork startup animation

A 96-frame Remotion atom-and-wordmark reveal, currently 3840x2160 at 45fps (about 2.13 seconds). The 1280x720 design scales uniformly with the canvas. The desktop app plays a local prerendered copy with keyboard skip, a hard exit deadline and a reduced-motion still. Remotion is a development dependency of this separate project, not an app startup dependency.

## Preview

From this folder, run:

```powershell
npm ci
npm run dev -- --no-open --port=3210
```

Then open `http://localhost:3210/SchoolWorkStartup` in a browser.

The atom, wordmark, tagline, glow and closing caption are named interactive layers. Select a layer to adjust its styles. Procedural orbit/letter calculations still require source editing; not every keyframe is editable in Studio.

## App intro

After editing, run `npm run animation:render` from the main checkout. It renders the MP4 and JPEG to `src/assets` and updates the source/asset hash manifest. The main build rejects stale or missing assets with the exact recovery command. Source hashes normalize line endings for Windows/Linux checkouts.

The desktop app uses `../src/ui/StartupIntro.tsx` and `../src/ui/startup-intro.css`. Normal playback follows the rendered clip and adds a short fade. A stalled video exits by 4.4 seconds; reduced motion exits in about 0.4 seconds. Settings includes **Preview startup animation**. Earlier tests may assume the former 30fps/3.2-second clip; review those expectations before the next release.

Run `npm run test:motion` from the main checkout for isolated Windows Electron checks. Ordinary UI motion uses CSS and honors reduced motion. No private profile or live model is used by these checks.
