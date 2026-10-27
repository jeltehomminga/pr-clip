# Checks: what each check row means, and how to review a clip

What `scripts/check.sh` proves about a rendered clip, the trap behind each row, and the review you do by eye before the user sees it.

Run every command from the studio: `cd "${PR_CLIP_STUDIO:-$HOME/pr-clip-studio}"`.

## Capture check (before props)

Look at every capture's top and bottom 200 px at 1:1. A contact sheet hides all of what follows.

```bash
node scripts/capture-check.js <KEY> [file …]
```

- It writes `qa/check/<file>-bands.png` (the top and bottom bands of the first and last frame, at 1:1) and `qa/check/<file>.png` (every 3rd frame, numbered).
- It checks the app status bar, and prints each recording's motion runs and rest frames.
- It took 5 s for 10 files. Open single frames only where a row or an image is off.

Crop or re-shoot anything that is not the product: a watermark, status-bar clutter, a dev overlay, LogBox, a blurred identifier that still reads.

## check.sh rows

`scripts/check.sh <KEY>` must exit 0; then it writes `out/check.ok`. `scripts/clip.sh <KEY>` runs it after the render.

- Post only a share copy older than `out/check.ok`. A stale check once passed a stale mp4.
- `render.sh` empties `out/` first, for the same reason.

| Row | Passes when |
|---|---|
| duration | the master's frame count is the timeline's total ± 1 |
| format | 1920×1080, `30/1`, `bt709/bt709/bt709`, on the master and the share copy |
| tail | the share copy's audio ends no later than its video |
| context | the share copy's comment tag parses as JSON, names this clip's `issueKey`, and is plain ASCII |
| size | the share copy is at most 5 MB (more with `maxSeconds`) |
| gif | the GIF is at most 2.5 MB |
| fit | 0 `FIT:` lines in `out/render.log` |
| console | 0 browser warnings or errors in `out/render.log` |
| determinism | one mid-motion frame rendered twice has the same md5 |
| peak | true peak at most −1.5 dBTP |
| loudness | with a voice: integrated −16 ±1 LUFS |
| qr | with `details`: the end card's QR decodes to `details.url` |

## Why each row

- **duration.** The master's frame count must match `timeline().total` ± 1. A mismatch means the render and the timeline disagree about the clip.
- **format.** Remotion tags only the colour matrix, and recent ffmpeg ignores `-color_primaries` / `-color_trc` on encode. So `render.sh` retags the stream with the `h264_metadata` bitstream filter, without encoding again.
- **tail.** Remotion's AAC runs about 60 ms past the last frame, and QuickTime shows black for that tail: every clip seemed to end on a black screen. `render.sh` trims the audio with `atrim=end=<video duration>`.
- **context.** `render.sh` writes the agent context from `scripts/context.ts` into the mp4's `comment` tag. ASCII, so `strings` returns it whole.
- **size.** At most 5 MB, with a warning above 2.5 MB per 30 s. `maxSeconds` in `props.json` lifts the 60 s cap, and the share copy may then take 5 MB per 60 s. A lean-in about doubles the bitrate of a still pair: 0.6 → 1.6 MB for a 24 s app clip.
- **gif.** The first 6 s, at most 2.5 MB.
- **fit.** The caption and the end card log `FIT:` (`console.error`) when their text overflows.
  - Measure on a box that can't shrink. A render tab mounts at 251 px wide, and a shrinkable flex item logged a false FIT; hence `flexShrink: 0`.
  - Under transforms, measure layout sizes (`offsetHeight`), not `getBoundingClientRect`.
  - Captions hold at most 2 lines of 42 characters, at most 17 characters per second.
- **console.** Remotion writes the page's `console.warn` / `console.error` into `render.log` as `[Tab N, file:line] msg`. `console.log` only shows with `--log=verbose`.
- **determinism.** Every frame is a pure function of the frame number: no CSS transitions or animations, no timers, no `Date`, no unseeded random. The row renders one frame mid lean-in twice and compares the md5.
- **peak.** True peak at most −1.5 dBTP. To compare loudness between clips, use LUFS (`ffmpeg -i x.mp4 -af ebur128 -f null -`, M max), not peak: a whoosh peaked like a tick but read 10 LU quieter.
- **loudness.** Only with `voice` in `props.json`. `render.sh` levels the whole mix to −16 LUFS with a gain and a limiter. A clip with only its sounds stays as rendered: levelling would boost the ticks.
- **qr.** Only with `details` and `details.url`, unless `qr: false`. `scripts/qr-check.ts` decodes the QR from the share copy's last frame at 1920 and at 960 px wide (about an inline player). Both must read `details.url`.
  - A phone read the same end card, so a passing row needs no phone scan.
  - The 5×5 alignment pattern near the bottom right must be drawn solid, like the finder eyes. As loose round dots it broke the scanner's 1:1:1 run check: the 1920 read failed on 3 of 4 end cards while 960 passed. Changing the eyes' corner radius did nothing.

## Review

Do this after `scripts/clip.sh <KEY>` exits 0 and before the user sees the clip.

1. **Sheets first.** `scripts/check.sh sheet <KEY>` writes `out/sheet-NN.png`: 2 fps tiles at 270 px, from the master. Look for order, pacing, a beat that's missing or twice.
2. **Then the stills.** `clip.sh` writes `out/still-NN.png`: one full-size frame per beat (its settled frame; the end card's last frame), from the crf-18 master. Check brackets, fades and the end card here: sheets hide what only 1:1 shows.
3. **Mid-move checks.** Anything that measures a moving element (a bracket, a lean-in) is checked on a settled frame and on a mid-move frame:

   ```bash
   ffmpeg -v error -i videos/<KEY>/out/master.mp4 -vf "select=eq(n\,<frame>)" -frames:v 1 videos/<KEY>/qa/mid.png
   ```

4. **Readability.** `scripts/check.sh phone <KEY>` writes `out/phone-NN.png`: 1 fps tiles at 360 px, from the share copy. Can a viewer on a phone read every caption and label?
5. **At most 3 self-review rounds.** Log each round in `review.md` § vN: what you looked at, what you found, what you changed. Then hand the share copy to the user with one question: approve, or what to change.

Masking text in shell (an identifier in a log or note): BSD `sed` has no `\b`; use `perl -pe`.
