# SchoolWork — 30-second product trailer

Local video exports. Nothing has been published.

- `SchoolWork-30s-Portrait.mp4`: 1080 × 1920, 30 fps; social portrait cut.
- `SchoolWork-30s-Landscape.mp4`: 1920 × 1080, 30 fps; landscape cut.
- Both follow the same 30-second edit, with compositions independently laid out for the frame shape.
- Scenes: lesson recording → transcript/notes → assignment → Calendar → summary request → pointer clicking Gmail Send → normal Work mode → brand closing.

## Music and effects

Original procedural electronic composition in an E/C-sharp-minor palette, 120 BPM. Warm stereo chords, plucked arpeggios, bass, kick/snare/hat percussion, a restrained email break and a resolving brand chime. Cuts land on the half-second beat grid. Separate sound-design track contains typing, pointer clicks, transition sweeps, confirmations and the Send accent. No third-party samples or commercial songs were used.

The final files use a -16 LUFS loudness target and -1.5 dBTP limiter target, stereo AAC at 48 kHz/192 kbps, H.264/yuv420p and fast-start MP4 layout. Measurements and stream metadata are saved alongside the exports.

## Source and editing

Source: `../schoolwork/remotion-startup/src/showcase/`. Each scene is a separate editable composition. Root registration preserves the existing startup composition.

From the Remotion project directory:

```text
python scripts/score-showcase.py
npm run lint
node scripts/render-showcase.mjs --stills
node scripts/render-showcase.mjs
```

The render command produces `*-raw.mp4`, then automatically masters and checks the final MP4s. To repeat only mastering, run `node scripts/master-showcase.mjs`. Music and effects can be mixed independently in `Showcase.tsx`. Cue timings are in `public/showcase/audio-cues.json`.

Preview: `http://localhost:3211/SchoolWorkShowcasePortrait` while the local Studio server is running. Select `SchoolWorkShowcaseLandscape` for the other frame shape.

## Representation

The owner requested animated screens styled after the current app, without a demo-mode label. These are product animations using fictional lesson content. Creating the video did not send an actual email, create a Calendar event, run a school-model task, or verify those integrations live. The video is not an acceptance-test recording.
