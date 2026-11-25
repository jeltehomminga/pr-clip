#!/usr/bin/env node
// The 1:1 check of a clip's captures as one script: what a subagent used to read frame by frame.
//
//   node scripts/capture-check.js <KEY> [file ...]       (files in videos/<KEY>/media/; default all)
//
// Before it, a 1:1 check subagent took about 14 min and 57–85 turns per clip, mostly cropping
// and reading frames to find where a motion settles. This prints, per file in media/:
//   - the status bar (scripts/statusbar-check.js; n/a for a size it has no geometry for, e.g. web);
//   - motion spans and rest frames, for the whole frame and for each `probe` region the take lists
//     in capture/takes.json (`{ "label": "sheet", "crop": "W:H:X:Y" }`, in the file's own pixels);
//   - the take's row from capture/run-<side>.tsv (identifiers, LogBox, writes), when the runner made it;
//   - two images in qa/check/: <file>.png (every 3rd frame, numbered) and <file>-bands.png (top and
//     bottom 200 px of the first and last frame, at 1:1). Open those; open single frames only where
//     a row or an image is off.
// Exit 1 when a status bar or a run row fails.
//
// Motion: frames at 1/4 size in grey; a pixel changed when it moved more than 10 luma since the
// last frame; a frame moves when at least 0.3 % of a probe region changed (h264 noise and a touch
// dot's fade stay under it), or 0.05 % of the whole frame, so a typed letter still shows. Runs
// split on 3 still frames; the rest frame is the first still frame after a run. Lone moving frames
// are listed apart: a cursor blink and a typed key look the same. On a 10-take clip, against the
// rest frames read by hand, the probe regions were within 1 frame and the whole frame within 2 (a
// touch dot's fade keeps the whole frame moving a little longer). Read both lines. A whole-screen
// mean luma, not used here, put drag landings 20–23 frames early.

const fs = require("fs")
const path = require("path")
const { execFileSync, spawnSync } = require("child_process")

const studio = path.join(__dirname, "..")
const font = path.join(studio, "src/assets/SchibstedGrotesk-SemiBold.ttf")
const screenShare = 0.0005 // of the whole frame: catches a typed letter's neighbourhood, not h264 noise
const probeShare = 0.003 // of a probe region: a touch dot's fade stays under it

const size = (file) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file])
    .toString()
    .trim()
    .split("x")
    .map(Number)

// Changed pixels per frame (frame 0 is 0) inside crop "W:H:X:Y", at 1/4 size.
const changedCounts = (file, crop) => {
  const [cw, ch, cx, cy] = crop.split(":").map(Number)
  const w = Math.max(1, Math.round(cw / 4))
  const h = Math.max(1, Math.round(ch / 4))
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-fps_mode", "passthrough", "-vf", `format=gray,crop=${cw}:${ch}:${cx}:${cy},scale=${w}:${h}:flags=area`, "-f", "rawvideo", "-"],
    { maxBuffer: 1 << 30 },
  )
  const px = w * h
  const counts = [0]
  for (let f = 1; f < raw.length / px; f++) {
    let c = 0
    for (let i = 0; i < px; i++) if (Math.abs(raw[(f - 1) * px + i] - raw[f * px + i]) > 10) c++
    counts.push(c)
  }
  return { counts, px }
}

// runs: [[first moving frame, last moving frame], ...], rest = last + 1; lone: single moving frames
// (a cursor blink or a typed key: they look alike, so both are listed, never dropped)
const spans = (counts, px, share) => {
  const found = []
  let cur = null
  let still = 0
  counts.forEach((c, i) => {
    if (c < px * share) return still++
    if (cur && still < 3) cur[1] = i
    else found.push((cur = [i, i]))
    still = 0
  })
  return { runs: found.filter(([a, b]) => b > a), lone: found.filter(([a, b]) => a === b).map(([a]) => a) }
}

const describe = ({ runs, lone }, frames) =>
  [
    ...runs.map(([a, b]) => `${a}..${b} rest ${b + 1 < frames ? b + 1 : "none (moves to the end)"}`),
    ...(lone.length ? [`lone frames ${lone.join(" ")}`] : []),
  ].join(" · ") || "still"

