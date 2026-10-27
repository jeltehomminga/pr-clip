import React from "react"
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion"

import { motion } from "../brand"

type BeatProps = {
  durationInFrames: number
  /** 0 disables the fade - used where an inner sequence hard-starts or hard-ends. */
  fadeIn?: number
  fadeOut?: number
  /** Px the beat glides in from the right while it fades in, and out to the left while it fades out. */
  slide?: number
  children: React.ReactNode
}

/**
 * Crossfade wrapper so consecutive beats dissolve instead of cutting; a states or looks
 * beat also glides a little sideways, never a whip. A fade of 0
 * is handled explicitly: handing interpolate a zero-width input range crashes the
 * render.
 */
export const Beat: React.FC<BeatProps> = ({
  durationInFrames,
  fadeIn = 12,
  fadeOut = 12,
  slide = 0,
  children,
}) => {
  const frame = useCurrentFrame()

  const inOpacity =
    fadeIn > 0 ? interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" }) : 1
  const outOpacity =
    fadeOut > 0
      ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
        })
      : 1

  const ease = { easing: Easing.bezier(...motion.enter.curve), extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
  const x =
    (fadeIn > 0 ? interpolate(frame, [0, fadeIn], [slide, 0], ease) : 0) +
    (fadeOut > 0 ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [0, -slide], ease) : 0)

  return (
    <AbsoluteFill style={{ opacity: Math.min(inOpacity, outOpacity), transform: x ? `translateX(${x}px)` : undefined }}>{children}</AbsoluteFill>
  )
}
