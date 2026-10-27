// A PR clip's voice lines for scripts/render-vo.sh: videos/<KEY>/vo-src/<id>.txt (why, pair-N, variants-N), each
// caption word for word with props.json's `say` swaps for what Kokoro can't read (`{ "≡": "handle" }`).
// vo-src/ is rewritten whole, so a reworded caption never keeps an old line; timeline() fails a voice that
// doesn't say its caption any more.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/vo-captions.ts <KEY>
//   then: KOKORO_SPEED=0.9 scripts/render-vo.sh <KEY>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"

import { voiceLines } from "../src/pr-clip/timeline.ts"

const key = process.argv[2]
if (!key) throw new Error("usage: scripts/vo-captions.ts <KEY>")
const dir = `videos/${key}`
const src = `${dir}/vo-src`
// Read the lines before deleting anything: a props.json that isn't a PR clip throws here, so a hand-written script survives.
const lines = voiceLines(JSON.parse(readFileSync(`${dir}/props.json`, "utf8")))
rmSync(src, { recursive: true, force: true })
mkdirSync(src)
for (const { id, text } of lines) {
  writeFileSync(`${src}/${id}.txt`, `${text}\n`)
  console.log(`${id.padEnd(11)} ${text}`)
}
