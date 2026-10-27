export type Rect = { left: number; top: number; width: number; height: number }
export type Ring = Rect & { delay?: number }
/**
 * How a change is marked: corner brackets that lock on and stay (the default), or that blink twice
 * and go as the lean-in lands, so nothing stays over the UI.
 */
export type Mark = "brackets" | "blink"
export type Capture = {
  file: string // inside the clip's media dir (= --public-dir)
  width: number // measured
  height: number
  cropBottom?: number
  trimBefore?: number // mp4 only; trimAfter required for mp4
  trimAfter?: number
  /**
   * mp4 only, app pairs: a hard cut inside the recording, so a state that never ends shows time
   * passing (a skeleton that stays for good). It plays trimBefore to `at`, cuts to `to`
   * and plays on to trimAfter. Both phones cut on the same frame.
   */
  jump?: { at: number; to: number }
  /**
   * mp4 only: the recording's frame that reads 0:00 on a clock in its chip (the tap that opens the
   * screen). With a jump, give both phones one: a clock on both reads better than one on the before
   * or a "+60 s" chip at the cut.
   */
  clockAt?: number
  rings?: Ring[]
  dark?: boolean
}
/**
 * Agent context for one state the clip shows, from its kept inventory row. Only
 * scripts/context.ts reads it (into the share copy's comment tag); the render ignores it.
 */
export type StateContext = {
  /** The render branch that draws it: `amountOpen < 0`. */
  branch?: string
  /** Repo-relative files; no line numbers, they go stale first. */
  files?: string[]
  /** i18n keys as the code spells them. */
  i18n?: string[]
  /** How the capture reached it: "real staging data", "stubbed: …". Repro tips go here too. */
  reach: string
}
/** `url` (web) replaces the clip's url in this pair's window, for a clip whose pairs sit on different pages. */
export type Pair = { before: Capture; after: Capture; caption: string; holdFrames?: number; state?: StateContext; url?: string }
/** One after state in another theme, language or viewport. `url` (web) replaces the clip's url in this window. */
export type VariantCapture = Capture & { label: string; url?: string; state?: StateContext }
/** One beat of after-only variants side by side under one caption. */
export type VariantGroup = { caption: string; captures: VariantCapture[] }
/** One cell of the end card's facts grid. */
export type Fact = { label: string; value: string }
/**
 * The end card: the details a reader of the issue wants next to the clip. Its short
 * description is the clip's `why`; the PR number is `pr.number`.
 */
