#!/usr/bin/env node
// Status bar gate: does a capture's status bar show only what the clean demo bar shows?
//
//   node scripts/statusbar-check.js <file.png|file.mp4> [...]      exit 0 = every bar clean, 1 = not
//   node scripts/statusbar-check.js --save-ref <clean file> [name]  keep its bar as the reference
//                                                                   (with a name: one more, <w>x<h>-<name>.png)
//
// Once, all 10 files of a clip carried a Safety Center shield and a "!" on the wifi icon,
// found only by the 1:1 check after every take, and the re-shoot cost ~33 min. This compares the
// bar's icons with a reference bar a person has looked at, so a take fails before it is kept.
//
// How: the bar's rows become a mask of "ink": pixels further off the bar's most common luma than
// half its strongest contrast. So a light bar, a dark bar and a bar dimmed by a sheet's scrim
// (icons only ~50 luma off it) give the same mask. Screen corners and the camera cutout are
// skipped (black on every bar, which is ink on a light bar only), and so are coloured pixels.
// More than 60 pixels of ink that the reference lacks, or that it has and the capture lacks, fails.
// Measured on 199 files of 15 app clips: clean bars differ by at most 36 (a dark bar),
// and every bad bar failed: a shield and a "!" (520 px), and elsewhere a
// wrong clock, a missing signal and a text overlay.
// A recording is checked on its first and last frame (demo mode hides notifications in between).
//
// References live in scripts/statusbar/<w>x<h>.png, one per capture size, with the rows and
// skipped columns below. A new device size needs a geometry entry and --save-ref of a clean file.
// A new OS version on the same size draws other glyphs (iOS 27's signal and wifi icons fail the
// iOS 26 reference by ~450 px on a clean bar): add `--save-ref <clean file> <name>`, which keeps
// <w>x<h>-<name>.png next to the first. A bar passes when it matches any reference of its size.

const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const geometry = {
  "1080x2424": { y: 48, h: 50, skip: [[0, 45], [470, 610], [1035, 1080]] }, // Pixel_10
  "1080x1752": { y: 44, h: 46, skip: [[0, 45], [345, 430], [1035, 1080]] }, // Pixel_10 at wm size 1080x1751, cropped to content
  "1206x2622": { y: 70, h: 56, skip: [[400, 805], [1008, 1206]] }, // iPhone 17 Pro: island; battery (set by the override, its grey outline flips with the bar)
}
// A screencap under `wm size 1080x1751` is the same screen as the cropped recording (statusbar.sh
// proves the bar on one before each take)
const sameAs = { "1080x1751": "1080x1752" }
const minContrast = 12 // below this the bar is blank: everything counts as missing
const maxChroma = 60 // coloured pixels (iOS's green battery) sit between bar and icon luma: left out
const maxDiff = 60
const refDir = path.join(__dirname, "statusbar")

const size = (file) =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file])
    .toString()
    .trim()

const band = (file, g, width, last = false) =>
  execFileSync("ffmpeg", [
    "-v", "error", ...(last ? ["-sseof", "-0.2"] : []), "-i", file, "-frames:v", "1",
    "-vf", `crop=${width}:${g.h}:0:${g.y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ])

// 1 = ink, 0 = bar, -1 = not compared (a skipped column or a coloured pixel)
const mask = (rgb, g, width) => {
  const luma = []
  const kept = []
  for (let i = 0; i < rgb.length / 3; i++) {
    const [r, gr, b] = rgb.subarray(3 * i, 3 * i + 3)
    const x = i % width
    luma.push(Math.round(0.299 * r + 0.587 * gr + 0.114 * b))
    kept.push(!g.skip.some(([a, z]) => x >= a && x < z) && Math.max(r, gr, b) - Math.min(r, gr, b) <= maxChroma)
  }
  const hist = new Array(256).fill(0)
  luma.forEach((v, i) => kept[i] && hist[v]++)
  const bg = hist.indexOf(Math.max(...hist))
  const deltas = luma.filter((_, i) => kept[i]).map((v) => Math.abs(v - bg)).sort((a, b) => a - b)
  const threshold = Math.max(minContrast, deltas[Math.floor(deltas.length * 0.995)] / 2)
  return luma.map((v, i) => (kept[i] ? Number(Math.abs(v - bg) > threshold) : -1))
}

const compare = (a, b) => {
  let extra = 0
  let missing = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) continue
    if (a[i] && !b[i]) extra++
    if (!a[i] && b[i]) missing++
  }
  return { extra, missing }
}

const setup = (file) => {
  const s = sameAs[size(file)] ?? size(file)
  return { s, g: geometry[s], width: Number(s.split("x")[0]) }
}

// Every reference of a size: <w>x<h>.png and any <w>x<h>-<name>.png (another OS version).
const refsFor = (s) =>
  fs.existsSync(refDir) ? fs.readdirSync(refDir).filter((f) => f === `${s}.png` || (f.startsWith(`${s}-`) && f.endsWith(".png"))).map((f) => path.join(refDir, f)) : []

const args = process.argv.slice(2)
if (args[0] === "--save-ref") {
  const { s, g, width } = setup(args[1])
  if (!g) throw new Error(`no geometry for ${s}: add one to scripts/statusbar-check.js`)
  const out = path.join(refDir, args[2] ? `${s}-${args[2]}.png` : `${s}.png`)
  fs.mkdirSync(refDir, { recursive: true })
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", args[1], "-frames:v", "1", "-vf", `crop=${width}:${g.h}:0:${g.y}`, out])
  console.log(`reference ${out}`)
  process.exit(0)
}
if (!args.length) {
  console.error("usage: statusbar-check.js <file.png|file.mp4> [...] | --save-ref <clean file> [name]")
  process.exit(2)
}

let failed = 0
for (const file of args) {
  const { s, g, width } = setup(file)
  const refFiles = g ? refsFor(s) : []
  if (!g || !refFiles.length) {
    console.log(`${file}: status bar FAIL no ${g ? "reference" : "geometry"} for ${s} (header of this script)`)
    failed++
    continue
  }
  const refs = refFiles.map((f) => mask(execFileSync("ffmpeg", ["-v", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]), g, width))
  const frames = file.endsWith(".mp4") ? [["first", false], ["last", true]] : [["still", false]]
  // Against the closest reference: the one whose worse count is lowest.
  const worst = (d) => Math.max(d.extra, d.missing)
  const closest = (m) => refs.map((ref) => compare(m, ref)).reduce((a, b) => (worst(b) < worst(a) ? b : a))
  const diffs = frames.map(([name, last]) => ({ name, ...closest(mask(band(file, g, width, last), g, width)) }))
  const bad = diffs.some((d) => d.extra > maxDiff || d.missing > maxDiff)
  if (bad) failed++
  const detail = diffs.map((d) => `${d.name} ${d.extra} px extra, ${d.missing} missing`).join("; ")
  console.log(`${file}: status bar ${bad ? "FAIL" : "ok"} (${detail})`)
}
process.exit(failed ? 1 : 0)
