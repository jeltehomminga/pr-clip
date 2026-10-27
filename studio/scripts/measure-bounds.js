#!/usr/bin/env node
// Source-pixel bounds of a solid region in a PNG - the rect a Highlight takes.
//
//   node scripts/measure-bounds.js <image.png> --probe X,Y [--tolerance N] [--bg X,Y [--gap N]]
//
// From the probe pixel, walks its row left and right and its column up and down
// while every pixel stays within --tolerance (max per-channel delta, default 12)
// of the probe colour, and prints the bounding box in source pixels as a
// ready-to-paste rect. The numbers come from the file, so they hold at any preview
// scale; a ring placed from an eyeballed preview was 15px off and nobody saw it
// until the encoded video.
//
// Two edges to choose from. Default: walk while the pixel matches the PROBE colour -
// the card's inner face, which stops short of a border or shadow (3px on typical
// dashboard cards). --bg X,Y names a pixel on the page background instead: the walk
// then continues until it has seen --gap (default 6) consecutive background pixels,
// so border, shadow and the anti-aliased seam between face and border all count as
// card - the outer edge, the one a ring should sit on. Keep --tolerance below the
// face/background difference (4 for white cards on a #f8fafc page). When
// page and card share a colour (white on white) there is no outer
// edge to find - the default walk stops at the border, which is the ring you want.
//
// Probe inside the card's PADDING, not on text or an icon - a glyph ends the walk
// early. Dark mode: card #2b3543 on page #1f2937 differ by at most 12 per channel,
// so pass --tolerance 6 there. A still cut from an h264 clip bleeds a pixel at the
// edges; prefer a PNG screenshot for measuring when you have one.
//
//   node scripts/measure-bounds.js <image.png> --region X,Y,W,H [--bg X,Y] [--tolerance N] [--rows] [--draw out.png]
//
// For what no walk can take - a white card on a white sheet, a dashed outline, a line of
// text: the bounding box of every pixel in the region (from the describe frame) that is
// more than --tolerance off the background (--bg, default the region's top-left pixel).
// White cards on a white sheet took --tolerance 10. --rows prints the runs of content and
// background rows, to find the gaps between stacked cards. --draw writes the rect onto a
// half-size copy of the image; look at it before the rect goes into props.
//
// PNG decoder: zero dependencies
// (8-bit, non-interlaced, colour types 0/2/4/6 - what argent and CDP write).

const fs = require("fs")
const zlib = require("zlib")
const { execFileSync } = require("child_process")

