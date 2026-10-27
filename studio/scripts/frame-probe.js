#!/usr/bin/env node
// Measure UI motion frame-by-frame from a screen recording — without writing a single image.
//
// WHY THIS EXISTS: "does this tween or does it teleport" is only answerable from
// real frames, and the obvious way to get them (`ffmpeg ... frame_%04d.png`, then
// decode each one) is catastrophically wasteful — a single 30-second clip produced
// 554MB of PNG+BMP pairs on 2026-08-21 to answer four yes/no questions, roughly
// 630x the size of the source video. ffmpeg can answer both questions on stdout:
// per-frame luma statistics for "did it change", and a raw one-pixel-tall strip for
// "where exactly is the element". Neither writes a file.
//
// It also owns the four flags that are easy to get wrong, and were:
//   * `-fps_mode passthrough`  — one output per REAL source frame. `-vf fps=60`
//     against a 30fps capture duplicates every frame: double the work, zero extra
//     temporal information, and a timing claim that is 2x too precise.
//   * `-copyts`                — keeps ABSOLUTE timestamps after a `-ss` seek, so
//     pts_time is time-in-the-recording and needs no offset arithmetic.
//   * `-ss` / `-to` before `-i` — fast seek; decoding only the window that matters.
//   * `format=gray` BEFORE `crop` — the crop filter on yuv420p silently rounds odd
//     widths, heights and offsets DOWN to even. A `crop=117:3:48:441` quietly became
//     116x2, every byte offset shifted, and the parse produced a plausible-looking
//     continuous sweep for a component with no animation code in it at all. Convert
//     to gray first: no chroma plane, no rounding. This script always does.
//
// Usage:
//   node frame-probe.js <video.mp4> --crop W:H:X:Y [options]
//
//   --mode stats      (default) per-frame luma average over the crop. Answers
//                     "did anything change, and over how many frames".
//   --mode profile    per-frame bounding box of the element along one axis.
//                     Answers "where exactly is it, and how far did it travel".
//
//   --from S --to S   seconds; window the probe (fast seek, absolute timestamps kept)
//   --tolerance N     two readings within N count as the same state.
//                     Default 0.5 for stats (h264 noise moves YAVG by ~0.01), 0 for profile.
//   --min-plateau N   frames a value must hold to count as a settled state (default 3)
//   --polarity bright|dark   profile only: is the element brighter or darker than its
//                     surroundings (default bright)
//   --threshold N     profile only: luma cutoff, 0-255 (default 240 bright / 60 dark)
//   --axis x|y        profile only: which axis to bound (default x)
//   --row N           profile only: which row of the crop to scan (default: middle)
//   --scale N         device pixel ratio, for reporting points as well as pixels (default 3)
//   --fps N           source frame rate, for turning a frame count into a duration (default 30)
//   --csv             also print every frame, not just the summary
//
// Reading the verdict: TELEPORT = zero frames between the two settled states.
// TWEEN = N frames between them, and N/fps is the animation's REAL duration —
// which is how you check a claimed duration instead of trusting it.
//
// Recording defaults matter as much as extraction. Capture with
// `screen-recording-start { showTouches: false, trimStatic: false }` — see the
// "Measurement mode (video)" section of SKILL.md for why both defaults are wrong here.

const { spawn } = require("child_process")

// --- arguments ---------------------------------------------------------------
const argv = process.argv.slice(2)
const video = argv.find((a) => !a.startsWith("--"))
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

if (!video || !flag("crop")) {
  console.error("usage: frame-probe.js <video.mp4> --crop W:H:X:Y [--mode stats|profile] [...]")
  console.error("       run with no arguments to see the full option list in the header comment")
  process.exit(2)
}

const mode = flag("mode", "stats")
const [cropW, cropH, cropX, cropY] = flag("crop").split(":").map(Number)
if ([cropW, cropH, cropX, cropY].some((n) => !Number.isFinite(n))) {
  console.error(`--crop must be W:H:X:Y in pixels, got "${flag("crop")}"`)
  process.exit(2)
}

const from = flag("from")
const to = flag("to")
const fps = Number(flag("fps", 30))
const scale = Number(flag("scale", 3))
const minPlateau = Number(flag("min-plateau", 3))
const csv = has("csv")
const polarity = flag("polarity", "bright")
const threshold = Number(flag("threshold", polarity === "dark" ? 60 : 240))
const axis = flag("axis", "x")
const tolerance = Number(flag("tolerance", mode === "stats" ? 0.5 : 0))
const row = flag("row") === undefined ? Math.floor(cropH / 2) : Number(flag("row"))