export type Details = {
  /** "Feature" or "Bug fix": the eyebrow, before the key. */
  kind: string
  /** The issue's or PR's title, conventional prefix dropped. */
  title: string
  /** The issue the PR closes: "Closes #123 …". */
  parent?: string
  /** The PR title. */
  prTitle: string
  /** A sprint or milestone that held the capture day: "Sprint 2". In the band's dateline. */
  sprint?: string
  /** What the QR opens: the issue, or else the PR. */
  url?: string
  /**
   * Two columns of up to three, from what exists when the clip is made and stays true once it is
   * posted. Merged: developer, reviewers, merge date, first build, screen, capture. Before the
   * merge: developer, screen, capture (no status or reviewers, which change while it is open).
   */
  facts: Fact[]
}
/** Agent context: how the clip was captured, once, so a tester can reproduce it. */
export type CaptureContext = {
  /** The backend the capture ran against: "staging", "local + mocks". */
  env: string
  /** YYYY-MM-DD */
  date: string
  /** "iPhone 17 Pro simulator", "Chrome 1350×760 @2". */
  device: string
  locale: string
  theme: string
  /** A data profile, never a real identifier: "test user 3: one open invoice of € 60". */
  account: string
}
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** "2026-09-30…" as "30 Sep 2026"; a fixed list, since Node's en-GB writes "Sept". */
export const day = (iso: string) => {
  const [year, month, date] = iso.slice(0, 10).split("-").map(Number)
  return `${date} ${months[month - 1]} ${year}`
}
/** Agent context: a state the inventory left out, and why. */
export type NotShown = { state: string; why: string }
export type PrClipProps = {
  issueKey: string
  why: string
  platform: "app" | "web"
  pairs: Pair[]
  /** App: dark mode and another language. Web: another language, tablet and mobile. Shown after the pairs, before the outro. */
  variants?: VariantGroup[]
  stage?: "light" | "dark"
  url?: string
  outro?: string
  /** Turns the outro into the details end card. */
  details?: Details
  /** `false` leaves the QR off the details end card (on by default when details.url is set). */
  qr?: false
  posterFrame?: number
  /**
   * `commit`: the commit the clip was captured from; scripts/stale.sh compares it with the PR.
   * `base`: the before side (merge-base of an open PR, `<merge>^1` once merged).
   * `accepted`: the user's yes to keep the clip although the PR moved to `head`, and why.
   * `checkout`: the local clone scripts fetch in (never in the agent context).
   */
  pr?: { repo: string; number: number; commit?: string; base?: string; checkout?: string; accepted?: { head: string; why: string } }
  /**
   * Agent context (scripts/context.ts), never in EXAMPLE: Root merges EXAMPLE under every
   * clip. A clip with `pr` needs `capture` and a `state.reach` on every pair and capture.
   */
  capture?: CaptureContext
  notShown?: NotShown[]
  /** The Figma node URL the inventory compared against. */
  figma?: string
  /**
   * How a pair leans in (`zoom`: a number, or "fit" for fitZoom, with a pan: camera() on web, appLean() on
   * app) and how a pair that leans in marks its change (`mark`). Absent: pairFocus. `{}` keeps the 1.25x
   * lean with steady brackets. A pair that can't lean in, the variants and the end card keep steady brackets.
   */
  focus?: { zoom?: number | "fit"; mark?: Mark }
  /** Lifts the 60 s cap for one clip, on the user's say only (a big change with many real recordings). */
  maxSeconds?: number
  /**
   * Each caption read aloud, keyed `why`, `pair-N`, `variants-N` (scripts/vo-captions.ts, then scripts/render-vo.sh).
   * A line starts `lead` frames into its caption, and the caption holds until it has ended.
   */
  voice?: Record<string, VoiceLine>
  /** What the voice says instead of a symbol or label Kokoro can't read: `{ "≡": "handle" }` (voiceLines). */
  say?: Record<string, string>
}

/**
 * Pairs lean in with the fit zoom and the pan, and the brackets on both sides blink twice and go, as the
 * zoom takes over the pointing. App: one camera on the whole pair.
 */
export const pairFocus: NonNullable<PrClipProps["focus"]> = { zoom: "fit", mark: "blink" }
/** A clip's focus: pairFocus unless props.json sets one. */
export const focusOf = (props: PrClipProps) => props.focus ?? pairFocus

/**
 * Plain TypeScript, no Remotion import: Root (calculateMetadata), PrClip and the
 * scripts (`node scripts/frames.ts`) all size the clip from this one function.
 * Every number is in frames at 30 fps.
 */
export const fps = 30
/** A pair stays on screen at least 5 s. */
const minPair = 150
/**
 * PR clips run 15–60 s. Shorter pads the last pair; longer is two clips, unless props.maxSeconds
 * lifts the cap. Real recordings beat stills, even when the clip gets longer.
 */
const minTotal = 15 * fps
const maxSeconds = 60
/** Blank frames between two captions, so the change of text is seen. */
const gap = 2
/** A caption lands first; rings and recordings follow this many frames later. */
const lead = 6
/** Web: the before page holds, then the after page wipes in over wipeFrames frames and holds. */
const beforeHold = 60
export const wipeFrames = 15
/** The wipe's standard curve moves fastest around its second frame (+23 % and +21 % of the page in frames 1-3); its whoosh peaks there. */
export const wipeFastest = 2
const afterHold = 60
/** App recordings: the end state stays on screen after the last frame plays. */
const tail = 30
/** Web: a before recording's end state holds this long before the after page wipes in. */
const endHold = 30
/** Consecutive beats dissolve over this many frames; before and after never fade into each other. */
export const crossfade = 10
/** After-rings trail the before-rings by 100 ms. */
const stagger = 3
/** A ring's lock-on spring has landed after this many frames. */
const settle = 15
/** After a recording's jump, its chips stay readable this long before any lean-in fades them. */
export const jumpRead = 45
/**
 * A pair leans in on its first after-ring over cameraFrames (brand.motion.camera), holds
 * at least zoomHold, and is back out zoomRest frames before the beat ends.
 */
