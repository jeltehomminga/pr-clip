// npm test: node runs this file directly (type stripping), so imports carry their .ts extension.
import assert from "node:assert/strict"

import example from "../../videos/EXAMPLE/props.json" with { type: "json" }
import { context } from "./context.ts"
import { appLean, cameraFrames, clockText, focusOf, jumpRead, pairFocus, sourceFrame, timeline, voiceLines, wipeFrames, type CaptureContext, type PairBeat, type PrClipProps, type Rect } from "./timeline.ts"

const base = example as PrClipProps
const clone = () => structuredClone(base)
let checks = 0
const check = (name: string, fn: () => void) => {
  fn()
  checks++
}

check("EXAMPLE fits the 15–60 s window and every pair holds ≥ 5 s", () => {
  const t = timeline(base)
  assert.ok(t.total >= 450 && t.total <= 1800, `total ${t.total}`)
  t.beats.forEach((b, i) => {
    if (i > 0) assert.equal(b.from, t.beats[i - 1].from + t.beats[i - 1].duration, `beat ${i} leaves a gap`)
    if (b.kind === "pair") assert.ok(b.duration >= 150, `pair ${i + 1} is ${b.duration} frames`)
  })
  assert.equal(t.beats.at(-1)!.from + t.beats.at(-1)!.duration, t.total)
})

check("the why is the first cue, at frame 0, and captions keep a 2-frame gap", () => {
  const t = timeline(base)
  assert.equal(t.cues[0].text, base.why)
  assert.equal(t.cues[0].from, 0)
  assert.equal(t.cues.length, base.pairs.length + 1)
  t.cues.forEach((c, i) => {
    assert.ok(c.to > c.from, `cue ${i} is empty`)
    assert.equal(c.startMs, Math.round((c.from * 1000) / 30))
    if (i > 0) assert.ok(c.from - t.cues[i - 1].to >= 2, `cue ${i} starts too soon`)
  })
})

check("poster and motion frames sit inside the clip", () => {
  const t = timeline(base)
  for (const f of [t.posterFrame, t.motionFrame]) assert.ok(f > 0 && f < t.total, `frame ${f}`)
})

check("result first: the first after state is on screen within 3 s, app and web", () => {
  for (const platform of ["app", "web"] as const) {
    const p = clone()
    p.platform = platform
    p.pairs = [p.pairs[0]]
    const first = timeline(p).beats[0] as PairBeat
    const afterAt = first.wipeAt === undefined ? first.afterRingsAt : first.wipeAt + wipeFrames
    assert.ok(afterAt <= 90, `${platform}: after state at frame ${afterAt}`)
  }
})

check("web recordings play in turn: before plays out, the wipe lands, then the after plays", () => {
  const p = clone()
  p.platform = "web"
  const clip = p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!.after
  p.pairs = [{ ...p.pairs[0], before: { ...clip }, after: { ...clip } }]
  const b = timeline(p).beats[0] as PairBeat
  const played = clip.trimAfter! - (clip.trimBefore ?? 0)
  assert.ok(b.wipeAt! >= b.playAt + played, `wipe at ${b.wipeAt} cuts the before recording (ends ${b.playAt + played})`)
  assert.equal(b.afterPlayAt, b.wipeAt! + wipeFrames)
  assert.ok(b.duration >= b.afterPlayAt! + played, `beat ${b.duration} ends before the after recording`)
  assert.ok(b.settledAt >= b.afterPlayAt! + played, `settled at ${b.settledAt}, before the after recording ends`)
})

check("the poster shows the first pair under its own caption, not the why", () => {
  const t = timeline(base)
  const first = t.beats[0] as PairBeat
  assert.ok(t.posterFrame >= first.from + first.captionAt, `poster ${t.posterFrame} is before the caption`)
  assert.ok(t.posterFrame < first.from + first.duration, `poster ${t.posterFrame} is past the first pair`)
})

check("a single short pair pads to 15 s", () => {
  const p = clone()
  p.pairs = [p.pairs[0]]
  assert.equal(timeline(p).total, 450)
})

