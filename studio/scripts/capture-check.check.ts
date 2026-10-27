// npm test: how capture-check.js turns changed-pixel counts into motion runs, rest frames and lone frames.
import assert from "node:assert/strict"
import { createRequire } from "node:module"

const { spans } = createRequire(import.meta.url)("./capture-check.js") as {
  spans: (counts: number[], px: number, share: number) => { runs: number[][]; lone: number[] }
}

let checks = 0
const check = (name: string, fn: () => void) => {
  fn()
  checks++
}

// 1000 px region at 0.3 %: a frame moves from 3 changed pixels.
const px = 1000
const share = 0.003

check("noise under the share is still", () => {
  assert.deepEqual(spans([0, 2, 1, 2, 0], px, share), { runs: [], lone: [] })
})

check("a run holds through gaps of up to 2 still frames and rests on the next still frame", () => {
  const counts = [0, 0, 50, 80, 0, 0, 40, 0, 0, 0, 0]
  assert.deepEqual(spans(counts, px, share).runs, [[2, 6]])
})

check("3 still frames split two runs", () => {
  const counts = [0, 50, 60, 0, 0, 0, 70, 80, 0]
  assert.deepEqual(spans(counts, px, share).runs, [[1, 2], [6, 7]])
})

check("a single moving frame is a lone frame, not a run (a cursor blink or a typed key)", () => {
  const counts = [0, 0, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 30, 0, 0]
  assert.deepEqual(spans(counts, px, share), { runs: [], lone: [2, 17] })
})

console.log(`capture-check: ${checks} checks passed`)