export const cameraFrames = 30
/** brand.motion.camera.zoom: the lean-in's scale. */
const leanZoom = 1.25
const zoomHold = 60
const zoomRest = 20
const outroMin = 45
/**
 * The details card holds at least 5 s. The clip ends on it and a player keeps its last
 * frame up, so it isn't timed for a full read.
 */
const cardMin = 150
/** Two columns of three. */
const maxFacts = 6
/** A variants beat holds at least 4 s: a glance at each frame, not a read. */
const minVariants = 120
/** More than three frames no longer fit the row at a legible size. */
const maxVariants = 3
/** A pair's phone screen height, in composition px. */
export const pairScreen = 740
/** Between an app pair's two phones (AppPair). */
export const pairGap = 180
/** A web pair's page height inside the browser frame. */
export const webScreen = 700
/** The browser frame's title bar above the page (BrowserFrame). */
export const browserBar = 44
/** App states and looks beats stand their phones taller; the tab bars fade out above the caption band. */
export const tallScreen = 820
/** The footage is opaque down to here and gone 30 px lower (lean-in and tall phones). */
export const fadeTop = 870
/**
 * A frame's top edge in a pair or variants row: 40 px padding, a 52 px chip and its 22 px
 * gap, measured on a render.
 */
// ponytail: mirrors the row's CSS in AppPair/WebWipe/Variants; recompute if the chip or padding changes.
export const frameTop = 114
/** Brackets sit 10 px clear of their rect and are 4 px thick (Highlight). */
export const bracketReach = 14
/** Two caption lines of 42 characters. */
const maxChars = 84

/** Reading time: 0.6 s plus 15 characters a second. */
export const read = (text: string) => Math.ceil((0.6 + text.length / 15) * fps)

/** Written by scripts/render-vo.sh: one wav per vo-src/<id>.txt, its length in frames and its caption cues. */
export type VoiceLine = { file?: string; frames: number; cues: { text: string; start: number; end: number }[] }
/** A caption stays up this long after its voice line has ended. */
const breath = 9

/** What the voice reads, in the cues' order: each caption with props.say's swaps (scripts/vo-captions.ts writes them). */
export const voiceLines = (props: PrClipProps) => {
  const said = (text = "") => Object.entries(props.say ?? {}).reduce((s, [from, to]) => s.split(from).join(to), text).trim()
  return [
    { id: "why", text: said(props.why) },
    ...props.pairs.map((p, i) => ({ id: `pair-${i + 1}`, text: said(p.caption) })),
    ...(props.variants ?? []).map((g, i) => ({ id: `variants-${i + 1}`, text: said(g.caption) })),
  ]
}

export const isVideo = (capture: Capture) => /\.(mp4|mov|webm)$/i.test(capture.file)

export type Cue = { text: string; from: number; to: number; startMs: number; endMs: number }