check("a recording keeps its pair on screen until it has played", () => {
  const p = clone()
  const video = p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!
  video.after.trimAfter = (video.after.trimBefore ?? 0) + 300
  const beat = timeline(p).beats.find((b) => b.kind === "pair" && p.pairs[b.index] === video)!
  assert.ok(beat.duration >= 300, `pair is ${beat.duration} frames`)
})

check("a jump cuts both recordings on the same frame, plays only its two parts and leans in after the cut", () => {
  const p = clone()
  const video = p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!
  const start = video.after.trimBefore ?? 0
  for (const c of [video.before, video.after]) Object.assign(c, { trimBefore: start, trimAfter: start + 2100, jump: { at: start + 150, to: start + 1950 }, clockAt: start + 30 })
  const beat = timeline(p).beats.find((b) => b.kind === "pair" && p.pairs[b.index] === video) as PairBeat
  assert.ok(beat.duration >= 300 && beat.duration < 600, `pair is ${beat.duration} frames, not the 70 s recording`)
  assert.ok(beat.zoomAt !== undefined && beat.zoomAt >= beat.playAt + 150 + jumpRead, `leans in at ${beat.zoomAt}, before the cut is read`)
  // Blinking brackets wait as long as the lean-in does, so they stay on through the cut.
  const ring = video.after.rings![0]
  assert.equal(beat.leanWait, beat.zoomAt - (beat.afterRingsAt + (ring.delay ?? 0) + 15))
  assert.ok(timeline(base).beats.every((b) => b.kind !== "pair" || b.leanWait === 0), "a pair without a jump waits")
  assert.equal(sourceFrame(video.before, beat.playAt + 149, beat.playAt), start + 149)
  assert.equal(sourceFrame(video.before, beat.playAt + 150, beat.playAt), start + 1950)
  assert.equal(sourceFrame(video.before, beat.playAt + 9999, beat.playAt), start + 2099)
  assert.equal(clockText(video.before, 0, beat.playAt), "0:00")
  assert.equal(clockText(video.before, beat.playAt + 150, beat.playAt), "1:04")
})

check("variants beats follow the last pair, hold ≥ 4 s each and carry their caption", () => {
  const p = clone()
  const after = p.pairs[0].after
  p.variants = [
    { caption: "Same card in dark mode and in French", captures: [{ ...after, label: "Dark", dark: true }, { ...after, label: "FR" }] },
    { caption: "Same card on a tablet", captures: [{ ...after, label: "Tablet" }] },
  ]
  const t = timeline(p)
  assert.deepEqual(
    t.beats.map((b) => b.kind),
    [...p.pairs.map(() => "pair"), "variants", "variants", "outro"],
  )
  t.beats.forEach((b, i) => {
    if (i > 0) assert.equal(b.from, t.beats[i - 1].from + t.beats[i - 1].duration, `beat ${i} leaves a gap`)
    if (b.kind === "variants") assert.ok(b.duration >= 120, `variants ${b.index + 1} is ${b.duration} frames`)
  })
  assert.deepEqual(
    t.cues.slice(-2).map((c) => c.text),
    p.variants.map((v) => v.caption),
  )
})

check("a pair leans in once its fix has landed (web: after the wipe), holds ≥ 2 s and is out before its crossfade", () => {
  const web = clone()
  web.platform = "web"
  web.pairs = [web.pairs[0]]
  for (const p of [base, web]) {
    for (const b of timeline(p).beats) {
      if (b.kind !== "pair") continue
      const label = `${p.platform} pair ${b.index + 1}`
      const ring = p.pairs[b.index].after.rings?.[0]
      assert.ok(ring && b.zoomAt !== undefined && b.zoomOutAt !== undefined, `${label} does not lean in`)
      assert.ok(b.zoomAt >= b.afterRingsAt + (ring.delay ?? 0), `${label} leans in before its ring`)
      if (b.wipeAt !== undefined) assert.ok(b.zoomAt >= b.wipeAt + wipeFrames, `${label} leans in during the wipe`)
      assert.ok(b.zoomOutAt - (b.zoomAt + cameraFrames) >= 60, `${label} holds under 2 s`)
      assert.ok(b.zoomOutAt + cameraFrames <= b.duration - 20, `${label} still moves at its crossfade`)
    }
  }
})

