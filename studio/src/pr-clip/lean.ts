import type React from "react"
import { Easing, interpolate } from "remotion"

import { motion } from "../brand"
import { cameraFrames, fadeTop, type PairBeat } from "./timeline"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** 0 → 1 → 0 over a pair's lean-in, hold and lean-out; 0 throughout for a pair that doesn't lean in. */
export const lean = (frame: number, { zoomAt, zoomOutAt }: PairBeat) =>
  zoomAt === undefined || zoomOutAt === undefined
    ? 0
    : interpolate(frame, [zoomAt, zoomAt + cameraFrames, zoomOutAt, zoomOutAt + cameraFrames], [0, 1, 1, 0], {
        ...clamp,
        easing: Easing.bezier(...motion.camera.curve),
      })

/**
 * The camera's feel while it moves: a slight perspective tilt (forward on the way in, back on the
 * way out) and a short blur, both from the lean's speed, so they peak mid-move and are gone at rest.
 */
export const leanFeel = (frame: number, beat: PairBeat): React.CSSProperties => {
  const speed = (lean(frame + 1, beat) - lean(frame - 1, beat)) / 2
  if (Math.abs(speed) < 0.004) return {}
  return {
    transform: `perspective(2400px) rotateX(${(-speed * 30).toFixed(3)}deg)`,
    filter: `blur(${Math.min(1, Math.abs(speed) * 14).toFixed(2)}px)`,
  }
}

/**
 * While leaned in, the footage fades out above the caption band, so the caption never
 * sits over it and the band itself stays still. At rest there is no mask at all.
 */
export const captionFade = (progress: number): React.CSSProperties => {
  if (progress === 0) return {}
  const y = interpolate(progress, [0, 1], [1080, fadeTop], clamp)
  const mask = `linear-gradient(#000 ${y}px, transparent ${y + 30}px)`
  return { maskImage: mask, WebkitMaskImage: mask }
}