/** Frames inside a pair beat are relative to the beat's own start. */
export type PairBeat = {
  kind: "pair"
  index: number
  from: number
  duration: number
  /** The pair's caption starts here; on the first pair the why comes before it. */
  captionAt: number
  beforeRingsAt: number
  afterRingsAt: number
  /** App: both recordings start together here. */
  playAt: number
  /** Web: the wipe starts here. */
  wipeAt?: number
  /** Web: the after recording starts here, once the wipe has landed. */
  afterPlayAt?: number
  /**
   * The lean-in on the first after-ring starts here; absent when the after state has no ring,
   * or when leaning in would push a bracket into the caption fade.
   */
  zoomAt?: number
  /** Frames a jump holds the lean-in past its usual start; blinking brackets wait as long (0 without one). */
  leanWait?: number
  /** The lean-out starts here, zoomRest frames plus one move before the beat ends. */
  zoomOutAt?: number
  /**
   * The after state, its brackets, its recording and any lean-in have landed here: the
   * poster's pick on the first pair, and the frame an agent grabs (scripts/context.ts).
   */
  settledAt: number
}
/** Rings land together at ringsAt, relative to the beat's own start. */
/**
 * `tall`: app phones stand at tallScreen with their bottom faded out. False when any bracket
 * would reach the fade, so a change near the bottom of the screen always stays in view.
 * `settledAt`: the brackets have landed (scripts/context.ts).
 */
export type VariantsBeat = { kind: "variants"; index: number; from: number; duration: number; ringsAt: number; tall: boolean; settledAt: number }
export type OutroBeat = { kind: "outro"; from: number; duration: number; text: string }

export type Timeline = {
  total: number
  beats: (PairBeat | VariantsBeat | OutroBeat)[]
  cues: Cue[]
  posterFrame: number
  /** A frame mid-motion, rendered twice by check.sh to prove the render is deterministic. */
  motionFrame: number
  /** Every voice line at its clip frame (none without props.voice). */
  lines: { id: string; from: number; frames: number }[]
}

export const ms = (frame: number) => Math.round((frame * 1000) / fps)
const cue = (text: string, from: number, to: number): Cue => ({ text, from, to, startMs: ms(from), endMs: ms(to) })

function checkText(label: string, text: string | undefined) {
  if (!text?.trim()) throw new Error(`${label} is empty`)
  if (text.length > maxChars) throw new Error(`${label} is ${text.length} characters; captions fit 2 lines of 42`)
}

/**
 * A capture's size and trims, and every ring on its visible page. Given a web page's height on
 * screen, the brackets too: they reach bracketReach px past their ring, and the page's edge cuts
 * off any that don't fit. A phone's brackets may reach onto its bezel.
 */
export function checkCapture(label: string, capture: Capture, screenHeight?: number) {
  if (!(capture.width > 0 && capture.height > 0)) throw new Error(`${label}: measure width and height`)
  if (isVideo(capture)) {
    if (capture.trimAfter === undefined) throw new Error(`${label}: an mp4 needs trimAfter`)
    if (capture.trimAfter <= (capture.trimBefore ?? 0)) throw new Error(`${label}: trimAfter must come after trimBefore`)
    const j = capture.jump
    if (j && !((capture.trimBefore ?? 0) < j.at && j.at < j.to && j.to < capture.trimAfter)) {
      throw new Error(`${label}: jump needs trimBefore < at < to < trimAfter`)
    }
  } else if (capture.jump || capture.clockAt !== undefined) {
    throw new Error(`${label}: jump and clockAt need a recording`)
  }
  const visible = capture.height - (capture.cropBottom ?? 0)
  const reach = screenHeight ? (bracketReach * visible) / screenHeight : 0
  for (const r of capture.rings ?? []) {
    const inside =
      r.width > 0 && r.height > 0 && r.left >= reach && r.top >= reach && r.left + r.width + reach <= capture.width && r.top + r.height + reach <= visible
    if (!inside) throw new Error(`${label}: ring ${JSON.stringify(r)} or its brackets reach outside the visible ${capture.width}x${visible} page`)
  }
}

function checkDetails(details: Details) {
  const texts = { kind: details.kind, title: details.title, prTitle: details.prTitle, parent: details.parent ?? "-" }
  for (const [label, text] of Object.entries(texts)) if (!text?.trim()) throw new Error(`details ${label} is empty`)
  if (!details.facts?.length || details.facts.length > maxFacts) throw new Error(`details: show 1 to ${maxFacts} facts`)
  details.facts.forEach((f, i) => {
    if (!f.label?.trim() || !f.value?.trim()) throw new Error(`details fact ${i + 1} is empty`)
  })
}

