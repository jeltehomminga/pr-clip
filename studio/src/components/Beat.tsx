import React from "react"
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import * as brand from "../brand"

type BeatProps = {
  durationInFrames: number
  /** 0 disables the fade - used where an inner sequence hard-starts or hard-ends. */
  fadeIn?: number
  fadeOut?: number
  /** The beat's frames come in with the tilt (brand.motion.tilt); the end card has its own entrance. */
  tilt?: boolean
  children: React.ReactNode
}

/**
 * Crossfade wrapper so consecutive beats dissolve instead of cutting. With `tilt`, the beat's frames
 * come in lying back a few degrees, a little low and small, and stand up flat on the brand spring;
 * going out they lift a few px as they fade. Tilted beats dip rather than dissolve: the one going out
 * is gone before the next comes in, since two windows at different angles over each other read as
 * a double exposure. Once landed there is no transform at all, so the captures stay
 * pixel-sharp. A fade of 0 is handled explicitly: handing interpolate a zero-width input range
 * crashes the render.
 */
/** In a dip, the beat going out takes the first half of the crossfade and the next one the second. */
const dip = 0.5

export const Beat: React.FC<BeatProps> = ({ durationInFrames, fadeIn = 12, fadeOut = 12, tilt = false, children }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const wait = tilt ? Math.round(fadeIn * dip) : 0
  const early = tilt ? Math.round(fadeOut * dip) : 0
  const inOpacity = fadeIn > 0 ? interpolate(frame, [wait, fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1
  const outOpacity =
    fadeOut > 0
      ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames - early], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1

  const { degrees, rise, scale } = brand.motion.tilt
  const p = tilt ? spring({ frame: frame - wait, fps, config: brand.spring }) : 1
  const lift =
    tilt && fadeOut > 0
      ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          easing: Easing.bezier(...brand.motion.exit.curve),
        })
      : 0
  const moving = Math.abs(1 - p) > 0.002 || lift > 0
  const transform = moving
    ? `perspective(1800px) translateY(${((1 - p) * rise - lift * 14).toFixed(2)}px) rotateX(${((1 - p) * degrees).toFixed(3)}deg) scale(${(scale + (1 - scale) * p - lift * 0.015).toFixed(4)})`
    : undefined

  return (
    <AbsoluteFill style={{ opacity: Math.min(inOpacity, outOpacity), transform, transformOrigin: "50% 60%" }}>{children}</AbsoluteFill>
  )
}
