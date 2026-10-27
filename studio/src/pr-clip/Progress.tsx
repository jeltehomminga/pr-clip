import React from "react"
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion"

import { colors, motion } from "../brand"
import { useTone } from "../components/Stage"
import { lean } from "./lean"
import { crossfade, type Timeline } from "./timeline"

const dot = 12
/** The current beat's dot stretches to a pill this long. */
const pill = 36
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(...motion.enter.curve) } as const

type ProgressProps = { beats: Timeline["beats"] }

/**
 * One dot per pair, states and looks beat, top right, so a long clip reads as chapters.
 * The current beat's dot is a green pill; it moves on during each
 * dissolve. The row fades out during a pair's lean-in and as the end card comes in.
 */
export const Progress: React.FC<ProgressProps> = ({ beats }) => {
  const frame = useCurrentFrame()
  const dark = useTone() === "dark"
  const chapters = beats.filter((b) => b.kind !== "outro")
  // timeline() always ends on the outro, so every chapter has a successor.
  const outro = beats.at(-1)!
  const off = dark ? colors.neutral700 : colors.neutral300
  const on = dark ? colors.darkPrimary500 : colors.primary400
  // A leaned-in web window reaches the top right, so the dots fade with the chips.
  const leanIn = Math.max(0, ...beats.map((b) => (b.kind === "pair" ? lean(frame - b.from, b) : 0)))
  const opacity = interpolate(frame, [outro.from, outro.from + crossfade], [1, 0], clamp) * (1 - leanIn)

  return (
    <div style={{ position: "absolute", top: 58, right: 80, display: "flex", gap: 10, opacity }}>
      {chapters.map((b, i) => {
        const end = (chapters[i + 1] ?? outro).from
        const active =
          i === 0
            ? interpolate(frame, [end, end + crossfade], [1, 0], clamp)
            : interpolate(frame, [b.from, b.from + crossfade, end, end + crossfade], [0, 1, 1, 0], clamp)
        return (
          <div
            key={b.from}
            style={{ width: dot + (pill - dot) * active, height: dot, borderRadius: dot / 2, background: interpolateColors(active, [0, 1], [off, on]) }}
          />
        )
      })}
    </div>
  )
}