/**
 * True when every bracket of the capture ends above the caption fade, at this screen height
 * and, for a pair, while leaned in on `focus`. A change near the bottom of the screen must
 * stay in view, so the caller drops the tall phones or the lean-in.
 */
const bracketsClearFade = (capture: Capture, web: boolean, screenHeight: number, focus?: Rect) => {
  const scale = screenHeight / (capture.height - (capture.cropBottom ?? 0))
  const screenTop = frameTop + (web ? browserBar : Math.max(6, 26 * scale))
  // The lean scales the whole frame around the focus rect's centre.
  const origin = focus ? screenTop + (focus.top + focus.height / 2) * scale : 0
  const zoom = focus ? leanZoom : 1
  return (capture.rings ?? []).every((r) => {
    const bottom = screenTop + (r.top + r.height) * scale + bracketReach
    return origin + zoom * (bottom - origin) <= fadeTop
  })
}

/** A web lean-in's "fit" strength: the region fills about 70 % of the window, never less than the standard lean-in, never more than 1.8x. */
export const fitZoom = (rect: Rect, source: Capture) =>
  Math.min(1.8, Math.max(leanZoom, 0.7 * Math.min(source.width / rect.width, (source.height - (source.cropBottom ?? 0)) / rect.height)))

/**
 * One axis of the pan: a box starting at `origin` and `size` long scales by `to` around a point `focus`
 * into it. The point heads for the middle of `room`, but a box at least as long as the room keeps it
 * covered, and a shorter one is centred in it. Returns how far the box moves.
 */
const place = (origin: number, focus: number, size: number, room: number, to: number) => {
  const centred = room / 2 - focus * to
  const edge = size * to >= room ? Math.min(0, Math.max(room - size * to, centred)) : (room - size * to) / 2
  return edge - (origin + focus - focus * to)
}

/**
 * The pan that goes with a web lean-in of `to` around `rect`: the fix moves toward the middle of the
 * footage band (above the caption fade), but the window never uncovers stage it could fill, and a
 * window narrower than the frame stays centred. WebWipe applies it; webLeanKeepsBrackets checks it.
 */
export const camera = (rect: Rect, source: Capture, to: number) => {
  const scale = webScreen / (source.height - (source.cropBottom ?? 0))
  const width = source.width * scale
  return {
    x: place((1920 - width) / 2, (rect.left + rect.width / 2) * scale, width, 1920, to),
    y: place(frameTop, browserBar + (rect.top + rect.height / 2) * scale, browserBar + webScreen, fadeTop, to),
  }
}

/** An app pair's phone as PhoneFrame draws it in AppPair's row, in composition px. */
const pairPhones = (pair: Pair) => {
  const phones = [pair.before, pair.after].map((c) => {
    const scale = pairScreen / (c.height - (c.cropBottom ?? 0))
    const bezel = Math.max(6, 26 * scale)
    return { capture: c, scale, bezel, width: c.width * scale + 2 * bezel, height: pairScreen + 2 * bezel, left: 0 }
  })
  phones[0].left = (1920 - phones[0].width - pairGap - phones[1].width) / 2
  phones[1].left = phones[0].left + phones[0].width + pairGap
  return phones
}

/**
 * An app pair's lean-in on `rect` (source px of the after state): one camera on the whole row, so the phones
 * move apart as they grow and never overlap. It scales by `to` around `origin`,
 * the midpoint of the two fixes (composition px), and pans by `shift` as camera() does for a web window.
 * AppPair draws it; appLeanKeepsBrackets checks it.
 */
export const appLean = (pair: Pair, rect: Rect, zoom: number | "fit") => {
  const [b, a] = pairPhones(pair)
  const to = zoom === "fit" ? fitZoom(rect, pair.after) : zoom
  const fix = (p: typeof b) => p.left + p.bezel + (rect.left + rect.width / 2) * p.scale
  const origin = { x: (fix(b) + fix(a)) / 2, y: frameTop + a.bezel + (rect.top + rect.height / 2) * a.scale }
  return {
    to,
    origin,
    shift: {
      x: place(b.left, origin.x - b.left, a.left + a.width - b.left, 1920, to),
      y: place(frameTop, origin.y - frameTop, Math.max(b.height, a.height), fadeTop, to),
    },
  }
}