const images = (file, out, isVideo, [width, height]) => {
  // input n's top and bottom 200 px as [<tag>t] and [<tag>u]
  const bands = (n, tag) =>
    `[${n}]split[${tag}a][${tag}b];[${tag}a]crop=${width}:200:0:0[${tag}t];[${tag}b]crop=${width}:200:0:${height - 200}[${tag}u]`
  if (!isVideo) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-filter_complex", `${bands(0, "f")};[ft][fu]vstack`, `${out}-bands.png`])
    return
  }
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", file, "-sseof", "-0.2", "-i", file, "-filter_complex",
    `${bands(0, "f")};${bands(1, "l")};[ft][fu][lt][lu]vstack=inputs=4`, "-frames:v", "1", `${out}-bands.png`,
  ])
  const frames = Number(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file]))
  const rows = Math.ceil(Math.ceil(frames / 3) / 10)
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-i", file, "-vf",
    `drawtext=fontfile=${font}:text='%{n}':x=12:y=12:fontsize=110:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=10,select='not(mod(n\\,3))',scale=180:-1,tile=10x${rows}`,
    "-fps_mode", "passthrough", "-frames:v", "1", `${out}.png`,
  ])
  return frames
}

// take name -> { take, kind, ..., status } from app-takes.sh's capture/run-<side>.tsv
const runRows = (dir) => {
  const rows = {}
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!/^run-.*\.tsv$/.test(f)) continue
    const [head, ...lines] = fs.readFileSync(path.join(dir, f), "utf8").trim().split("\n").map((l) => l.split("\t"))
    for (const cells of lines) rows[cells[0]] = Object.fromEntries(head.map((h, i) => [h, cells[i]]))
  }
  return rows
}

if (require.main === module) {
  const [key, ...only] = process.argv.slice(2)
  if (!key) {
    console.error("usage: scripts/capture-check.js <KEY> [file ...]")
    process.exit(2)
  }
  const dir = path.join(studio, "videos", key)
  const media = path.join(dir, "media")
  const takesFile = path.join(dir, "capture/takes.json")
  const takes = fs.existsSync(takesFile) ? JSON.parse(fs.readFileSync(takesFile, "utf8")).takes : []
  const run = runRows(path.join(dir, "capture"))
  const out = path.join(dir, "qa/check")
  fs.mkdirSync(out, { recursive: true })
  const files = only.length
    ? only
    : fs.readdirSync(media).filter((f) => /\.(png|mp4)$/.test(f) && !/-(first|last)\.png$/.test(f))
  let failed = 0
  for (const name of files) {
    const file = path.join(media, name)
    const base = name.replace(/\.(png|mp4)$/, "")
    const isVideo = name.endsWith(".mp4")
    const dims = size(file)
    const bar = spawnSync("node", [path.join(__dirname, "statusbar-check.js"), file], { encoding: "utf8" }).stdout.trim()
    const barText = /no geometry/.test(bar) ? "n/a" : bar.replace(/^.*status bar /, "")
    if (barText.startsWith("FAIL")) failed++
    const frames = images(file, path.join(out, base), isVideo, dims)
    console.log(`${name}  ${dims.join("x")}${isVideo ? `  ${frames} frames` : ""}  status bar ${barText}`)
    if (isVideo) {
      const whole = changedCounts(file, `${dims[0]}:${dims[1]}:0:0`)
      console.log(`  motion  screen: ${describe(spans(whole.counts, whole.px, screenShare), frames)}`)
      for (const p of takes.find((t) => t.name === base)?.probe ?? []) {
        const r = changedCounts(file, p.crop)
        console.log(`  motion  ${p.label} (${p.crop}): ${describe(spans(r.counts, r.px, probeShare), frames)}`)
      }
    }
    const row = run[base]
    if (row && row.status !== "ok") failed++
    console.log(`  run     ${row ? `${row.status} · ids ${row.ids} · writes ${row.writes}` : "no row (not taken by app-takes.sh)"}`)
    console.log(`  look    ${path.relative(studio, path.join(out, base))}${isVideo ? ".png, " + base + "-bands.png" : "-bands.png"}`)
  }
  process.exit(failed ? 1 : 0)
}

module.exports = { spans }
