import identifiers from "../../identifiers.json" with { type: "json" }
import { ms, timeline, type CaptureContext, type PrClipProps } from "./timeline.ts"

/**
 * The agent context: one line of ASCII JSON that render.sh writes into the share copy's
 * `comment` tag, so a dev's or tester's agent reads the clip without watching it. Inside the
 * mp4, never a separate file, so it can't get lost. Built from props.json and timeline(), the
 * same inputs as the render, so the two can't drift apart.
 */
const howToRead = (voiced: boolean) =>
  [
    voiced
      ? "Captions burned in, and a voice reads each one; frame = ms * 30 / 1000."
      : "Silent clip, captions burned in; frame = ms * 30 / 1000.",
    "A web pair shows the before page, then wipes to the after page; an app pair shows the before phone left and the after phone right.",
    "Coral corner brackets mark the problem, teal ones the fix; on a pair that zooms in they blink twice and go as the zoom lands, so the zoomed change at atMs shows without them. Variants are after states side by side under chip labels.",
    "atMs is a frame where the chapter has landed: ffmpeg -ss <atMs/1000> -i <mp4> -frames:v 1 out.png.",
    "Captured from a local build of pr.commit against the capture.env backend; if the PR head has moved since, the clip may be out of date.",
  ].join(" ")

/** Identifiers never leave in full; only short forms pass (4711…0042). The list is identifiers.json. */
const guards: [kind: string, pattern: RegExp][] = identifiers.patterns.map((p) => [p.kind, new RegExp(p.regex, "i")])

const captureFields: (keyof CaptureContext)[] = ["env", "date", "device", "locale", "theme", "account"]

/** Reports the field and the kind, never the value. */
export const guard = (value: unknown, path: string): void => {
  if (typeof value === "string") {
    for (const [kind, pattern] of guards) if (pattern.test(value)) throw new Error(`agent context: ${kind} in ${path}`)
    return
  }
  if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) guard(v, path ? `${path}.${key}` : key)
}

/** A PR clip's context is complete or the render stops: testers rely on every reach line. */
const checkComplete = (props: PrClipProps) => {
  if (!props.pr) return
  const missing = captureFields.filter((field) => !props.capture?.[field]?.trim())
  if (missing.length) throw new Error(`agent context: capture needs ${missing.join(", ")}`)
  props.pairs.forEach((pair, i) => {
    if (!pair.state?.reach?.trim()) throw new Error(`agent context: pair ${i + 1} needs state.reach`)
  })
  props.variants?.forEach((group, i) =>
    group.captures.forEach((capture, j) => {
      if (!capture.state?.reach?.trim()) throw new Error(`agent context: variants ${i + 1} capture ${j + 1} needs state.reach`)
    }),
  )
}

/** "localhost:3000/en/settings/billing" -> "/en/settings/billing" */
export const route = (url?: string) => url?.replace(/^[^/]*/, "")

// ASCII only: `strings` cuts a line at its first non-ASCII byte (… × · € é), and
// `strings <mp4> | grep issueKey` is the fallback for agents without ffprobe.
export const asciiJson = (value: unknown) =>
  JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)

export function context(props: PrClipProps): string {
  const t = timeline(props)
  checkComplete(props)
  const pr = props.pr && {
    repo: props.pr.repo,
    number: props.pr.number,
    base: props.pr.base,
    commit: props.pr.commit,
    url: `https://github.com/${props.pr.repo}/pull/${props.pr.number}`,
  }
  const chapters = t.beats.map((b) => {
    const span = { kind: b.kind, startMs: ms(b.from), endMs: ms(b.from + b.duration) }
    if (b.kind === "outro") return { ...span, caption: props.details?.title ?? b.text }
    const atMs = ms(b.from + b.settledAt)
    if (b.kind === "pair") {
      const pair = props.pairs[b.index]
      return { ...span, atMs, caption: pair.caption, ...(pair.url && { route: route(pair.url) }), ...pair.state }
    }
    const group = props.variants![b.index]
    const shows = group.captures.map((c) => ({ label: c.label, route: route(c.url), ...c.state }))
    return { ...span, atMs, caption: group.caption, shows }
  })
  const out = {
    issueKey: props.issueKey,
    why: props.why,
    pr,
    figma: props.figma,
    platform: props.platform,
    route: route(props.url),
    durationMs: ms(t.total),
    capture: props.capture,
    chapters,
    notShown: props.notShown,
    captions: t.cues.map(({ text, startMs, endMs }) => ({ text, startMs, endMs })),
    details: props.details,
    howToRead: howToRead(!!props.voice),
  }
  guard(out, "")
  return asciiJson(out)
}
