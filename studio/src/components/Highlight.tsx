import React from "react"
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"
import type { Mark, Rect } from "../pr-clip/timeline"
import { useFrame } from "./FrameContext"

type HighlightProps = {
  /** Bounds in SOURCE pixels of the capture - what scripts/measure-bounds.js prints. */
  rect: Rect
  /** problem (before, coral) or fix (after, teal): the frame's theme picks the shade (brand.ring). */
  kind?: "problem" | "fix"
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
/** Thin strokes; timeline's bracketReach (14) allows up to 4 px. */
const stroke = 3
/** The arms draw on from each corner over these frames. */
const draw = 9
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
 * border or focus outline, which a closed ring did. Thin strokes with a soft glow: each
 * corner's arms draw on outward while the box contracts onto the element on the brand
 * spring, never closer than `gap`. With look "blink" they blink twice and go (Mark).
 * Renders only inside a frame (its `overlay` prop, or its children): the frame
 * supplies the scale, the theme and the transform, and useFrame throws outside one.
 */
export const Highlight: React.FC<HighlightProps> = ({ rect, kind = "fix", delay = 0, look = "brackets", wait = 0 }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { source, cropBottom, screenHeight, dark } = useFrame()
  const scale = screenHeight / (source.height - cropBottom)
  const color = dark ? brand.ring[kind] : brand.ring.onLight[kind]
  const t = frame - delay
  const tb = t - wait
  const entrance = spring({ frame: t, fps, config: brand.spring })
  const drawn = interpolate(t, [0, draw], [0, 1], { ...clamp, easing: Easing.bezier(...brand.motion.enter.curve) })
  const shown =
    look === "brackets"
      ? 1
      : offs.some(([from, to]) => tb >= from && tb < to)
        ? 0
        : interpolate(tb, [goAt, goAt + brand.motion.exit.frames], [1, 0], { ...clamp, easing: Easing.bezier(...brand.motion.exit.curve) })
  // The overshoot pulls the box in a little past rest; the clearance holds.
  const out = gap + Math.max(0, 1 - entrance) * travel
  const width = rect.width * scale + 2 * out
  const height = rect.height * scale + 2 * out
  const arm = Math.min(28, width / 3, height / 3) * drawn
  const bar = { position: "absolute", background: color, borderRadius: stroke / 2 } as const
  // Each corner: [horizontal anchor, vertical anchor].
  const corners = [
    ["left", "top"],
    ["right", "top"],
    ["left", "bottom"],
    ["right", "bottom"],
  ] as const

  if (t < 0 || shown === 0) return null

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left * scale - out,
        top: rect.top * scale - out,
        width,
        height,
        opacity: Math.min(1, entrance) * shown,
        filter: `drop-shadow(0 0 5px ${color}99)`,
      }}
    >
      {corners.map(([x, y]) => (
        <React.Fragment key={`${x}-${y}`}>
          <div style={{ ...bar, [x]: 0, [y]: 0, width: arm, height: stroke }} />
          <div style={{ ...bar, [x]: 0, [y]: 0, width: stroke, height: arm }} />
        </React.Fragment>
      ))}
    </div>
  )
}