check("a pair without an after ring does not lean in", () => {
  const p = clone()
  delete p.pairs[0].after.rings
  const first = timeline(p).beats[0] as PairBeat
  assert.equal(first.zoomAt, undefined)
  assert.equal(first.zoomOutAt, undefined)
})

check("padding a short last pair moves its lean-out to the new end", () => {
  const p = clone()
  p.pairs = [p.pairs[0]]
  const t = timeline(p)
  const only = t.beats[0] as PairBeat
  assert.equal(t.total, 450)
  assert.equal(only.zoomOutAt, only.duration - 20 - cameraFrames)
})

check("the poster is a settled frame, not mid camera move, even with a short why", () => {
  for (const platform of ["app", "web"] as const) {
    const p = clone()
    p.platform = platform
    p.pairs = [p.pairs[0]]
    p.why = "x"
    const t = timeline(p)
    const first = t.beats[0] as PairBeat
    const f = t.posterFrame - first.from
    assert.ok(f >= first.zoomAt! + cameraFrames && f < first.zoomOutAt!, `${platform}: poster ${f}, lean-in ${first.zoomAt}–${first.zoomOutAt}`)
  }
  // An after recording that outlasts the hold (a drag, 132 frames): the poster stays in the hold.
  const p = clone()
  p.platform = "web"
  const clip = { file: "x.mp4", width: 2700, height: 1520, trimBefore: 32, trimAfter: 164, rings: [{ left: 1632, top: 458, width: 620, height: 557 }] }
  p.why = "x"
  // Two pairs: a lone pair is padded to the 15 s minimum, which would stretch its hold past the recording.
  const pair = { ...p.pairs[0], caption: "y", before: clip, after: clip }
  p.pairs = [pair, pair]
  const first = timeline(p).beats[0] as PairBeat
  assert.ok(first.afterPlayAt! + 132 >= first.zoomOutAt!, "the fixture's recording must outlast the hold")
  assert.ok(first.settledAt >= first.zoomAt! + cameraFrames && first.settledAt < first.zoomOutAt!, `settled ${first.settledAt}, hold ${first.zoomAt}–${first.zoomOutAt}`)
})

const card = (facts = [{ label: "Developer", value: "Someone" }]) => ({ kind: "Feature", title: "A card", prTitle: "feat(X-1): a card", facts })

check("a details card is the last beat, holds ≥ 5 s, and the clip ends on it", () => {
  const p = clone()
  p.details = card()
  const t = timeline(p)
  const last = t.beats.at(-1)!
  assert.equal(last.kind, "outro")
  assert.ok(last.duration >= 150, `card holds ${last.duration} frames`)
  assert.equal(last.from + last.duration, t.total)
})

const rejects = (name: string, change: (p: PrClipProps) => void, message: RegExp) =>
  check(name, () => {
    const p = clone()
    change(p)
    assert.throws(() => timeline(p), message)
  })