// --- ffmpeg invocation -------------------------------------------------------
// -ss/-to go BEFORE -i (fast seek). -copyts keeps pts_time absolute across the seek.
const seek = []
if (from !== undefined) seek.push("-ss", String(from))
if (to !== undefined) seek.push("-to", String(to))

// format=gray BEFORE crop — see the header. Never reorder these two.
const cropFilter = `format=gray,crop=${cropW}:${cropH}:${cropX}:${cropY}`

const args =
  mode === "stats"
    ? ["-v", "error", "-copyts", ...seek, "-i", video,
       "-vf", `${cropFilter},signalstats,metadata=print:file=-`,
       "-fps_mode", "passthrough", "-f", "null", "-"]
    : ["-v", "error", "-copyts", ...seek, "-i", video,
       "-vf", cropFilter,
       "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "-"]

const ff = spawn("ffmpeg", args)
const out = []
const err = []
ff.stdout.on("data", (d) => out.push(d))
ff.stderr.on("data", (d) => err.push(d))

ff.on("error", (e) => {
  console.error(`could not run ffmpeg: ${e.message}`)
  console.error("install it with: brew install ffmpeg")
  process.exit(1)
})

ff.on("close", (code) => {
  const stderr = Buffer.concat(err).toString()
  if (code !== 0) {
    console.error(stderr.trim() || `ffmpeg exited ${code}`)
    process.exit(1)
  }
  // `metadata=print:file=-` writes to stdout, but ffmpeg's own diagnostics go to
  // stderr — read both so a change in either stream cannot silently blank the parse.
  if (mode === "stats") reportStats(parseStats(Buffer.concat(out).toString() + stderr))
  else reportProfile(parseProfile(Buffer.concat(out)))
})

// --- parsing -----------------------------------------------------------------
// signalstats emits two lines per frame:
//   frame:12   pts:6144    pts_time:0.4
//   lavfi.signalstats.YAVG=244.171
const parseStats = (text) => {
  const frames = []
  let pending
  for (const line of text.split("\n")) {
    const head = /^frame:(\d+).*pts_time:([\d.-]+)/.exec(line)
    if (head) {
      pending = { frame: Number(head[1]), t: Number(head[2]) }
      continue
    }
    const yavg = /lavfi\.signalstats\.YAVG=([\d.-]+)/.exec(line)
    if (yavg && pending) {
      frames.push({ ...pending, value: Number(yavg[1]) })
      pending = undefined
    }
  }
  if (!frames.length) {
    console.error("no signalstats output — is the crop inside the frame?")
    process.exit(1)
  }
  return frames
}

// rawvideo gray: exactly cropW*cropH bytes per frame, no padding, once format=gray
// runs before crop. If that assertion fails the offsets are meaningless, so stop.
const parseProfile = (buf) => {
  const frameSize = cropW * cropH
  if (buf.length === 0) {
    console.error("ffmpeg produced no frames — is the crop inside the frame?")
    process.exit(1)
  }
  if (buf.length % frameSize !== 0) {
    console.error(`alignment mismatch: ${buf.length} bytes is not a multiple of ${cropW}x${cropH}=${frameSize}.`)
    console.error("ffmpeg re-sized the crop, so every byte offset below would be wrong. Refusing to guess.")
    process.exit(1)
  }
  if (row < 0 || row >= cropH) {
    console.error(`--row ${row} is outside the crop height ${cropH}`)
    process.exit(1)
  }

  const n = buf.length / frameSize
  const hit = (v) => (polarity === "dark" ? v <= threshold : v >= threshold)
  const frames = []

  for (let f = 0; f < n; f++) {
    let lo = -1
    let hi = -1
    if (axis === "x") {
      const base = f * frameSize + row * cropW
      for (let x = 0; x < cropW; x++) {
        if (hit(buf[base + x])) {
          if (lo < 0) lo = x
          hi = x
        }
      }
    } else {
      const col = row // with --axis y, --row selects the column to scan
      for (let y = 0; y < cropH; y++) {
        if (hit(buf[f * frameSize + y * cropW + col])) {
          if (lo < 0) lo = y
          hi = y
        }
      }
    }
    frames.push({
      frame: f,
      t: (from === undefined ? 0 : Number(from)) + f / fps,
      value: lo,
      lo,
      hi,
      size: lo < 0 ? 0 : hi - lo + 1,
    })
  }
  return frames
}

// --- plateau detection -------------------------------------------------------
// A "plateau" is a run of >= minPlateau consecutive frames whose values all sit
// within `tolerance` of the run's first value. Everything between two plateaus is
// an intermediate frame — and the count of those is the whole answer.
const plateaus = (frames) => {
  const runs = []
  let start = 0
  for (let i = 1; i <= frames.length; i++) {
    const same = i < frames.length && Math.abs(frames[i].value - frames[start].value) <= tolerance
    if (same) continue
    if (i - start >= minPlateau) runs.push({ from: start, to: i - 1, value: frames[start].value })
    start = i
  }
  return runs
}

const verdict = (frames, runs, fmt, delta) => {
  if (runs.length < 2) {
    console.log(`\nOnly ${runs.length} settled state(s) found — nothing transitioned in this window.`)
    console.log("If you expected a change: widen --from/--to, or loosen --min-plateau / --tolerance.")
    return
  }
  console.log("\nTransitions:")
  for (let i = 1; i < runs.length; i++) {
    const a = runs[i - 1]
    const b = runs[i]
    const gap = b.from - a.to - 1
    const t0 = frames[a.to].t
    const t1 = frames[b.from].t
    console.log(
      `  ${fmt(a.value)} -> ${fmt(b.value)}   ` +
        `frame ${frames[a.to].frame} -> ${frames[b.from].frame}   t=${t0.toFixed(4)}s -> ${t1.toFixed(4)}s`
    )
    console.log(
      gap === 0
        ? `    TELEPORT — 0 intermediate frames (bounded above by one frame, <=${(1000 / fps).toFixed(1)}ms at ${fps}fps)`
        : `    TWEEN — ${gap} intermediate frame(s) = ${((gap / fps) * 1000).toFixed(0)}ms at ${fps}fps`
    )
    if (delta) console.log(`    ${delta(a.value, b.value)}`)
  }
}

// --- reporting ---------------------------------------------------------------
const header = (frames) => {
  console.log(`video      ${video}`)
  console.log(`crop       ${cropW}x${cropH} at (${cropX},${cropY})   [format=gray applied before crop]`)
  console.log(`window     ${from === undefined ? "whole clip" : `${from}s`}${to === undefined ? "" : ` .. ${to}s`}`)
  console.log(`frames     ${frames.length} at ${fps}fps (passthrough — one per real source frame)`)
}

const reportStats = (frames) => {
  header(frames)
  console.log(`mode       stats (luma average over the crop), tolerance ${tolerance}`)
  if (csv) {
    console.log("\nframe,pts_time,YAVG")
    frames.forEach((f) => console.log(`${f.frame},${f.t.toFixed(4)},${f.value.toFixed(4)}`))
  }
  const runs = plateaus(frames)
  console.log(`\nSettled states: ${runs.length}`)
  runs.forEach((r) =>
    console.log(`  YAVG ${r.value.toFixed(3)}  frames ${frames[r.from].frame}..${frames[r.to].frame}  (${r.to - r.from + 1} frames)`)
  )
  verdict(frames, runs, (v) => `YAVG ${v.toFixed(3)}`)
}

const reportProfile = (frames) => {
  header(frames)
  console.log(`mode       profile (${axis}-axis bounding box, ${polarity} >= threshold ${threshold}, row ${row})`)
  if (csv) {
    console.log("\nframe,pts_time,lo,hi,size")
    frames.forEach((f) => console.log(`${f.frame},${f.t.toFixed(4)},${f.lo},${f.hi},${f.size}`))
  }

  const missing = frames.filter((f) => f.lo < 0).length
  if (missing) console.log(`\nWARNING: ${missing} frame(s) matched nothing at threshold ${threshold} — check --polarity / --threshold.`)

  const sizes = [...new Set(frames.filter((f) => f.lo >= 0).map((f) => f.size))]
  console.log(`\nElement size along ${axis}: ${sizes.join(", ")} px  (${sizes.map((s) => (s / scale).toFixed(2)).join(", ")} pt)`)
  if (sizes.length > 1) console.log("  (more than one size — antialiasing, or the scan row is off the element's centre)")

  const runs = plateaus(frames)
  console.log(`\nSettled positions: ${runs.length}`)
  runs.forEach((r) =>
    console.log(`  ${axis}0=${r.value}px  frames ${frames[r.from].frame}..${frames[r.to].frame}  (${r.to - r.from + 1} frames)`)
  )
  verdict(frames, runs, (v) => `${axis}0=${v}px`, (a, b) => {
    const px = Math.abs(b - a)
    return `travelled ${px}px = ${(px / scale).toFixed(2)}pt at ${scale}x`
  })

  if (runs.length >= 2) {
    const values = runs.map((r) => r.value)
    const px = Math.max(...values) - Math.min(...values)
    console.log(`\nDistinct settled ${axis}0 positions: ${[...new Set(values)].sort((p, q) => p - q).join(", ")} px`)
    console.log(`Full travel (extremes): ${px}px = ${(px / scale).toFixed(2)}pt at ${scale}x`)
  }
}
