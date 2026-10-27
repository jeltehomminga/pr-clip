# PR clip studio

Remotion 4.0.520 studio for before/after clips of pull requests. House rules: `CLAUDE.md`. Procedure: the `pr-clip` skill.

```bash
npm ci
scripts/setup-tts.sh                 # once: the Kokoro voice (needs `brew install python@3.13`)
npm run studio                       # live preview of videos/EXAMPLE
npm test                             # timeline, props, stale and capture checks + type-check
scripts/clip.sh <KEY>                # props, test, render, stills, check, sheets in one call
scripts/render.sh <KEY> [--gif]      # videos/<KEY>/out: master, share copy, poster, GIF
scripts/check.sh <KEY>               # must exit 0; `check.sh sheet|phone <KEY>` makes review sheets
scripts/stale.sh [KEY...]            # fresh, same-ui, accepted or stale per clip
node scripts/measure-bounds.js videos/<KEY>/media/01-after.png --probe X,Y   # bracket rect, source pixels
scripts/extract-holds.sh <KEY> <clip.mp4> [trimBefore] [trimAfter]           # first/last frame of a recording
scripts/logbox-clear.sh <udid>       # app captures: no React Native LogBox on screen (exit 0)
```