const decodePng = (buf) => {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG")
  let pos = 8
  let width, height, depth, colorType, interlace
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString("ascii", pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === "IDAT") idat.push(data)
    else if (type === "IEND") break
    pos += len + 12
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth} (need 8)`)
  if (interlace) throw new Error("interlaced PNG not supported")
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`unsupported colour type ${colorType}`)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(height * stride)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + i] : 0
      const c = i >= bpp && y > 0 ? out[(y - 1) * stride + i - bpp] : 0
      let v = line[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      out[y * stride + i] = v & 0xff
    }
  }
  return { width, height, channels, data: out }
}

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith("--"))
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
if (!file || !(flag("probe") || flag("region"))) {
  console.error("usage: measure-bounds.js <image.png> --probe X,Y [--tolerance N] [--bg X,Y [--gap N]]")
  console.error("       measure-bounds.js <image.png> --region X,Y,W,H [--bg X,Y] [--tolerance N] [--rows] [--draw out.png]")
  process.exit(2)
}
const tolerance = Number(flag("tolerance") ?? 12)
const img = decodePng(fs.readFileSync(file))

const at = (x, y) => {
  const i = (y * img.width + x) * img.channels
  const d = img.data
  return img.channels >= 3 ? [d[i], d[i + 1], d[i + 2]] : [d[i], d[i], d[i]]
}
const near = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= tolerance
const toHex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("")

if (flag("region")) {
  const [rx, ry, rw, rh] = flag("region").split(",").map(Number)
  if (!(rx >= 0 && ry >= 0 && rw > 0 && rh > 0 && rx + rw <= img.width && ry + rh <= img.height)) {
    console.error(`region ${flag("region")} is not inside the ${img.width}x${img.height} image`)
    process.exit(2)
  }
  const bgColor = at(...(flag("bg") ?? `${rx},${ry}`).split(",").map(Number))
  let left = Infinity
  let top = Infinity
  let right = -1
  let bottom = -1
  const runs = []
  for (let y = ry; y < ry + rh; y++) {
    let content = false
    for (let x = rx; x < rx + rw; x++) {
      if (near(at(x, y), bgColor)) continue
      content = true
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
    if (content) {
      top = Math.min(top, y)
      bottom = y
    }
    const last = runs[runs.length - 1]
    if (last && last.content === content) last.to = y
    else runs.push({ content, from: y, to: y })
  }
  if (right < 0) {
    console.error(`no pixel in the region is more than ${tolerance} off the background ${toHex(bgColor)}`)
    process.exit(1)
  }
  const rect = { left, top, width: right - left + 1, height: bottom - top + 1 }
  console.log(JSON.stringify({ image: `${img.width}x${img.height}`, region: [rx, ry, rw, rh], bg: toHex(bgColor), tolerance, ...rect }))
  console.log(`const rect = { left: ${rect.left}, top: ${rect.top}, width: ${rect.width}, height: ${rect.height} }`)
  if (argv.includes("--rows")) for (const r of runs) console.log(`  rows ${r.from}..${r.to} ${r.content ? "content" : "background"}`)
  if (flag("draw")) {
    const box = `drawbox=x=${rect.left}:y=${rect.top}:w=${rect.width}:h=${rect.height}:color=red:t=4`
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `${box},scale=iw/2:-1`, flag("draw")])
    console.log(`drew the rect on ${flag("draw")}`)
  }
  process.exit(0)
}

const [px, py] = flag("probe").split(",").map(Number)
if (!(px >= 0 && py >= 0 && px < img.width && py < img.height)) {
  console.error(`probe ${px},${py} is outside the ${img.width}x${img.height} image`)
  process.exit(2)
}
const ref = at(px, py)
const bg = flag("bg") ? at(...flag("bg").split(",").map(Number)) : null
if (bg && near(bg, ref)) {
  console.error("--bg pixel has the probe's colour - it must be on the page background, outside the card")
  process.exit(2)
}
const inside = (x, y) => x >= 0 && y >= 0 && x < img.width && y < img.height
// Default: the card is every pixel matching the probe colour - stops at the inner face.
// --bg: the card is everything that is not background; the edge is the last non-background
// pixel before `gap` consecutive background pixels, so a border, a shadow, or an
// anti-aliased seam between face and border all count as card.
const gap = Number(flag("gap") ?? 6)
const walk = (dx, dy) => {
  let x = px
  let y = py
  let edge = 0
  if (!bg) {
    while (inside(x + dx, y + dy) && near(at(x + dx, y + dy), ref)) {
      x += dx
      y += dy
    }
    return dx ? x : y
  }
  let run = 0
  edge = dx ? x : y
  while (inside(x + dx, y + dy) && run < gap) {
    x += dx
    y += dy
    if (near(at(x, y), bg)) run++
    else {
      run = 0
      edge = dx ? x : y
    }
  }
  return edge
}
const left = walk(-1, 0)
const right = walk(1, 0)
const top = walk(0, -1)
const bottom = walk(0, 1)

const rect = { left, top, width: right - left + 1, height: bottom - top + 1 }
const hex = toHex(ref)
console.log(JSON.stringify({ image: `${img.width}x${img.height}`, probe: [px, py], color: hex, edge: bg ? "outer (to background)" : "inner (probe colour)", tolerance, ...rect }))
console.log(`const rect = { left: ${rect.left}, top: ${rect.top}, width: ${rect.width}, height: ${rect.height} }`)
if (rect.width === img.width || rect.height === img.height) {
  console.error("warning: the region spans the whole image - the probe is on the background, not on a card")
}
