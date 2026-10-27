// Prints `total posterFrame motionFrame` for a clip, from the same timeline() the render uses.
// With --stills: one `frame kind index` line per beat instead (a pair's or variants beat's settled
// frame, the end card's last frame), for clip.sh's 1:1 stills.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/frames.ts videos/<KEY>/props.json [--stills]
import { readFileSync } from "node:fs"

import { timeline } from "../src/pr-clip/timeline.ts"

const t = timeline(JSON.parse(readFileSync(process.argv[2], "utf8")))
if (process.argv[3] === "--stills") {
  for (const b of t.beats) {
    if (b.kind === "outro") console.log(b.from + b.duration - 1, b.kind, 0)
    else console.log(b.from + b.settledAt, b.kind, b.index + 1)
  }
} else console.log(t.total, t.posterFrame, t.motionFrame)
