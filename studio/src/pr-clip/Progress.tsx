import React from "react"
import { Easing, interpolate, useCurrentFrame } from "remotion"

import { colors, glass, motion } from "../brand"
import { lean } from "./lean"
import { crossfade, type Timeline } from "./timeline"

/** One thin segment per chapter. */
const segment = { width: 26, height: 3, gap: 5 } as const
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

type ProgressProps = { beats: Timeline["beats"] }

/**
 * A thin segmented line at the top right, on the chips' centre line: one segment per pair, states
 * and looks beat, so a long clip reads as chapters. Past segments are full, the current one fills
 * as its beat plays, the rest are empty. It fades out during a pair's lean-in and as the end card
 * comes in.
 */
export const Progress: React.FC<ProgressProps> = ({ beats }) => {
  const frame = useCurrentFrame()
  const chapters = beats.filter((b) => b.kind !== "outro")
  // timeline() always ends on the outro, so every chapter has a successor.
  const outro = beats.at(-1)!
  // A leaned-in web window reaches the top right, so the line fades with the chips.
  const leanIn = Math.max(0, ...beats.map((b) => (b.kind === "pair" ? lean(frame - b.from, b) : 0)))
  const opacity = interpolate(frame, [outro.from, outro.from + crossfade], [1, 0], { ...clamp, easing: Easing.bezier(...motion.enter.curve) }) * (1 - leanIn)

  return (
    <div style={{ position: "absolute", top: 70, right: 80, display: "flex", gap: segment.gap, opacity }}>
      {chapters.map((b, i) => {
        const end = (chapters[i + 1] ?? outro).from
        const filled = interpolate(frame, [b.from, end], [0, 1], clamp)
        return (
          <div key={b.from} style={{ width: segment.width, height: segment.height, borderRadius: segment.height / 2, background: glass.border, overflow: "hidden" }}>
            <div style={{ width: segment.width * filled, height: "100%", background: colors.text }} />
          </div>
        )
      })}
    </div>
  )
}