const jumpPair = (p: PrClipProps) => p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!
rejects("a jump on one side only", (p) => (jumpPair(p).before.jump = { at: (jumpPair(p).before.trimBefore ?? 0) + 10, to: jumpPair(p).before.trimAfter! - 10 }), /both recordings need a jump/)
rejects("a jump outside the trims", (p) => (jumpPair(p).after.jump = { at: 0, to: 1 }), /jump needs trimBefore < at < to < trimAfter/)
rejects("a jump on a still", (p) => (p.pairs[0].after.jump = { at: 1, to: 2 }), /need a recording/)
rejects("empty why", (p) => (p.why = "  "), /why is empty/)
rejects("empty caption", (p) => (p.pairs[0].caption = ""), /caption is empty/)
rejects("caption over 2 × 42", (p) => (p.pairs[0].caption = "x".repeat(85)), /fit 2 lines/)
rejects(
  "mp4 without trimAfter",
  (p) => delete p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!.after.trimAfter,
  /needs trimAfter/,
)
rejects(
  "ring outside the capture",
  (p) => (p.pairs[0].after.rings = [{ left: p.pairs[0].after.width - 10, top: 0, width: 20, height: 20 }]),
  /outside/,
)
rejects(
  "web pair of different sizes",
  (p) => {
    p.platform = "web"
    p.pairs = [p.pairs[0]]
    p.pairs[0].after.width -= 1
  },
  /same size/,
)
rejects("over 60 s", (p) => (p.pairs = Array.from({ length: 20 }, () => p.pairs[0])), /over 60 s: split it/)
check("maxSeconds lifts the 60 s cap", () => {
  const p = clone()
  p.pairs = Array.from({ length: 20 }, () => p.pairs[0])
  p.maxSeconds = 600
  assert.ok(timeline(p).total > 60 * 30)
})
const variant = (p: PrClipProps, label = "Dark") => ({ ...p.pairs[0].after, label })
rejects("variants without captures", (p) => (p.variants = [{ caption: "x", captures: [] }]), /1 to 3 captures/)
rejects(
  "variants with four captures",
  (p) => (p.variants = [{ caption: "x", captures: ["a", "b", "c", "d"].map((label) => variant(p, label)) }]),
  /1 to 3 captures/,
)
rejects("variant without a label", (p) => (p.variants = [{ caption: "x", captures: [variant(p, " ")] }]), /label is empty/)
const recording = (p: PrClipProps) => ({ ...p.pairs.find((pair) => /\.mp4$/.test(pair.after.file))!.after, label: "Loading" })
check("an app variant may be a recording; its beat plays it from the rings and holds the end", () => {
  const p = clone()
  const rec = recording(p)
  rec.trimAfter = (rec.trimBefore ?? 0) + 200
  p.variants = [{ caption: "x", captures: [rec, variant(p, "Error")] }]
  const beat = timeline(p).beats.find((b) => b.kind === "variants")!
  assert.ok(beat.duration >= 6 + 200 + 30, `variants beat is ${beat.duration} frames`)
})
check("a pair skips the lean-in when a bracket would reach the caption fade", () => {
  const p = clone()
  p.pairs = [p.pairs[0]]
  const after = p.pairs[0].after
  after.rings = [{ left: 24, top: 563, width: 1158, height: 300 }]
  const leaning = timeline(p).beats[0]
  assert.ok(leaning.kind === "pair" && leaning.zoomAt !== undefined)
  // A sticky button flush with the screen's bottom edge.
  after.rings = [{ left: 24, top: after.height - 150, width: 1158, height: 150 }]
  const beat = timeline(p).beats[0]
  assert.ok(beat.kind === "pair" && beat.zoomAt === undefined && beat.zoomOutAt === undefined)
})
check("a web pair leans in to the fit zoom with the pan by default, unless a bracket would leave the footage band", () => {
  const page = (rings: Rect[]) => ({ file: "x.png", width: 2700, height: 1520, rings })
  const slider = { left: 1632, top: 458, width: 620, height: 557 } // a slider card: the pan centres it in the band
  const p = clone()
  p.platform = "web"
  p.pairs = [{ ...p.pairs[0], before: page([slider]), after: page([slider]) }]
  assert.deepEqual(focusOf(p), pairFocus)
  assert.notEqual((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
  // A second change at the page's left edge: the 1.25x lean keeps it, the 1.8x fit zoom on the slider pans it out of the frame.
  const edge = { left: 60, top: 500, width: 300, height: 100 }
  p.pairs = [{ ...p.pairs[0], before: page([slider, edge]), after: page([slider, edge]) }]
  assert.equal((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
  p.focus = {}
  assert.notEqual((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
})
check("an app pair leans in by default as one camera on the row, unless a bracket would leave the footage band", () => {
  const icon = { left: 258, top: 2273, width: 208, height: 277 } // a tab-bar icon: fit is 1.8x
  const p = clone()
  p.pairs = [{ ...p.pairs[0], before: { ...p.pairs[0].before, rings: [] }, after: { ...p.pairs[0].after, rings: [icon] } }]
  assert.equal(p.platform, "app")
  assert.deepEqual(focusOf(p), pairFocus)
  // At 1.8x two phones each zooming on its own would overlap by 104 px; one camera spreads them apart.
  const { to, origin, shift } = appLean(p.pairs[0], icon, "fit")
  assert.equal(to, 1.8)
  assert.equal(Math.round(origin.x), 892)
  // The pan lifts the icon off the caption band: the phones' bottom lands on the fade.
  assert.ok(shift.y < 0, `shift ${shift.y}`)
  assert.notEqual((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
  // A second change near the top: that pan pushes it out of the frame, so no lean-in.
  p.pairs[0].after.rings = [icon, { left: 24, top: 150, width: 1158, height: 100 }]
  assert.equal((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
  // `focus: {}` keeps the 1.25x lean, which only checks the caption fade.
  p.focus = {}
  assert.notEqual((timeline(p).beats[0] as PairBeat).zoomAt, undefined)
})
check("app variants stand tall unless a bracket would reach the fade; web never does", () => {
  const p = clone()
  const top = { ...variant(p, "Top"), rings: [{ left: 24, top: 563, width: 1158, height: 300 }] }
  const bottom = { ...variant(p, "Bottom"), rings: [{ left: 24, top: 2300, width: 1158, height: 200 }] }
  p.variants = [{ caption: "x", captures: [top] }, { caption: "y", captures: [top, bottom] }]
  const [a, b] = timeline(p).beats.filter((x) => x.kind === "variants")
  assert.equal(a.tall, true)
  assert.equal(b.tall, false)
  p.platform = "web"
  p.pairs = [p.pairs[0]]
  assert.equal(timeline(p).beats.find((x) => x.kind === "variants")!.tall, false)
})
check("a web variant may be a recording; its brackets settle once it has played", () => {
  const p = clone()
  const rec = recording(p)
  rec.trimAfter = (rec.trimBefore ?? 0) + 200
  p.platform = "web"
  p.pairs = [p.pairs[0]]
  p.variants = [{ caption: "x", captures: [rec] }]
  const beat = timeline(p).beats.find((b) => b.kind === "variants")!
  assert.ok(beat.kind === "variants" && beat.duration >= 6 + 200 + 30, `variants beat is ${beat.duration} frames`)
  assert.ok(beat.kind === "variants" && beat.settledAt >= 6 + 200, `settles at ${beat.kind === "variants" && beat.settledAt}`)
})

rejects("details without a title", (p) => (p.details = { ...card(), title: " " }), /details title is empty/)
rejects("details with an empty parent", (p) => (p.details = { ...card(), parent: "" }), /details parent is empty/)
rejects(
  "details with seven facts",
  (p) => (p.details = card(Array.from({ length: 7 }, () => ({ label: "a", value: "b" })))),
  /1 to 6 facts/,
)
rejects("a fact without a value", (p) => (p.details = card([{ label: "a", value: "" }])), /fact 1 is empty/)

const captured = (account = "test user 3 (4711…0042): 1 open invoice"): CaptureContext => ({
  env: "staging",
  date: "2026-10-11",
  device: "iPhone 17 Pro simulator",
  locale: "en",
  theme: "light",
  account,
})

check("agent context: one line of ASCII JSON, one chapter per beat, each atMs inside its chapter", () => {
  const p = clone()
  p.why = "Le solde: 60,00 € · déjà vu"
  p.variants = [{ caption: "x", captures: [variant(p, "FR")] }]
  const line = context(p)
  assert.match(line, /^[\x20-\x7e]+$/, "non-ASCII or a line break in the context")
  const json = JSON.parse(line)
  assert.equal(json.why, p.why)
  assert.equal(json.chapters.length, timeline(p).beats.length)
  for (const c of json.chapters) {
    if (c.atMs !== undefined) assert.ok(c.atMs >= c.startMs && c.atMs < c.endMs, `${c.kind} atMs ${c.atMs} is outside ${c.startMs}–${c.endMs}`)
  }
})

check("agent context: a pair's own url gives its chapter a route", () => {
  const p = clone()
  p.pairs[0].url = "localhost:3000/en/settings"
  const pair = JSON.parse(context(p)).chapters.find((c: { kind: string }) => c.kind === "pair")
  assert.equal(pair.route, "/en/settings")
})

check("agent context: full identifiers fail, short forms pass", () => {
  // Built from parts, so no identifier-shaped literal sits in this file.
  const ones = (n: number) => "1".repeat(n)
  const full: [string, RegExp][] = [
    [`customer ${ones(10)}`, /long number/],
    ["eva.test@example.com", /email/],
  ]
  for (const [account, kind] of full) {
    const p = clone()
    p.capture = captured(account)
    assert.throws(() => context(p), kind, account.slice(0, 6))
  }
  for (const account of ["customer 4711…0042", "card 41…11", "order 12345678"]) {
    const p = clone()
    p.capture = captured(account)
    context(p)
  }
})

check("agent context: a PR clip needs capture and a reach on every pair and capture", () => {
  const p = clone()
  p.pr = { repo: "acme/shop-app", number: 1, commit: "96c3bc0a34b1" }
  assert.throws(() => context(p), /capture needs env, date, device, locale, theme, account/)
  p.capture = captured()
  assert.throws(() => context(p), /pair 1 needs state.reach/)
  p.pairs.forEach((pair) => (pair.state = { reach: "real staging data" }))
  p.variants = [{ caption: "x", captures: [variant(p)] }]
  assert.throws(() => context(p), /variants 1 capture 1 needs state.reach/)
  p.variants[0].captures[0].state = { reach: "Automatic theme + iOS dark appearance" }
  const json = JSON.parse(context(p))
  assert.equal(json.pr.url, "https://github.com/acme/shop-app/pull/1")
  assert.equal(json.chapters.at(-2).shows[0].reach, "Automatic theme + iOS dark appearance")
})

check("voice: a long line holds its caption, each line ends before the next cue, a missing, stray or stale line throws", () => {
  const p = clone()
  const plain = timeline(p)
  assert.deepEqual(plain.lines, [])
  const line = (frames: number, text = "") => ({ file: "vo/x.wav", frames, cues: [{ text, start: 0, end: frames / 30 }] })
  p.voice = Object.fromEntries(voiceLines(p).map((l) => [l.id, line(30, l.text)]))
  p.voice.why = line(400, p.why)
  const t = timeline(p)
  assert.ok(t.cues[0].to >= 6 + 400, `why cue ends at ${t.cues[0].to}`)
  assert.ok(t.total > plain.total, "the clip grew with the why's window")
  t.lines.forEach((l, i) => {
    assert.equal(l.from, t.cues[i].from + 6)
    assert.ok(l.from + l.frames < t.cues[i].to, `${l.id} runs past its caption`)
  })
  const kept = p.voice["pair-1"]
  delete p.voice["pair-1"]
  assert.throws(() => timeline(p), /voice "pair-1" says "nothing"/)
  p.voice["pair-1"] = kept
  p.pairs[0].caption = "A reworded caption"
  assert.throws(() => timeline(p), /voice "pair-1" says .*, not "A reworded caption"/)
  p.say = { reworded: "rewritten" }
  p.voice["pair-1"] = line(30, "A rewritten caption")
  timeline(p)
  p.voice["pair-9"] = line(30)
  assert.throws(() => timeline(p), /voice "pair-9" has no caption/)
})

console.log(`timeline: ${checks} checks passed`)