/** True when every bracket on both phones stays in the footage band (inside the frame, above the caption fade) once leaned in. */
const appLeanKeepsBrackets = (pair: Pair, lean: ReturnType<typeof appLean>) =>
  pairPhones(pair).every((p) => {
    const o = lean.origin
    const x = (sx: number, out: number) => o.x + lean.shift.x + lean.to * (p.left + p.bezel + sx * p.scale + out - o.x)
    const y = (sy: number, out: number) => o.y + lean.shift.y + lean.to * (frameTop + p.bezel + sy * p.scale + out - o.y)
    return (p.capture.rings ?? []).every(
      (r) => x(r.left, -bracketReach) >= 0 && y(r.top, -bracketReach) >= 0 && x(r.left + r.width, bracketReach) <= 1920 && y(r.top + r.height, bracketReach) <= fadeTop,
    )
  })

/**
 * True when every bracket of a web capture stays in the footage band (inside the frame, above the caption
 * fade) once leaned in on `focus` by `to` with camera()'s pan: BrowserFrame scales around the focus centre.
 */
const webLeanKeepsBrackets = (capture: Capture, focus: Rect, to: number) => {
  const scale = webScreen / (capture.height - (capture.cropBottom ?? 0))
  const left = (1920 - capture.width * scale) / 2
  const top = frameTop + browserBar
  const shift = camera(focus, capture, to)
  const ox = left + (focus.left + focus.width / 2) * scale
  const oy = top + (focus.top + focus.height / 2) * scale
  return (capture.rings ?? []).every((r) => {
    const x = (sx: number, out: number) => ox + shift.x + to * (left + sx * scale + out - ox)
    const y = (sy: number, out: number) => oy + shift.y + to * (top + sy * scale + out - oy)
    return x(r.left, -bracketReach) >= 0 && y(r.top, -bracketReach) >= 0 && x(r.left + r.width, bracketReach) <= 1920 && y(r.top + r.height, bracketReach) <= fadeTop
  })
}

const played = (capture: Capture) =>
  isVideo(capture) ? capture.trimAfter! - (capture.trimBefore ?? 0) - (capture.jump ? capture.jump.to - capture.jump.at : 0) : 0
/** Beat frames from playAt to a recording's cut, or undefined without one. */
export const cutAfter = (capture: Capture) => (capture.jump ? capture.jump.at - (capture.trimBefore ?? 0) : undefined)

/** The recording's own frame on screen at a beat frame: held on its first and last frames, across the cut. */
export function sourceFrame(capture: Capture, frame: number, playAt: number) {
  const t = Math.min(Math.max(frame - playAt, 0), played(capture) - 1)
  const cut = cutAfter(capture)
  return cut !== undefined && t >= cut ? capture.jump!.to + (t - cut) : (capture.trimBefore ?? 0) + t
}

