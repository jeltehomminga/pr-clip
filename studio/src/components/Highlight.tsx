import React from "react"
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"
import type { Mark, Rect } from "../pr-clip/timeline"
import { useFrame } from "./FrameContext"

type HighlightProps = {
  /** Bounds in SOURCE pixels of the capture - what scripts/measure-bounds.js prints. */
  rect: Rect
  color?: string
  delay?: number
  /** Stay (default) or blink twice and go: Mark. */
  look?: Mark
  /** A blink starts this many frames later: the pair's lean-in waits past a jump (PairBeat.leanWait). */
  wait?: number
}

/** Clear space between the element and its brackets, in composition px. */
const gap = 10
/** The brackets lock on from this much further out. */
const travel = 16
const stroke = 4
const radius = 4
/**
 * blink, in frames after landing: off twice on the beat, then gone just as a pair's lean-in
 * lands (it starts 15 frames after the brackets and takes 30), so nothing stays over the UI.
 */
const offs = [
  [15, 19],
  [23, 27],
] as const
const goAt = 39
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * Corner brackets around a region of the capture, positioned from source pixels so
 * the numbers are measured off the still (`node scripts/measure-bounds.js <png> --probe x,y`)
 * rather than read off a downscaled preview - a 15px error is invisible there and
 * obvious at 1:1. The open sides and the gap keep them from lining up with a real
 * border or focus outline, which a closed ring did. They lock
 * on: the box starts `travel` px further out and contracts on the brand spring.
 * With look "blink" they blink twice and go (Mark).
 * Renders only inside a frame (its `overlay` prop, or its children): the frame
 * supplies the scale and the transform, and useFrame throws outside one.
 */
export const Highlight: React.FC<HighlightProps> = ({ rect, color = brand.ring.fix, delay = 0, look = "brackets", wait = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { source, cropBottom, screenHeight } = useFrame()
  const scale = screenHeight / (source.height - cropBottom)
  const t = frame - delay
  const tb = t - wait
  const entrance = spring({ frame: t, fps, config: brand.spring })
  const shown =
    look === "brackets"
      ? 1
      : offs.some(([from, to]) => tb >= from && tb < to)
        ? 0
        : interpolate(tb, [goAt, goAt + brand.motion.exit.frames], [1, 0], { ...clamp, easing: Easing.bezier(...brand.motion.exit.curve) })
  const out = gap + (1 - entrance) * travel
  const width = rect.width * scale + 2 * out
  const height = rect.height * scale + 2 * out
  const arm = Math.min(28, width / 3, height / 3)
  const side = `${stroke}px solid ${color}`
  const corners: [string, React.CSSProperties][] = [
    ["top-left", { top: 0, left: 0, borderTop: side, borderLeft: side, borderTopLeftRadius: radius }],
    ["top-right", { top: 0, right: 0, borderTop: side, borderRight: side, borderTopRightRadius: radius }],
    ["bottom-left", { bottom: 0, left: 0, borderBottom: side, borderLeft: side, borderBottomLeftRadius: radius }],
    ["bottom-right", { bottom: 0, right: 0, borderBottom: side, borderRight: side, borderBottomRightRadius: radius }],
  ]

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left * scale - out,
        top: rect.top * scale - out,
        width,
        height,
        opacity: entrance * shown,
      }}
    >
      {corners.map(([key, style]) => (
        <div key={key} style={{ position: "absolute", width: arm, height: arm, boxSizing: "border-box", ...style }} />
      ))}
    </div>
  )
}
