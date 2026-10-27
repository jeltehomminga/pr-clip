// check.sh's qr row: does the end card's QR scan once encoded? Decodes the last frame of a video (or an
// image) at 1920 and at 960 px wide, about the size of an inline player in a PR or issue comment. Exit 0 only when both read the expected URL.
// Usage: node scripts/qr-check.ts <mp4|png> <url>
import { spawnSync } from "node:child_process"
import jsQR from "jsqr"

const [file, want] = process.argv.slice(2)
if (!file || !want) {
  console.error("usage: qr-check.ts <mp4|png> <url>")
  process.exit(2)
}

const read = (width: number) => {
  const height = (width * 9) / 16
  const last = /\.(png|jpe?g)$/i.test(file) ? [] : ["-sseof", "-0.1"]
  const ff = spawnSync("ffmpeg", ["-v", "error", ...last, "-i", file, "-frames:v", "1", "-vf", `scale=${width}:${height}`, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], {
    maxBuffer: width * height * 4 + 1024,
  })
  if (ff.status !== 0) return `ffmpeg failed: ${ff.stderr.toString().trim()}`
  return jsQR(new Uint8ClampedArray(ff.stdout), width, height)?.data ?? "no QR found"
}

const results = [1920, 960].map((width) => [`${width} px`, read(width)] as const)
for (const [name, got] of results) console.log(`${name}: ${got}`)
process.exit(results.every(([, got]) => got === want) ? 0 : 1)