/** A chip clock, m:ss since clockAt; 0:00 before it. */
export const clockText = (capture: Capture, frame: number, playAt: number) => {
  const s = Math.max(0, Math.floor((sourceFrame(capture, frame, playAt) - capture.clockAt!) / fps))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function timeline(props: PrClipProps): Timeline {
  checkText("issueKey", props.issueKey)
  checkText("why", props.why)
  if (props.platform !== "app" && props.platform !== "web") throw new Error(`platform must be app or web, not ${props.platform}`)
  if (!props.pairs?.length) throw new Error("pairs is empty")

  // With props.voice, a line must say its caption (a reworded caption keeps no old voice), and the caption
  // holds until the line has ended plus a breath.
  const want = new Map(voiceLines(props).map((l) => [l.id, l.text]))
  const say = (id: string, text: string) => {
    if (!props.voice) return read(text)
    const line = props.voice[id]
    const said = line?.cues.map((c) => c.text).join(" ")
    if (said !== want.get(id)) throw new Error(`voice "${id}" says "${said ?? "nothing"}", not "${want.get(id)}": run scripts/vo-captions.ts, then scripts/render-vo.sh`)
    return Math.max(read(text), lead + line!.frames + breath)
  }
  const whyFrames = say("why", props.why)
  const web = props.platform === "web"
  const beats: PairBeat[] = []
  let cursor = 0
  props.pairs.forEach((pair, index) => {
    const label = `pair ${index + 1}`
    checkText(`${label} caption`, pair.caption)
    checkCapture(`${label} before`, pair.before, web ? webScreen : undefined)
    checkCapture(`${label} after`, pair.after, web ? webScreen : undefined)
    if (web) {
      const { before: b, after: a } = pair
      if (b.width !== a.width || b.height !== a.height || (b.cropBottom ?? 0) !== (a.cropBottom ?? 0)) {
        throw new Error(`${label}: web before and after must be the same size (same viewport)`)
      }
      if (b.jump || a.jump) throw new Error(`${label}: jump is for app pairs only`)
    }
    const cut = cutAfter(pair.before)
    if (cut !== cutAfter(pair.after)) throw new Error(`${label}: both recordings need a jump, with as many frames before the cut`)

    const captionAt = index === 0 ? whyFrames + gap : 0
    // Motion starts with the pair, not after the why: the after state is on screen within 3 s
    // (result first) while the why is still being read. Waiting for it put a web after at 6.4 s.
    const beforeRingsAt = lead
    const playAt = beforeRingsAt
    // Web recordings run in turn: the before plays out and holds its end
    // state, the after page wipes in on its first frame, then its recording plays.
    const beforePlays = isVideo(pair.before) ? played(pair.before) + endHold : 0
    const wipeAt = web ? Math.max(beforeHold, playAt + beforePlays) : undefined
    const afterPlayAt = wipeAt === undefined ? undefined : wipeAt + wipeFrames
    const afterRingsAt = afterPlayAt ?? beforeRingsAt + stagger
    const end =
      afterPlayAt === undefined
        ? beforeRingsAt + Math.max(played(pair.before), played(pair.after)) + tail
        : afterPlayAt + Math.max(afterHold, played(pair.after) + tail)
    // Lean in only once the after state and its ring have landed, never during the swap.
    const ring = pair.after.rings?.[0]
    const screen = web ? webScreen : pairScreen
    // A pair with a focus zoom leans in (WebWipe zoomTo, appLean): its own strength, with a pan.
    const zoom = ring ? focusOf(props).zoom : undefined
    const to = zoom === "fit" ? fitZoom(ring!, pair.after) : zoom
    const leans =
      !!ring &&
      (!web && zoom !== undefined
        ? appLeanKeepsBrackets(pair, appLean(pair, ring, zoom))
        : [pair.before, pair.after].every((c) => (to ? webLeanKeepsBrackets(c, ring, to) : bracketsClearFade(c, web, screen, ring))))
    // A jump's chips (and clocks) must be read after the cut, and the lean-in fades them.
    const usualZoomAt = ring && leans ? afterRingsAt + (ring.delay ?? 0) + settle : undefined
    const zoomAt = usualZoomAt === undefined ? undefined : Math.max(usualZoomAt, cut === undefined ? 0 : playAt + cut + jumpRead)
    const leanWait = zoomAt === undefined ? 0 : zoomAt - usualZoomAt!
    const zoomEnd = zoomAt === undefined ? 0 : zoomAt + 2 * cameraFrames + zoomHold + zoomRest
    const duration = Math.max(minPair, captionAt + say(`pair-${index + 1}`, pair.caption) + gap, end, zoomEnd) + (pair.holdFrames ?? 0)
    // Under the pair's own caption rather than the why; a recording has played to its end state.
    const settledAt = Math.max(
      afterRingsAt + (ring?.delay ?? 0) + 25,
      captionAt + 15,
      (zoomAt ?? 0) + cameraFrames,
      (afterPlayAt ?? playAt) + played(pair.after),
    )

    beats.push({ kind: "pair", index, from: cursor, duration, captionAt, beforeRingsAt, afterRingsAt, playAt, wipeAt, afterPlayAt, zoomAt, leanWait, settledAt })
    cursor += duration
  })

  const variantBeats: VariantsBeat[] = []
  props.variants?.forEach((group, index) => {
    const label = `variants ${index + 1}`
    checkText(`${label} caption`, group.caption)
    if (!group.captures?.length || group.captures.length > maxVariants) throw new Error(`${label}: show 1 to ${maxVariants} captures`)
    group.captures.forEach((capture, i) => {
      checkText(`${label} capture ${i + 1} label`, capture.label)
      checkCapture(`${label} capture ${i + 1}`, capture)
    })

    // A recording (a loading state, a phone-size drag) starts with the rings and its end state holds for the tail.
    const longest = Math.max(...group.captures.map(played))
    const duration = Math.max(minVariants, say(`variants-${index + 1}`, group.caption) + gap, longest ? lead + longest + tail : 0)
    const tall = !web && group.captures.every((c) => bracketsClearFade(c, false, tallScreen))
    variantBeats.push({ kind: "variants", index, from: cursor, duration, ringsAt: lead, tall, settledAt: lead + Math.max(25, longest) })
    cursor += duration
  })

  const outroText = props.outro ?? props.issueKey
  if (props.details) checkDetails(props.details)
  const outroFrames = props.details ? Math.max(cardMin, read(props.details.title)) : Math.max(outroMin, read(outroText))
  const last = variantBeats.at(-1) ?? beats[beats.length - 1]
  if (cursor + outroFrames < minTotal) {
    last.duration += minTotal - cursor - outroFrames
    cursor = last.from + last.duration
  }
  // After the padding: a padded pair holds its lean-in longer instead of sitting unzoomed. Its settled frame
  // (the poster, the context's atMs) stays inside the hold: an after recording that outlasts it would put
  // the poster mid lean-out, half zoomed and, with blinking brackets, unmarked (a long drag recording).
  for (const b of beats) {
    if (b.zoomAt === undefined) continue
    b.zoomOutAt = b.duration - zoomRest - cameraFrames
    b.settledAt = Math.min(b.settledAt, b.zoomOutAt - 1)
  }
  const total = cursor + outroFrames
  const maxTotal = (props.maxSeconds ?? maxSeconds) * fps
  if (total > maxTotal) throw new Error(`clip runs ${(total / fps).toFixed(1)} s, over ${maxTotal / fps} s: split it`)

  const cues = [
    cue(props.why, 0, whyFrames),
    ...beats.map((b) => cue(props.pairs[b.index].caption, b.from + b.captionAt, b.from + b.duration - gap)),
    ...variantBeats.map((b) => cue(props.variants![b.index].caption, b.from, b.from + b.duration - gap)),
  ]
  // Each cue's voice line, in the cues' order.
  const ids = [...want.keys()]
  for (const id of Object.keys(props.voice ?? {})) if (!want.has(id)) throw new Error(`voice "${id}" has no caption; ids are ${ids.join(", ")}`)
  const lines = props.voice ? cues.map((c, i) => ({ id: ids[i], from: c.from + lead, frames: props.voice![ids[i]].frames })) : []

  const first = beats[0]
  const posterFrame = props.posterFrame ?? first.from + first.settledAt
  if (posterFrame < 0 || posterFrame >= total) throw new Error(`posterFrame ${posterFrame} is outside 0–${total - 1}`)
  const motionFrame = first.from + (first.zoomAt ?? first.wipeAt ?? first.beforeRingsAt) + 7

  return {
    total,
    beats: [...beats, ...variantBeats, { kind: "outro", from: cursor, duration: outroFrames, text: outroText }],
    cues,
    posterFrame,
    motionFrame,
    lines,
  }
}
