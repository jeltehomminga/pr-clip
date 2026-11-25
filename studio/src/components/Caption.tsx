import React, { useLayoutEffect, useRef } from "react"
import { Easing, interpolate, useCurrentFrame } from "remotion"

import { colors, motion, type } from "../brand"
import type { Cue } from "../pr-clip/timeline"
import { useTone } from "./Stage"

const lineHeight = Math.round(type.caption * 1.2)
/** About 42 characters of Schibsted Grotesk 600 at caption size. */
const width = 1300

/** A column beside the devices instead of the band below them (films). */
export type CaptionSide = { left: number; width: number; lines: number }
type CaptionProps = { cues: Cue[]; side?: CaptionSide }

/**
 * The caption band below the devices, or a column beside them: one cue at a
 * time, two lines at most in the band, never over footage. The text box has no
 * height limit, so an extra line shows in its own height, and a word too long
 * for a line shows in its scroll width; either logs `FIT:` (console.error
 * reaches the render log) and fails check.sh.
 */
export const Caption: React.FC<CaptionProps> = ({ cues, side }) => {
  const frame = useCurrentFrame()
  const tone = useTone()
  const ref = useRef<HTMLDivElement>(null)
  const cue = cues.find((c) => frame >= c.from && frame < c.to)
  const lines = side?.lines ?? 2

  useLayoutEffect(() => {
    const el = ref.current
    if (el && (el.scrollHeight > lineHeight * lines + 1 || el.scrollWidth > el.clientWidth + 1)) {
      console.error(
        `FIT: caption needs ${el.scrollWidth}x${el.scrollHeight} px of ${el.clientWidth}x${lineHeight * lines} (fonts ${document.fonts.status}): "${cue?.text}"`,
      )
    }
  }, [cue, lines])

  if (!cue) return null

  const opacity = interpolate(frame - cue.from, [0, motion.enter.frames], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...motion.enter.curve),
  })

  return (
    <div
      style={
        side
          ? { position: "absolute", left: side.left, top: 0, bottom: 0, display: "flex", alignItems: "center" }
          : {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 48,
              height: lineHeight * 2,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }
      }
    >
      <div
        ref={ref}
        style={{
          width: side?.width ?? width,
          // A render tab mounts before it has its full size; a shrinking box measured 251 px there.
          flexShrink: 0,
          textAlign: side ? "left" : "center",
          // Two lines of even length instead of a long line and a one-word orphan.
          textWrap: "balance",
          fontSize: type.caption,
          fontWeight: 600,
          lineHeight: `${lineHeight}px`,
          color: tone === "dark" ? colors.neutral50 : colors.neutral900,
          opacity,
        }}
      >
        {cue.text}
      </div>
    </div>
  )
}
